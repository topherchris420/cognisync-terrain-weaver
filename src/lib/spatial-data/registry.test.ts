import { describe, expect, it } from "vitest";
import {
  MAX_SOCRATA_ROWS,
  SPATIAL_SOURCE_REGISTRY,
  buildSocrataGeoJsonUrl,
  isValidHttpsTileTemplate,
} from "./registry";

const bbox = { north: 40.72, south: 40.7, east: -73.99, west: -74.02 };

describe("official spatial source registry", () => {
  it("registers the current geometry-bearing official sources", () => {
    expect(SPATIAL_SOURCE_REGISTRY["nyc-building-footprints"].socrataResourceId).toBe("5zhs-2jue");
    expect(SPATIAL_SOURCE_REGISTRY["nyc-roadbed"].socrataResourceId).toBe("i36f-5ih7");
    expect(SPATIAL_SOURCE_REGISTRY["nyc-sidewalk"].socrataResourceId).toBe("52n9-sdep");
    expect(SPATIAL_SOURCE_REGISTRY["nyc-hydrography"].socrataResourceId).toBe("6hbv-tek4");
    expect(SPATIAL_SOURCE_REGISTRY["nyc-tree-inventory"].socrataResourceId).toBe("uvpi-gqnh");
    expect(SPATIAL_SOURCE_REGISTRY["usgs-3dep"].displayClass).toBeNull();
  });

  it("keeps the six-inch raster catalog-only without a verified tile template", () => {
    const source = SPATIAL_SOURCE_REGISTRY["nyc-land-cover-2017-6in"];
    expect(source.availability).toBe("catalog-only");
    expect(source.socrataResourceId).toBeUndefined();
    expect(source.officialUrl).toMatch(/^https:/);
  });

  it("queries official sources with a bounded within_box predicate", () => {
    const url = buildSocrataGeoJsonUrl(SPATIAL_SOURCE_REGISTRY["nyc-building-footprints"], bbox);
    expect(url.hostname).toBe("data.cityofnewyork.us");
    expect(url.pathname).toBe("/resource/5zhs-2jue.geojson");
    expect(url.searchParams.get("$where")).toMatch(/^within_box\([^,]+, 40\.72, -74\.02, 40\.7, -73\.99\)$/);
    expect(Number(url.searchParams.get("$limit"))).toBe(MAX_SOCRATA_ROWS);
  });

  it("accepts only HTTPS templates containing all tile placeholders", () => {
    expect(isValidHttpsTileTemplate("https://tiles.example.gov/{z}/{x}/{y}.png")).toBe(true);
    expect(isValidHttpsTileTemplate("http://tiles.example.gov/{z}/{x}/{y}.png")).toBe(false);
    expect(isValidHttpsTileTemplate("https://example.gov/catalog")).toBe(false);
  });
});
