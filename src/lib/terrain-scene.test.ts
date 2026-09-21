import { describe, expect, it } from "vitest";
import type { RiskZone } from "@/lib/simulation-types";
import {
  MAX_FLOOD_DISPLAY_M,
  MIN_FLOOD_DISPLAY_M,
  floodDepthMeters,
  floodExtrusionHeightExpression,
  floodVolumeGeoJSON,
  terrainExaggerationForZoom,
  terrainPitchForZoom,
} from "./terrain-scene";

const zone = (partial: Partial<RiskZone> = {}): RiskZone => ({
  polygon: [
    [-74.01, 40.7],
    [-74.0, 40.7],
    [-74.0, 40.71],
    [-74.01, 40.71],
    [-74.01, 40.7],
  ],
  level: "high",
  affected_area_km2: 0.01,
  ...partial,
});

describe("terrain exaggeration", () => {
  it("eases from regional lift to street-scale relief", () => {
    expect(terrainExaggerationForZoom(4)).toBe(3.6);
    expect(terrainExaggerationForZoom(10)).toBe(2.8);
    expect(terrainExaggerationForZoom(12)).toBeCloseTo(2.3, 5);
    expect(terrainExaggerationForZoom(15)).toBe(1.6);
    expect(terrainExaggerationForZoom(19)).toBe(1.25);
    expect(terrainExaggerationForZoom(Number.NaN)).toBe(1.6);
  });

  it("pitches less as the camera moves into the block", () => {
    expect(terrainPitchForZoom(9)).toBe(72);
    expect(terrainPitchForZoom(15)).toBe(64);
    expect(terrainPitchForZoom(18)).toBe(58);
  });
});

describe("flood volume display", () => {
  it("prefers modeled depth and falls back to the risk band", () => {
    expect(floodDepthMeters(zone({ flood_depth_m: 1.25 }))).toBe(1.25);
    expect(floodDepthMeters(zone({ flood_depth_m: 9 }))).toBe(4);
    expect(floodDepthMeters(zone({ flood_depth_m: -2 }))).toBe(0);
    expect(floodDepthMeters(zone({ level: "severe" }))).toBe(2.4);
    expect(floodDepthMeters(zone({ level: "moderate" }))).toBe(0.45);
  });

  it("scales extrusion with terrain exaggeration inside a readable range", () => {
    const expression = JSON.stringify(floodExtrusionHeightExpression(1.6));
    expect(expression).toContain('"case"');
    expect(expression).toContain(String(MIN_FLOOD_DISPLAY_M));
    expect(expression).toContain(String(MAX_FLOOD_DISPLAY_M));
    expect(expression).toContain("1.6");
    expect(JSON.stringify(floodExtrusionHeightExpression(0.2))).toContain(
      '"*",["get","depth_m"],1'
    );
  });

  it("keeps polygon order and modeled depth on each cell", () => {
    const collection = floodVolumeGeoJSON([
      zone({ flood_depth_m: 0.8, level: "moderate" }),
      zone({ polygon: [[0, 0], [1, 0]], level: "low" }),
    ]);
    expect(collection.features).toHaveLength(1);
    expect(collection.features[0].properties.depth_m).toBe(0.8);
    expect(collection.features[0].geometry.coordinates[0][0]).toEqual([
      -74.01, 40.7,
    ]);
  });
});
