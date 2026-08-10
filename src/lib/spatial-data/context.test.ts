import { afterEach, describe, expect, it, vi } from "vitest";
import type { EdgeSpatialContextResponse } from "./types";
import { loadSpatialContext, normalizeSpatialContext } from "./context";

const bbox = { north: 40.72, south: 40.7, east: -73.99, west: -74.02 };
const buildingResponse: EdgeSpatialContextResponse = {
  type: "FeatureCollection",
  features: [{
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [[
        [-74.01, 40.705], [-74, 40.705], [-74, 40.715],
        [-74.01, 40.715], [-74.01, 40.705],
      ]],
    },
    properties: {
      featureId: "building-1",
      surfaceClass: "buildings",
      sourceId: "nyc-building-footprints",
      confidence: "high",
      observedAt: "2024-05",
      scientificStatus: "observed",
    },
  }],
  coverage: { status: "partial", requestedAreaM2: 0, classifiedAreaM2: 0 },
  provenance: [],
  warnings: [],
  loadedSourceIds: ["nyc-building-footprints"],
  failedSourceIds: ["nyc-roadbed"],
};

describe("spatial context normalization", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reports unclassified coverage instead of inferring missing land cover", () => {
    const result = normalizeSpatialContext([buildingResponse], bbox);
    const unclassified = result.featureCollection.features.find(
      (feature) => feature.properties?.surfaceClass === "unclassified"
    );
    expect(result.coverage.status).toBe("partial");
    expect(unclassified?.properties).toMatchObject({
      confidence: "low",
      scientificStatus: "derived",
      sourceId: "derived-unclassified",
    });
    expect(result.failedSourceIds).toEqual(["nyc-roadbed"]);
    expect(result.warnings).toContainEqual(expect.stringMatching(/partial/i));
  });

  it("preserves tree observations as points", () => {
    const result = normalizeSpatialContext([{
      ...buildingResponse,
      features: [{
        type: "Feature",
        geometry: { type: "Point", coordinates: [-74.005, 40.71] },
        properties: {
          featureId: "tree-1",
          surfaceClass: "tree-observation",
          sourceId: "nyc-tree-inventory",
          confidence: "medium",
          observedAt: "2015",
          scientificStatus: "observed",
        },
      }],
      loadedSourceIds: ["nyc-tree-inventory"],
      failedSourceIds: [],
    }], bbox);
    const tree = result.featureCollection.features.find(
      (feature) => feature.properties?.surfaceClass === "tree-observation"
    );
    expect(tree?.geometry.type).toBe("Point");
  });

  it("forwards AbortSignal and validates the edge response", async () => {
    const signal = new AbortController().signal;
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(buildingResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = await loadSpatialContext(bbox, signal);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/functions/v1/spatial-context"),
      expect.objectContaining({ signal })
    );
    expect(result.loadedSourceIds).toContain("nyc-building-footprints");
  });

  it("rejects malformed responses instead of treating them as empty", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ features: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    ));
    await expect(loadSpatialContext(bbox)).rejects.toThrow(/FeatureCollection/);
  });
});
