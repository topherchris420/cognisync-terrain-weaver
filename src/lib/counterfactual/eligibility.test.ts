import { describe, expect, it } from "vitest";
import type { SpatialContextResult, SpatialSurfaceClass } from "@/lib/spatial-data/types";
import { evaluateEligibility } from "./eligibility";

const draft: GeoJSON.Polygon = {
  type: "Polygon",
  coordinates: [[
    [0.5, 0],
    [1.5, 0],
    [1.5, 1],
    [0.5, 1],
    [0.5, 0],
  ]],
};

function contextWith(surfaceClass: SpatialSurfaceClass): SpatialContextResult {
  return {
    featureCollection: {
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [[
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
            [0, 0],
          ]],
        },
        properties: {
          featureId: `${surfaceClass}-1`,
          surfaceClass,
          sourceId:
            surfaceClass === "buildings"
              ? "nyc-building-footprints"
              : "nyc-roadbed",
          confidence: "high",
          scientificStatus: "observed",
        },
      }],
    },
    coverage: {
      status: "partial",
      requestedAreaM2: 1,
      classifiedAreaM2: 0.5,
    },
    provenance: [{
      sourceId:
        surfaceClass === "buildings"
          ? "nyc-building-footprints"
          : "nyc-roadbed",
      title: surfaceClass,
      agency: "NYC Office of Technology and Innovation",
      url: "https://data.cityofnewyork.us/",
      accessedAt: "2026-08-10",
      confidence: "high",
      status: "observed",
      caveats: [],
    }],
    warnings: [],
    loadedSourceIds: [
      surfaceClass === "buildings"
        ? "nyc-building-footprints"
        : "nyc-roadbed",
    ],
    failedSourceIds: [],
  };
}

describe("intervention eligibility", () => {
  it.each([
    ["green_roofs", "buildings"],
    ["permeable_pavement", "pavement"],
  ] as const)("clips %s to eligible %s geometry", (type, surfaceClass) => {
    const result = evaluateEligibility(draft, type, contextWith(surfaceClass));

    expect(result.eligible).toBe(true);
    expect(result.validAreaM2).toBeGreaterThan(0);
    expect(result.invalidAreaM2).toBeGreaterThan(0);
    expect(result.reasonCodes).toContain(
      "PARTIALLY_OUTSIDE_ELIGIBLE_SURFACE"
    );
    expect(result.provenance.length).toBeGreaterThan(0);
  });

  it("keeps bioswales out of observed building polygons", () => {
    const result = evaluateEligibility(
      draft,
      "bioswales",
      contextWith("buildings")
    );

    expect(result.validAreaM2).toBeGreaterThan(0);
    expect(result.invalidAreaM2).toBeGreaterThan(0);
    expect(result.reasonCodes).toContain("EXCLUDED_GEOMETRY");
    expect(result.confidence).toBe("medium");
    expect(result.caveats).toContainEqual(expect.stringMatching(/utilities/i));
  });

  it("disables wetlands without a defensible suitability layer", () => {
    const result = evaluateEligibility(draft, "wetland", null);

    expect(result.eligible).toBe(false);
    expect(result.validGeometry).toBeNull();
    expect(result.invalidGeometry).toEqual(draft);
    expect(result.caveats).toContain(
      "No defensible wetland suitability layer is loaded for this place."
    );
  });
});
