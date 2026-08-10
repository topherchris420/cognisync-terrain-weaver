import { describe, it, expect } from "vitest";
import {
  RUNOFF_COEFFICIENT,
  MAX_SIMULATION_AREA_KM2,
  boundsToSimBBox,
  runoffCoefficient,
  estimateRunoffVolumeM3,
  getFlowColor,
  runPairedRealitySimulation,
  runRealitySimulation,
} from "./simulation";
import { bboxAreaKm2, type BBox } from "./geo";
import type { LandCover } from "./types";
import type {
  SimulationRequestV2,
  SimulationResponseV2,
} from "./simulation-types";

// A ~1km-ish box near Manhattan used across the volume tests.
const BOX: BBox = [
  [-74.0, 40.75],
  [-73.99, 40.76],
];

const cover = (partial: Partial<LandCover> = {}): LandCover => ({
  pavement: 0,
  buildings: 0,
  vegetation: 0,
  water: 0,
  soil: 0,
  ...partial,
});

describe("boundsToSimBBox", () => {
  it("maps [[w,s],[e,n]] to {north,south,east,west}", () => {
    expect(boundsToSimBBox(BOX)).toEqual({
      north: 40.76,
      south: 40.75,
      east: -73.99,
      west: -74.0,
    });
  });
});

describe("runoffCoefficient", () => {
  it("returns 0 for an empty cover mix", () => {
    expect(runoffCoefficient(cover())).toBe(0);
  });

  it("returns the class coefficient for a single-class tile", () => {
    expect(runoffCoefficient(cover({ pavement: 100 }))).toBeCloseTo(
      RUNOFF_COEFFICIENT.pavement,
      5
    );
    expect(runoffCoefficient(cover({ vegetation: 100 }))).toBeCloseTo(
      RUNOFF_COEFFICIENT.vegetation,
      5
    );
  });

  it("is share-weighted between classes", () => {
    const c = runoffCoefficient(cover({ pavement: 50, vegetation: 50 }));
    expect(c).toBeCloseTo(
      (RUNOFF_COEFFICIENT.pavement + RUNOFF_COEFFICIENT.vegetation) / 2,
      5
    );
  });

  it("normalizes when shares don't sum to 100", () => {
    // Only 40% of the tile is classified; the coefficient is over what's there.
    expect(runoffCoefficient(cover({ pavement: 20, vegetation: 20 }))).toBeCloseTo(
      (RUNOFF_COEFFICIENT.pavement + RUNOFF_COEFFICIENT.vegetation) / 2,
      5
    );
  });

  it("impervious cover runs off more than vegetated cover", () => {
    expect(runoffCoefficient(cover({ pavement: 100 }))).toBeGreaterThan(
      runoffCoefficient(cover({ vegetation: 100 }))
    );
  });

  it("stays within 0–1", () => {
    const c = runoffCoefficient(
      cover({ pavement: 40, buildings: 30, vegetation: 20, soil: 10 })
    );
    expect(c).toBeGreaterThanOrEqual(0);
    expect(c).toBeLessThanOrEqual(1);
  });
});

describe("estimateRunoffVolumeM3", () => {
  it("is zero when there is no rain", () => {
    expect(estimateRunoffVolumeM3(cover({ pavement: 100 }), 0, BOX)).toBe(0);
  });

  it("matches V = rainfall_m x C x area_m2", () => {
    const rainfallMm = 50;
    const areaM2 = bboxAreaKm2(BOX) * 1e6;
    const expected = (rainfallMm / 1000) * RUNOFF_COEFFICIENT.pavement * areaM2;
    expect(estimateRunoffVolumeM3(cover({ pavement: 100 }), rainfallMm, BOX)).toBeCloseTo(
      expected,
      3
    );
  });

  it("scales linearly with rainfall", () => {
    const c = cover({ pavement: 60, vegetation: 40 });
    const v50 = estimateRunoffVolumeM3(c, 50, BOX);
    const v100 = estimateRunoffVolumeM3(c, 100, BOX);
    expect(v100).toBeCloseTo(v50 * 2, 3);
  });

  it("more impervious tiles shed more volume for the same storm", () => {
    const paved = estimateRunoffVolumeM3(cover({ pavement: 100 }), 40, BOX);
    const green = estimateRunoffVolumeM3(cover({ vegetation: 100 }), 40, BOX);
    expect(paved).toBeGreaterThan(green);
  });
});

describe("getFlowColor", () => {
  it("clamps opacity into a visible range", () => {
    expect(getFlowColor(0)).toBe("rgba(59, 130, 246, 0.2)");
    expect(getFlowColor(1)).toBe("rgba(59, 130, 246, 1)");
    expect(getFlowColor(-5)).toBe("rgba(59, 130, 246, 0.2)");
    expect(getFlowColor(5)).toBe("rgba(59, 130, 246, 1)");
  });
});

describe("MAX_SIMULATION_AREA_KM2", () => {
  it("is a positive, practical cap", () => {
    expect(MAX_SIMULATION_AREA_KM2).toBeGreaterThan(1);
  });
});

const provenance = {
  sourceId: "test-source",
  title: "Test source",
  agency: "Test",
  url: "https://example.test/source",
  accessedAt: "2026-08-10",
  confidence: "high" as const,
  status: "observed" as const,
  caveats: [],
};

function realityRequest(
  id: "now" | "possible",
  surfaceHash = `surface:${id}`
): SimulationRequestV2 {
  return {
    bbox: boundsToSimBBox(BOX),
    storm: {
      id: "storm:test",
      rainfallDepthMm: 50,
      durationMinutes: 60,
      distribution: "uniform",
      resolution: "low",
      includeDrainage: false,
      hash: "storm:fixed",
    },
    surface: {
      id,
      surfaceHash,
      baselineLayerHash: "baseline:fixed",
      modifiers: {
        bbox: boundsToSimBBox(BOX),
        rows: 30,
        cols: 30,
        cells: [],
      },
      provenance: [provenance],
    },
  };
}

function responseFor(request: SimulationRequestV2): SimulationResponseV2 {
  return {
    flow_paths: [
      {
        points: [
          [-74, 40.75],
          [-73.999, 40.751],
        ],
        volume_m3: 12,
        velocity_mps: 1,
      },
    ],
    risk_zones: [],
    impact_points: [],
    metadata: {
      processed_area_km2: 1,
      cells_analyzed: 900,
      computation_time_ms: 5,
    },
    stormHash: request.storm.hash,
    surfaceHash: request.surface.surfaceHash,
    modelVersion: "mannahatta-d8-surface-v2",
    waterBalance: {
      rainfallM3: 100,
      infiltratedM3: 20,
      storedM3: 0,
      runoffM3: 80,
      closureErrorM3: 0,
    },
    optimizationClaimsAllowed: true,
    warnings: [],
    provenance: [provenance],
  };
}

describe("reality simulation client", () => {
  it("validates and maps a V2 response to the canonical reality shape", async () => {
    const request = realityRequest("now");
    const result = await runRealitySimulation(request, async (received) => {
      expect(received).toBe(request);
      return responseFor(request);
    });

    expect(result).toEqual(
      expect.objectContaining({
        stormHash: "storm:fixed",
        surfaceHash: "surface:now",
        modelVersion: "mannahatta-d8-surface-v2",
        flowPaths: responseFor(request).flow_paths,
      })
    );
  });

  it("fails closed when the response identities do not match the request", async () => {
    const request = realityRequest("now");
    await expect(
      runRealitySimulation(request, async () => ({
        ...responseFor(request),
        stormHash: "storm:other",
      }))
    ).rejects.toThrow(/storm identity/i);
  });

  it("fails closed on an unsupported model or open water balance", async () => {
    const request = realityRequest("now");
    await expect(
      runRealitySimulation(request, async () => ({
        ...responseFor(request),
        modelVersion: "unreviewed-model",
      }))
    ).rejects.toThrow(/model identity/i);

    await expect(
      runRealitySimulation(request, async () => ({
        ...responseFor(request),
        waterBalance: {
          ...responseFor(request).waterBalance,
          runoffM3: 70,
        },
      }))
    ).rejects.toThrow(/water balance does not close/i);
  });

  it("runs distinct surfaces under one immutable storm", async () => {
    const now = realityRequest("now");
    const possible = realityRequest("possible");
    const [nowResult, possibleResult] =
      await runPairedRealitySimulation(
        now,
        possible,
        async (request) => responseFor(request)
      );

    expect(nowResult.stormHash).toBe(possibleResult.stormHash);
    expect(nowResult.surfaceHash).not.toBe(possibleResult.surfaceHash);
  });

  it("rejects a pair before transport when storm or baseline identity differs", async () => {
    const now = realityRequest("now");
    const possible = realityRequest("possible");
    possible.storm = { ...possible.storm, hash: "storm:other" };
    const transport = vi.fn(async (request: SimulationRequestV2) =>
      responseFor(request)
    );

    await expect(
      runPairedRealitySimulation(now, possible, transport)
    ).rejects.toThrow(/same storm/i);
    expect(transport).not.toHaveBeenCalled();
  });
});
