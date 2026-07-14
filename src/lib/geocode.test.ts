import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { searchLocations } from "@/lib/geocode";

const nominatimResponse = [
  { display_name: "Copenhagen, Denmark", lat: "55.6761", lon: "12.5683" },
  { display_name: "Copenhagen, New York, USA", lat: "42.4001", lon: "-75.6824" },
];

describe("searchLocations", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps Nominatim results into GeocodeResult objects", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => nominatimResponse,
    } as Response);

    const results = await searchLocations("copenhagen");

    expect(results).toEqual([
      { label: "Copenhagen, Denmark", lat: 55.6761, lng: 12.5683 },
      { label: "Copenhagen, New York, USA", lat: 42.4001, lng: -75.6824 },
    ]);
  });

  it("returns an empty array for a blank query without calling the network", async () => {
    const results = await searchLocations("   ");
    expect(results).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns an empty array when Nominatim finds no match", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);

    expect(await searchLocations("zzzzzzzz")).toEqual([]);
  });

  it("returns an empty array rather than throwing when the request fails", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("network down"));
    expect(await searchLocations("copenhagen")).toEqual([]);
  });

  it("returns an empty array rather than throwing on a non-ok response", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 429 } as Response);
    expect(await searchLocations("copenhagen")).toEqual([]);
  });

  it("drops results with unparseable coordinates rather than flying the map to NaN", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => [
        { display_name: "Good place", lat: "51.5074", lon: "-0.1278" },
        { display_name: "Broken place", lat: "not-a-number", lon: "-0.1278" },
        { display_name: "Empty coords", lat: "", lon: "" },
      ],
    } as Response);

    const results = await searchLocations("london");

    expect(results).toEqual([{ label: "Good place", lat: 51.5074, lng: -0.1278 }]);
  });

  it("drops results with out-of-range coordinates", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => [
        { display_name: "Impossible latitude", lat: "999", lon: "0" },
        { display_name: "Impossible longitude", lat: "0", lon: "999" },
      ],
    } as Response);

    expect(await searchLocations("nowhere")).toEqual([]);
  });
});
