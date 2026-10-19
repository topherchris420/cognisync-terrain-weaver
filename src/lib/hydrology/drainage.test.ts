import { describe, expect, it } from "vitest";
import {
  CATCH_BASIN_EVENT_CAPACITY_M3,
  fetchDrainageGrid,
} from "./drainage";
import { routeWatershed } from "./engine";
import type { ElevationGrid, LocalStormInput } from "./types";
import type { LandCover } from "@/lib/types";

const NYC_BBOX = { north: 40.75, south: 40.72, east: -74.0, west: -74.03 };
const OUTSIDE_BBOX = { north: 51.6, south: 51.4, east: 0.2, west: -0.2 };

function mockFetch(rows: Array<{ latitude: string; longitude: string }>): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(rows), { status: 200 })) as unknown as typeof fetch;
}

describe("fetchDrainageGrid", () => {
  it("rasterises real catch basins onto the sim grid inside NYC", async () => {
    const grid = await fetchDrainageGrid(
      NYC_BBOX,
      4,
      4,
      mockFetch([
        { latitude: "40.745", longitude: "-74.025" },
        { latitude: "40.744", longitude: "-74.024" },
      ])
    );
    expect(grid.status).toBe("observed");
    expect(grid.basins).toBe(2);
    const total = grid.capacityM3.flat().reduce((a, b) => a + b, 0);
    expect(total).toBe(2 * CATCH_BASIN_EVENT_CAPACITY_M3);
  });

  it("reports unavailable outside the wired inventory without fetching", async () => {
    let called = false;
    const spy = (async () => {
      called = true;
      return new Response("[]", { status: 200 });
    }) as unknown as typeof fetch;
    const grid = await fetchDrainageGrid(OUTSIDE_BBOX, 4, 4, spy);
    expect(called).toBe(false);
    expect(grid.status).toBe("unavailable");
    expect(grid.basins).toBe(0);
  });

  it("fails closed to unavailable when the request errors", async () => {
    const failing = (async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    const grid = await fetchDrainageGrid(NYC_BBOX, 4, 4, failing);
    expect(grid.status).toBe("unavailable");
  });
});

describe("routeWatershed with real drainage", () => {
  const impervious: LandCover = {
    pavement: 90,
    buildings: 10,
    vegetation: 0,
    soil: 0,
    water: 0,
  };
  const elevation: ElevationGrid = {
    values: Array.from({ length: 4 }, (_, r) =>
      Array.from({ length: 4 }, (_, c) => 10 - r - c * 0.1)
    ),
    rows: 4,
    cols: 4,
    status: "illustrative",
    hash: "test",
    sourceId: "test",
    warnings: [],
  };
  const baseInput: LocalStormInput = {
    bbox: NYC_BBOX,
    rainfallDepthMm: 50,
    durationMinutes: 60,
    resolution: "low",
    landCover: impervious,
    surfaceId: "now",
    stormHash: "s",
    surfaceHash: "x",
    elevation,
  };

  it("catch basins remove runoff before routing and close the water balance", () => {
    const capacityM3 = Array.from({ length: 4 }, () => Array(4).fill(50));
    const withDrainage = routeWatershed({
      ...baseInput,
      drainage: {
        status: "observed",
        basins: 16,
        capacityM3,
        sourceLabel: "test",
      },
    });
    const without = routeWatershed(baseInput);
    expect(withDrainage.waterBalance.drainedM3).toBeGreaterThan(0);
    expect(withDrainage.waterBalance.runoffM3).toBeLessThan(
      without.waterBalance.runoffM3
    );
    const wb = withDrainage.waterBalance;
    expect(
      wb.rainfallM3 - wb.infiltratedM3 - wb.storedM3 - (wb.drainedM3 ?? 0) - wb.runoffM3
    ).toBeCloseTo(0, 6);
    expect(withDrainage.metadata.drainage_basins).toBe(16);
  });

  it("an observed hyetograph drives the hydrograph shape", () => {
    const result = routeWatershed({
      ...baseInput,
      hyetograph: [
        { tMin: 0, rainMm: 30 },
        { tMin: 60, rainMm: 20 },
      ],
    });
    expect(result.metadata.rainfall_source).toBe("observed");
    // Peak discharge should occur early, tracking the recorded first-hour burst.
    const peakIdx = result.hydrograph.reduce(
      (best, p, i, arr) => (p.qM3s > arr[best].qM3s ? i : best),
      0
    );
    expect(result.hydrograph[peakIdx].tMin).toBeLessThanOrEqual(60);
  });
});
