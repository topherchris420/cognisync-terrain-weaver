import { describe, expect, it } from "vitest";
import { syntheticElevation } from "@/lib/hydrology/dem";
import { routeWatershed } from "@/lib/hydrology/engine";
import { fillAndSpill, isReceivingWater } from "@/lib/hydrology/conditioning";
import { LOCAL_GRID, type ElevationGrid, type LocalStormResult } from "@/lib/hydrology/types";
import type { LandCover } from "@/lib/types";
import { rasterizeSurfaceModifiers } from "./modifiers";
import { spatialDifference } from "./difference";
import { interventionFromGeometry } from "./intervention-feature";
import { sketchAlongFlowPaths, type FlowSketchInput } from "./flow-sketch";

const BBOX = { north: 40.712, south: 40.703, east: -74.004, west: -74.014 };
const COVER: LandCover = { pavement: 0.5, buildings: 0.3, vegetation: 0.15, water: 0, soil: 0.05 };
const RAIN_MM = 50;
const SIZE = LOCAL_GRID.medium;

function route(elevation: ElevationGrid, modifiers?: ReturnType<typeof rasterizeSurfaceModifiers>): LocalStormResult {
  return routeWatershed({
    bbox: BBOX,
    rainfallDepthMm: RAIN_MM,
    durationMinutes: 60,
    resolution: "medium",
    landCover: COVER,
    surfaceId: modifiers ? "possible" : "now",
    stormHash: "storm:test",
    surfaceHash: modifiers ? "surface:possible" : "surface:now",
    elevation,
    modifiers,
  });
}

function sketchInput(elevation: ElevationGrid, now = route(elevation)): FlowSketchInput {
  return { extent: BBOX, elevation: elevation.values, cells: now.cells, rainfallDepthMm: RAIN_MM };
}

describe("starting sketch along the modeled flow paths", () => {
  const elevation = syntheticElevation(BBOX, SIZE, SIZE);
  const now = route(elevation);

  it("proposes a handful of bioswale strips, the same ones every time", () => {
    const first = sketchAlongFlowPaths(sketchInput(elevation, now));
    const second = sketchAlongFlowPaths(sketchInput(elevation, now));
    expect(first.length).toBeGreaterThan(0);
    expect(first.length).toBeLessThanOrEqual(6);
    expect(second).toEqual(first);
    for (const shape of first) expect(shape.geometry.type).toBe("Polygon");
  });

  it("lays each strip on a modeled flow path, on land, upstream of more path", () => {
    const shapes = sketchAlongFlowPaths(sketchInput(elevation, now));
    const { accumulation, receivers } = fillAndSpill(elevation.values, now.cells.generatedM3, now.cells.cellAreaM2);
    const threshold = 4 * (RAIN_MM / 1000) * now.cells.cellAreaM2;
    for (const shape of shapes) {
      expect(shape.downstreamCells).toBeGreaterThan(0);
      shape.path.forEach(([row, col], index) => {
        expect(accumulation[row][col]).toBeGreaterThan(threshold);
        expect(isReceivingWater(elevation.values[row][col])).toBe(false);
        // Consecutive cells follow the router's own receivers.
        if (index > 0) expect(receivers[shape.path[index - 1][0]][shape.path[index - 1][1]]).toEqual([row, col]);
      });
    }
  });

  it("sits on the flow paths drawn on the map when they are given", () => {
    const latStep = (BBOX.north - BBOX.south) / SIZE;
    const lngStep = (BBOX.east - BBOX.west) / SIZE;
    const drawn = new Set(
      now.flow_paths.flatMap((path) =>
        path.points.map(([lng, lat]) => `${Math.floor((BBOX.north - lat) / latStep)}:${Math.floor((lng - BBOX.west) / lngStep)}`)
      )
    );
    const shapes = sketchAlongFlowPaths({ ...sketchInput(elevation, now), visiblePaths: now.flow_paths });
    expect(shapes.length).toBeGreaterThan(0);
    for (const shape of shapes) {
      for (const [row, col] of shape.path) expect(drawn.has(`${row}:${col}`)).toBe(true);
    }
  });

  it("falls back to the engine's path threshold when the drawn paths are off this grid", () => {
    const elsewhere = [{ points: [[-73.9, 40.8], [-73.89, 40.81]] as [number, number][] }];
    expect(sketchAlongFlowPaths({ ...sketchInput(elevation, now), visiblePaths: elsewhere })).toEqual(
      sketchAlongFlowPaths(sketchInput(elevation, now))
    );
  });

  it("keeps strips apart so the sketch reads as several distinct changes", () => {
    const shapes = sketchAlongFlowPaths(sketchInput(elevation, now));
    for (let i = 0; i < shapes.length; i += 1) {
      for (let j = i + 1; j < shapes.length; j += 1) {
        for (const [r1, c1] of shapes[i].path) {
          for (const [r2, c2] of shapes[j].path) {
            expect(Math.max(Math.abs(r1 - r2), Math.abs(c1 - c2))).toBeGreaterThanOrEqual(3);
          }
        }
      }
    }
  });

  it("never sketches on receiving water", () => {
    // Drown the lower third of the grid: the router treats it as an outlet.
    const flooded: ElevationGrid = {
      ...elevation,
      values: elevation.values.map((row, r) => row.map((z) => (r > (SIZE * 2) / 3 ? -2 : z))),
    };
    const shapes = sketchAlongFlowPaths(sketchInput(flooded));
    for (const shape of shapes) {
      for (const [row, col] of shape.path) expect(flooded.values[row][col]).toBeGreaterThan(0);
    }
  });

  it("proposes nothing for degenerate or mismatched inputs", () => {
    const tiny = { ...now.cells, rows: 2, cols: 2, generatedM3: [[1, 1], [1, 1]], accumulationM3: [[1, 1], [1, 1]] };
    expect(sketchAlongFlowPaths({ ...sketchInput(elevation, now), cells: tiny, elevation: [[2, 1], [1, 0.5]] })).toEqual([]);
    expect(sketchAlongFlowPaths({ ...sketchInput(elevation, now), elevation: elevation.values.slice(1) })).toEqual([]);
    expect(sketchAlongFlowPaths({ ...sketchInput(elevation, now), rainfallDepthMm: 0 })).toEqual([]);
  });

  it("produces a controlled pair whose reduction travels downstream of the strips", () => {
    const shapes = sketchAlongFlowPaths(sketchInput(elevation, now));
    const features = shapes.map((shape, index) =>
      interventionFromGeometry(shape.geometry, "bioswales", null, BBOX, `sketch-${index}`)
    );
    expect(features.every((feature) => feature.eligibility.eligible)).toBe(true);
    const possible = route(elevation, rasterizeSurfaceModifiers(features, BBOX, SIZE, SIZE));
    expect(possible.waterBalance.runoffM3).toBeLessThan(now.waterBalance.runoffM3);
    const difference = spatialDifference(now, possible);
    expect(difference.status).toBe("controlled");
    if (difference.status !== "controlled") return;
    expect(difference.summary.sourceCells).toBeGreaterThan(0);
    expect(difference.summary.downstreamCells).toBeGreaterThan(0);
    expect(difference.summary.more).toBe(0);
  });
});
