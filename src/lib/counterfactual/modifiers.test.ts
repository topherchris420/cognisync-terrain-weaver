import { describe, expect, it } from "vitest";
import type { InterventionFeature } from "./types";
import { rasterizeSurfaceModifiers } from "./modifiers";

const polygon: GeoJSON.Polygon = {
  type: "Polygon",
  coordinates: [[
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
    [0, 0],
  ]],
};

function feature(id: string): InterventionFeature {
  return {
    id,
    type: "bioswales",
    geometry: polygon,
    areaM2: 1,
    parameters: {
      retentionFractionDelta: 0.7,
      storageDeltaMm: 0,
      roughnessDelta: 0,
      calibrationProvenance: [],
    },
    eligibility: {
      eligible: true,
      validGeometry: polygon,
      invalidGeometry: null,
      validAreaM2: 1,
      invalidAreaM2: 0,
      reasonCodes: [],
      confidence: "medium",
      provenance: [],
      caveats: [],
    },
    provenance: [],
  };
}

const bbox = { north: 1, south: 0, east: 1, west: 0 };

describe("surface modifier rasterization", () => {
  it("does not double-count overlapping edits in a modifier cell", () => {
    const grid = rasterizeSurfaceModifiers(
      [feature("a"), feature("b")],
      bbox,
      30,
      30
    );

    expect(grid.cells).toHaveLength(900);
    for (const cell of grid.cells) {
      expect(cell.retentionFractionDelta).toBeLessThanOrEqual(1);
    }
  });

  it("ignores invalid geometry", () => {
    const invalid = feature("invalid");
    invalid.eligibility = {
      ...invalid.eligibility,
      eligible: false,
      validGeometry: null,
      invalidGeometry: polygon,
      validAreaM2: 0,
      invalidAreaM2: 1,
    };

    const grid = rasterizeSurfaceModifiers([invalid], bbox, 10, 10);

    expect(grid.cells).toEqual([]);
  });

  it("projects a representative 180 by 180 grid within the interaction budget", () => {
    const started = performance.now();
    const grid = rasterizeSurfaceModifiers([feature("fast")], bbox, 180, 180);
    const elapsedMs = performance.now() - started;

    expect(grid.cells).toHaveLength(32_400);
    expect(elapsedMs).toBeLessThan(150);
  });
});
