import { beforeEach, describe, expect, it, vi } from "vitest";
import { cachedElevation, clearElevationCache, loadElevationGrid } from "./dem";
import { chooseTileZoom, encodeTerrarium, sampleTerrarium, tilesForBBox } from "./terrarium";

const bbox = { north: 40.712, south: 40.711, west: -74.007, east: -74.006 };
const wide = { north: 40.72, south: 40.71, west: -74.07, east: -73.93 };

function tile(elevation: number) {
  const [r, g, b] = encodeTerrarium(elevation);
  return {
    width: 2,
    height: 2,
    data: new Uint8ClampedArray([
      r, g, b, 255, r, g, b, 255,
      r, g, b, 255, r, g, b, 255,
    ]),
  };
}

const okResponse = { ok: true, blob: async () => new Blob(["tile"]) };
const failedResponse = { ok: false };
beforeEach(() => clearElevationCache());

describe("elevation evidence fidelity", () => {
  it("accepts fully sampled DEM tiles as observed and reuses the exact cached grid", async () => {
    const fetchImpl = vi.fn(async () => okResponse) as unknown as typeof fetch;
    const grid = await loadElevationGrid(bbox, 4, 4, fetchImpl, async () => tile(12));
    expect(grid.status).toBe("observed");
    expect(grid.values.flat()).toEqual(Array(16).fill(12));
    expect(cachedElevation(bbox, 4, 4)).toBe(grid);
    await loadElevationGrid(bbox, 4, 4, fetchImpl, async () => tile(12));
    expect(fetchImpl).toHaveBeenCalledTimes(tilesForBBox(
      bbox.west, bbox.south, bbox.east, bbox.north,
      chooseTileZoom(bbox.west, bbox.south, bbox.east, bbox.north),
    ).length);
  });

  it("fails closed when any required elevation tile is missing", async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return calls === 1 ? okResponse : failedResponse;
    }) as unknown as typeof fetch;
    const z = chooseTileZoom(wide.west, wide.south, wide.east, wide.north);
    expect(tilesForBBox(wide.west, wide.south, wide.east, wide.north, z).length).toBeGreaterThan(1);
    const grid = await loadElevationGrid(wide, 4, 4, fetchImpl, async () => tile(12));
    expect(grid.status).toBe("illustrative");
    expect(grid.warnings.join(" ")).toMatch(/incomplete elevation coverage/i);
    expect(cachedElevation(wide, 4, 4)).toBe(grid);
  });

  it("never labels invalid raster samples observed", async () => {
    const fetchImpl = (async () => okResponse) as unknown as typeof fetch;
    const grid = await loadElevationGrid(bbox, 4, 4, fetchImpl, async () => ({
      width: 0, height: 0, data: new Uint8ClampedArray(),
    }));
    expect(grid.status).toBe("illustrative");
    expect(grid.warnings.join(" ")).toMatch(/invalid/i);
    expect(grid.values.flat().every(Number.isFinite)).toBe(true);
  });

  it("clamps samples to pixel edges instead of extrapolating", () => {
    const [ar, ag, ab] = encodeTerrarium(0);
    const [br, bg, bb] = encodeTerrarium(100);
    const buffer = { width: 2, height: 2, data: new Uint8ClampedArray([
      ar, ag, ab, 255, br, bg, bb, 255,
      ar, ag, ab, 255, br, bg, bb, 255,
    ]) };
    expect(sampleTerrarium(buffer, -0.5, 0)).toBeCloseTo(0);
    expect(sampleTerrarium(buffer, 3, 0)).toBeCloseTo(100);
  });
});
