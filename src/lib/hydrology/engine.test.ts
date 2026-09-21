import { describe, expect, it } from "vitest";
import { decodeTerrarium, encodeTerrarium } from "./terrarium";
import {
  designStormHydrograph,
  hydrographPeakM3s,
  hydrographVolumeM3,
} from "./hydrograph";
import { syntheticElevation } from "./dem";
import { routeWatershed } from "./engine";
import { LOCAL_GRID } from "./types";
import type { LandCover } from "@/lib/types";
import type { LocalStormInput } from "./types";
import { rasterizeSurfaceModifiers } from "@/lib/counterfactual/modifiers";
import type { InterventionFeature } from "@/lib/counterfactual/types";

const BBOX = {
  north: 40.712,
  south: 40.703,
  east: -74.004,
  west: -74.014,
};

const cover = (partial: Partial<LandCover> = {}): LandCover => ({
  pavement: 0,
  buildings: 0,
  vegetation: 0,
  water: 0,
  soil: 0,
  ...partial,
});

function input(
  landCover: LandCover,
  extras: Partial<LocalStormInput> = {}
): LocalStormInput & { elevation: NonNullable<LocalStormInput["elevation"]> } {
  const size = LOCAL_GRID.low;
  return {
    bbox: BBOX,
    rainfallDepthMm: 50,
    durationMinutes: 60,
    resolution: "low",
    landCover,
    surfaceId: "now",
    stormHash: "storm:test",
    surfaceHash: "surface:test",
    elevation: syntheticElevation(BBOX, size, size),
    ...extras,
  };
}

describe("terrarium encoding", () => {
  it("round-trips sea level and typical urban elevations", () => {
    for (const z of [0, 4.2, 18, 100, 412.5]) {
      const [r, g, b] = encodeTerrarium(z);
      expect(decodeTerrarium(r, g, b)).toBeCloseTo(z, 2);
    }
  });
});

describe("design storm hydrograph", () => {
  it("conserves runoff volume and peaks during the rising limb", () => {
    const runoff = 12_840;
    const series = designStormHydrograph(runoff, 50, 60);
    expect(hydrographVolumeM3(series)).toBeCloseTo(runoff, 0);
    const peak = hydrographPeakM3s(series);
    const peakAt = series.find((point) => point.qM3s === peak)!;
    expect(peakAt.tMin).toBeGreaterThan(15);
    expect(peakAt.tMin).toBeLessThan(40);
    expect(series[0].qM3s).toBe(0);
    expect(series.at(-1)?.qM3s).toBe(0);
  });
});

describe("local D8 hydrology", () => {
  it("closes the water balance", () => {
    const result = routeWatershed(input(cover({ pavement: 60, vegetation: 40 })));
    const { rainfallM3, infiltratedM3, storedM3, runoffM3, closureErrorM3 } =
      result.waterBalance;
    expect(rainfallM3).toBeGreaterThan(0);
    expect(runoffM3 + infiltratedM3 + storedM3).toBeCloseTo(rainfallM3, 6);
    expect(closureErrorM3).toBeLessThan(1e-6);
    expect(result.metadata.runoff_volume_m3).toBeCloseTo(runoffM3, 6);
  });

  it("sheds more runoff from pavement than from vegetation", () => {
    const paved = routeWatershed(input(cover({ pavement: 100 })));
    const green = routeWatershed(input(cover({ vegetation: 100 })));
    expect(paved.waterBalance.runoffM3).toBeGreaterThan(green.waterBalance.runoffM3 * 3);
    expect(green.waterBalance.infiltratedM3).toBeGreaterThan(paved.waterBalance.infiltratedM3);
  });

  it("reduces runoff when interventions raise cell retention", () => {
    const size = LOCAL_GRID.low;
    const feature: InterventionFeature = {
      id: "swale-1",
      type: "bioswales",
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-74.014, 40.703],
          [-74.004, 40.703],
          [-74.004, 40.712],
          [-74.014, 40.712],
          [-74.014, 40.703],
        ]],
      },
      areaM2: 1,
      parameters: {
        retentionFractionDelta: 0.5,
        storageDeltaMm: 0,
        roughnessDelta: 0,
        calibrationProvenance: [],
      },
      eligibility: {
        eligible: true,
        validGeometry: {
          type: "Polygon",
          coordinates: [[
            [-74.014, 40.703],
            [-74.004, 40.703],
            [-74.004, 40.712],
            [-74.014, 40.712],
            [-74.014, 40.703],
          ]],
        },
        invalidGeometry: null,
        validAreaM2: 1,
        invalidAreaM2: 0,
        reasonCodes: [],
        confidence: "high",
        provenance: [],
        caveats: [],
      },
      provenance: [],
    };
    const modifiers = rasterizeSurfaceModifiers([feature], BBOX, size, size);
    expect(modifiers.cells.length).toBeGreaterThan(0);

    const now = routeWatershed(input(cover({ pavement: 80, vegetation: 20 })));
    const possible = routeWatershed(
      input(cover({ pavement: 80, vegetation: 20 }), {
        surfaceId: "possible",
        surfaceHash: "surface:edited",
        modifiers,
      })
    );
    expect(possible.waterBalance.runoffM3).toBeLessThan(now.waterBalance.runoffM3);
    expect(possible.elevationHash).toBe(now.elevationHash);
    expect(possible.flow_paths.length).toBeGreaterThan(0);
    expect(possible.risk_zones.length).toBeGreaterThan(0);
  });

  it("is deterministic for a sealed storm and terrain", () => {
    const first = routeWatershed(input(cover({ buildings: 40, pavement: 30, vegetation: 30 })));
    const second = routeWatershed(input(cover({ buildings: 40, pavement: 30, vegetation: 30 })));
    expect(second.elevationHash).toBe(first.elevationHash);
    expect(second.waterBalance.runoffM3).toBe(first.waterBalance.runoffM3);
    expect(second.flow_paths[0]?.points).toEqual(first.flow_paths[0]?.points);
  });
});
