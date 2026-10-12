import { describe, expect, it } from "vitest";
import { EXAMPLE_ANALYSIS } from "@/lib/example-analysis";
import { routeWatershed, syntheticElevation } from "@/lib/hydrology";
import { squareIntervention } from "@/lib/validation/fixtures";
import { rasterizeSurfaceModifiers } from "./modifiers";
import { describeSpatialDifference, differenceGeoJSON, hasCells, spatialDifference, spatialDifferenceSummary } from "./difference";

const bbox = { west: -74.014, east: -74.004, south: 40.703, north: 40.712 };
const forcing = { rainfallDepthMm: 50, durationMinutes: 60, resolution: "low" as const };
const elevation = syntheticElevation(bbox, 36, 36);
const base = { ...forcing, bbox, landCover: EXAMPLE_ANALYSIS.land_cover, stormHash: "storm:test", elevation };
const swale = squareIntervention("bioswales", bbox, 4000);
const now = routeWatershed({ ...base, surfaceId: "now", surfaceHash: "surface:now" });
const possible = routeWatershed({
  ...base,
  surfaceId: "possible",
  surfaceHash: "surface:possible",
  modifiers: rasterizeSurfaceModifiers([swale], bbox, 36, 36),
  expectedElevationHash: now.elevationHash,
});

describe("spatial difference of a controlled pair", () => {
  it("finds the drawing's footprint and the cells downstream of it, and nothing else changes", () => {
    const difference = spatialDifference(now, possible);
    expect(difference.status).toBe("controlled");
    if (difference.status !== "controlled") return;
    const { summary } = difference;
    expect(summary.cells).toBe(36 * 36);
    expect(summary.sourceCells).toBeGreaterThan(0);
    expect(summary.less).toBeGreaterThan(0);
    // A retention-only redesign can never send more water anywhere.
    expect(summary.more).toBe(0);
    expect(summary.largestIncreaseM3).toBe(0);
    expect(summary.changed).toBe(summary.sourceCells + summary.downstreamCells);
    // The sum of generated changes is exactly the avoided runoff of the pair.
    expect(summary.generatedDeltaM3).toBeCloseTo(possible.waterBalance.runoffM3 - now.waterBalance.runoffM3, 5);
    expect(summary.generatedDeltaM3).toBeLessThan(0);
    // Source cells sit where the square was drawn: around the centre of the extent.
    const sources = difference.cells.filter((c) => c.kind === "source");
    for (const cell of sources) {
      expect(cell.reachM).toBe(0);
      expect(Math.abs(cell.row - 17.5)).toBeLessThan(6);
      expect(Math.abs(cell.col - 17.5)).toBeLessThan(6);
    }
    for (const cell of difference.cells.filter((c) => c.kind === "downstream")) {
      expect(cell.reachM).toBeGreaterThan(0);
      expect(cell.deltaM3).toBeLessThan(0);
    }
    if (summary.downstreamCells > 0) expect(summary.farthestReachM).toBeGreaterThan(0);
    // Largest change first.
    for (let i = 1; i < difference.cells.length; i += 1) {
      expect(Math.abs(difference.cells[i - 1].deltaM3)).toBeGreaterThanOrEqual(Math.abs(difference.cells[i].deltaM3));
    }
  });

  it("is deterministic and reads the same in words", () => {
    const a = spatialDifferenceSummary(now, possible);
    const b = spatialDifferenceSummary(now, possible);
    expect(a).toEqual(b);
    expect(a).not.toBeNull();
    expect(describeSpatialDifference(a!)).toMatch(/Less water passes through \d+ cells/);
    expect(describeSpatialDifference(a!)).toMatch(/No cell carries more water/);
    expect(describeSpatialDifference({ ...a!, changed: 0 })).toMatch(/changed no cell/);
  });

  it("draws every changed cell as a polygon on the routed extent", () => {
    const difference = spatialDifference(now, possible);
    const geojson = differenceGeoJSON(difference, bbox);
    if (difference.status !== "controlled") throw new Error("expected a controlled difference");
    expect(geojson.features).toHaveLength(difference.cells.length);
    const first = geojson.features[0];
    expect(first.properties.share).toBe(1);
    expect(first.properties.delta_m3).toBeLessThan(0);
    const ring = first.geometry.coordinates[0];
    expect(ring).toHaveLength(5);
    for (const [lng, lat] of ring) {
      expect(lng).toBeGreaterThanOrEqual(bbox.west - 1e-9);
      expect(lng).toBeLessThanOrEqual(bbox.east + 1e-9);
      expect(lat).toBeGreaterThanOrEqual(bbox.south - 1e-9);
      expect(lat).toBeLessThanOrEqual(bbox.north + 1e-9);
    }
    expect(differenceGeoJSON({ status: "unavailable", reason: "x" }, bbox).features).toEqual([]);
  });

  it("refuses a pair that is not a controlled comparison", () => {
    const heavier = routeWatershed({ ...base, rainfallDepthMm: 100, surfaceId: "possible", surfaceHash: "surface:possible" });
    const difference = spatialDifference(now, heavier);
    expect(difference.status).toBe("not-controlled");
    if (difference.status === "not-controlled") expect(difference.violations.join(" ")).toMatch(/Rainfall depth/);
    expect(spatialDifferenceSummary(now, heavier)).toBeNull();
  });

  it("says when per-cell water is missing instead of guessing", () => {
    const { cells: _cells, ...exported } = possible;
    expect(hasCells(exported)).toBe(false);
    const difference = spatialDifference(now, exported);
    expect(difference.status).toBe("unavailable");
    expect(spatialDifferenceSummary(now, null)).toBeNull();
  });
});
