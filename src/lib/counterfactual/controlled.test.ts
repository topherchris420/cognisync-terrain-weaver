import { describe, expect, it } from "vitest";
import { routeWatershed } from "@/lib/hydrology/engine";
import { syntheticElevation } from "@/lib/hydrology/dem";
import { EXAMPLE_ANALYSIS } from "@/lib/example-analysis";
import { squareIntervention } from "@/lib/validation/fixtures";
import { rasterizeSurfaceModifiers } from "./modifiers";
import { controlledComparison } from "./controlled";

const bbox = { west: -74.014, east: -74.004, south: 40.703, north: 40.712 };
const base = {
  bbox,
  rainfallDepthMm: 50,
  durationMinutes: 60,
  resolution: "low" as const,
  landCover: EXAMPLE_ANALYSIS.land_cover,
  surfaceId: "now" as const,
  stormHash: "storm:a",
  surfaceHash: "surface:now",
  elevation: syntheticElevation(bbox, 36, 36),
};
const modifiers = rasterizeSurfaceModifiers([squareIntervention("bioswales", bbox, 5000)], bbox, 36, 36);
const now = routeWatershed(base);
const possible = routeWatershed({ ...base, surfaceId: "possible", surfaceHash: "surface:possible", modifiers });

describe("controlled NOW/POSSIBLE comparison", () => {
  it("accepts a pair that differs only in the intervention", () => {
    const check = controlledComparison(now, possible);
    expect(check.violations).toEqual([]);
    expect(check.valid).toBe(true);
    expect(check.fixed.every((v) => v.identical)).toBe(true);
  });

  it("rejects an accidental forcing change even when the storm label is reused", () => {
    const wetter = routeWatershed({ ...base, rainfallDepthMm: 60, surfaceId: "possible", modifiers });
    const check = controlledComparison(now, wetter);
    expect(check.valid).toBe(false);
    expect(check.violations.join(" ")).toMatch(/Rainfall depth/);
  });

  it("rejects a changed land cover, extent or resolution", () => {
    const recovered = routeWatershed({ ...base, landCover: { ...base.landCover, vegetation: 30, buildings: 26 }, modifiers });
    expect(controlledComparison(now, recovered).violations.join(" ")).toMatch(/land-cover/);
    const shifted = { ...bbox, west: bbox.west - 0.001 };
    const moved = routeWatershed({ ...base, bbox: shifted, elevation: syntheticElevation(shifted, 36, 36), modifiers: rasterizeSurfaceModifiers([squareIntervention("bioswales", shifted, 5000)], shifted, 36, 36) });
    expect(controlledComparison(now, moved).violations.join(" ")).toMatch(/extent/);
  });

  it("rejects a pair with no treatment", () => {
    const check = controlledComparison(now, routeWatershed({ ...base, surfaceId: "possible" }));
    expect(check.valid).toBe(false);
    expect(check.violations.join(" ")).toMatch(/no treatment/);
  });

  it("rejects legacy results that did not record controlled variables", () => {
    const legacy = { ...now, metadata: { ...now.metadata, land_cover_hash: undefined } };
    expect(controlledComparison(legacy, possible).valid).toBe(false);
  });
});
