import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadFloodplain,
  requestBoxFor,
  resetFloodplainCache,
  type BBox,
} from "@/lib/historical/futureFloodplains";

/** The workstation's default view: Lower Manhattan at zoom 15, 1280×820. */
const LOWER_MANHATTAN_Z15: BBox = {
  west: -74.0365,
  south: 40.6942,
  east: -73.9815,
  north: 40.7208,
};

const EMPTY = { type: "FeatureCollection", features: [] };

function polygonOf(url: string): number[][] {
  const where = new URL(url).searchParams.get("$where") ?? "";
  const ring = /POLYGON\(\((.*)\)\)/.exec(where)?.[1] ?? "";
  return ring.split(",").map((pair) => pair.trim().split(" ").map(Number));
}

describe("requestBoxFor", () => {
  it("always contains the view and is never a line", () => {
    const box = requestBoxFor(LOWER_MANHATTAN_Z15);
    expect(box.west).toBeLessThanOrEqual(LOWER_MANHATTAN_Z15.west);
    expect(box.south).toBeLessThanOrEqual(LOWER_MANHATTAN_Z15.south);
    expect(box.east).toBeGreaterThanOrEqual(LOWER_MANHATTAN_Z15.east);
    expect(box.north).toBeGreaterThanOrEqual(LOWER_MANHATTAN_Z15.north);
    expect(box.east - box.west).toBeGreaterThan(0);
    expect(box.north - box.south).toBeGreaterThan(0);
  });

  it("snaps every edge to the 0.05° grid", () => {
    const box = requestBoxFor(LOWER_MANHATTAN_Z15);
    for (const edge of [box.west, box.south, box.east, box.north]) {
      expect(Math.abs(edge * 20 - Math.round(edge * 20))).toBeLessThan(1e-9);
    }
    expect(box).toEqual({ west: -74.05, south: 40.65, east: -73.95, north: 40.75 });
  });

  it("keeps a view that sits exactly on grid lines one cell wide", () => {
    const box = requestBoxFor({ west: -74.05, south: 40.7, east: -74.05, north: 40.7 });
    expect(box.east - box.west).toBeCloseTo(0.05, 9);
    expect(box.north - box.south).toBeCloseTo(0.05, 9);
  });
});

describe("loadFloodplain", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    resetFloodplainCache();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, json: async () => EMPTY });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("asks the city for a box that covers the whole block-scale view", async () => {
    await loadFloodplain("fp-2080", LOWER_MANHATTAN_Z15);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("/resource/ek8y-fsqz.geojson");
    const ring = polygonOf(url);
    expect(ring).toHaveLength(5);
    const lngs = ring.map(([lng]) => lng);
    const lats = ring.map(([, lat]) => lat);
    expect(Math.min(...lngs)).toBeLessThanOrEqual(LOWER_MANHATTAN_Z15.west);
    expect(Math.max(...lngs)).toBeGreaterThanOrEqual(LOWER_MANHATTAN_Z15.east);
    expect(Math.min(...lats)).toBeLessThanOrEqual(LOWER_MANHATTAN_Z15.south);
    expect(Math.max(...lats)).toBeGreaterThanOrEqual(LOWER_MANHATTAN_Z15.north);
    // The regression: rounding collapsed this view to a line at 40.70.
    expect(Math.max(...lats) - Math.min(...lats)).toBeGreaterThan(0);
  });

  it("reuses one fetch for views inside the same grid cell", async () => {
    await loadFloodplain("fp-2100", LOWER_MANHATTAN_Z15);
    await loadFloodplain("fp-2100", {
      west: LOWER_MANHATTAN_Z15.west + 0.004,
      south: LOWER_MANHATTAN_Z15.south + 0.002,
      east: LOWER_MANHATTAN_Z15.east + 0.004,
      north: LOWER_MANHATTAN_Z15.north + 0.002,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("pages through a full result and stops at the first short page", async () => {
    const feature = (id: number): GeoJSON.Feature => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [id, id] },
      properties: null,
    });
    const full = Array.from({ length: 2000 }, (_, i) => feature(i));
    const tail = [feature(2000), feature(2001)];
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ type: "FeatureCollection", features: full }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ type: "FeatureCollection", features: tail }) });

    const data = await loadFloodplain("fp-2050", LOWER_MANHATTAN_Z15);
    expect(data.features).toHaveLength(2002);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const offsets = fetchMock.mock.calls.map((call) =>
      new URL(String(call[0])).searchParams.get("$offset")
    );
    expect(offsets).toEqual(["0", "2000"]);
    for (const call of fetchMock.mock.calls) {
      const params = new URL(String(call[0])).searchParams;
      expect(params.get("$limit")).toBe("2000");
      expect(params.get("$order")).toBe(":id");
    }
  });

  it("drops a failed request from the cache so the next attempt asks again", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) });
    await expect(loadFloodplain("fp-2050", LOWER_MANHATTAN_Z15)).rejects.toThrow("503");
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => EMPTY });
    await expect(loadFloodplain("fp-2050", LOWER_MANHATTAN_Z15)).resolves.toEqual(EMPTY);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns an empty collection for an unknown scenario without fetching", async () => {
    const data = await loadFloodplain("fp-3000", LOWER_MANHATTAN_Z15);
    expect(data.features).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
