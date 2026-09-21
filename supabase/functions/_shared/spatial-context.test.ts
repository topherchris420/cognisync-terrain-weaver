import { describe, expect, it, vi } from "vitest";
import {
  fetchOfficialSpatialContext,
  validateSpatialContextBbox,
} from "./spatial-context";
import { MAX_SOCRATA_ROWS } from "../../../src/lib/spatial-data/registry";

const bbox = { north: 40.72, south: 40.7, east: -73.99, west: -74.02 };

describe("bounded official spatial adapter", () => {
  it("accepts ordered numeric coordinates and rejects malformed bounds", () => {
    expect(validateSpatialContextBbox(bbox)).toEqual(bbox);
    expect(() => validateSpatialContextBbox({ ...bbox, north: Number.NaN })).toThrow(/numeric/i);
    expect(() => validateSpatialContextBbox({ ...bbox, north: bbox.south })).toThrow(/ordered/i);
  });

  it("rejects requests covering more than 50 square kilometers", () => {
    expect(() => validateSpatialContextBbox({
      north: 41, south: 40, east: -73, west: -74,
    })).toThrow(/50 km/i);
  });

  it("uses allSettled semantics and names failed sources", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes("i36f-5ih7")) throw new Error("roadbed unavailable");
      return new Response(
        JSON.stringify({ type: "FeatureCollection", features: [] }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });
    const result = await fetchOfficialSpatialContext(bbox, undefined, fetchMock);
    expect(result.failedSourceIds).toContain("nyc-roadbed");
    expect(result.loadedSourceIds).toContain("nyc-building-footprints");
    expect(result.warnings).toContainEqual(expect.stringMatching(/nyc-roadbed/));
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("converts official tree latitude and longitude into Points without canopy inference", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);
      const body = url.includes("uvpi-gqnh")
        ? {
            type: "FeatureCollection",
            features: [{
              type: "Feature",
              geometry: null,
              properties: {
                tree_id: "42",
                latitude: "40.71",
                longitude: "-74.005",
              },
            }],
          }
        : { type: "FeatureCollection", features: [] };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    const result = await fetchOfficialSpatialContext(bbox, undefined, fetchMock);
    const tree = result.features.find(
      (feature) => feature.properties?.sourceId === "nyc-tree-inventory"
    );
    expect(tree?.geometry).toEqual({
      type: "Point",
      coordinates: [-74.005, 40.71],
    });
  });

  it("reports when a source reaches the row cap instead of implying complete coverage", async () => {
    const cappedFeature = {
      type: "Feature",
      geometry: null,
      properties: {},
    };
    const fetchMock = vi.fn(async (input: string | URL) => {
      const capped = String(input).includes("5zhs-2jue");
      return new Response(JSON.stringify({
        type: "FeatureCollection",
        features: capped ? Array(MAX_SOCRATA_ROWS).fill(cappedFeature) : [],
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const result = await fetchOfficialSpatialContext(bbox, undefined, fetchMock);

    expect(result.warnings).toContainEqual(expect.stringMatching(/row cap/i));
    expect(result.coverage.status).toBe("partial");
  });
});
