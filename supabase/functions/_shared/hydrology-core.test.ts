import { describe, expect, it } from "vitest";
import {
  HYDROLOGY_MODEL_VERSION,
  validateSimulationRequest,
  type HydrologyInput,
  type SimulationRequestV2,
} from "./hydrology-contract";
import { runHydrology } from "./hydrology-core";

const bbox = {
  north: 40.71,
  south: 40.7,
  east: -74,
  west: -74.01,
};

const evidence = {
  sourceId: "elevation:test",
  title: "Test elevation",
  agency: "Test",
  url: "https://example.test/elevation",
  accessedAt: "2026-08-10",
  confidence: "high" as const,
  status: "observed" as const,
  caveats: [],
};

function bowl(size: number): number[][] {
  const center = (size - 1) / 2;
  return Array.from({ length: size }, (_, row) =>
    Array.from(
      { length: size },
      (_, col) => (row - center) ** 2 + (col - center) ** 2
    )
  );
}

function request(
  size: 30 | 90 | 180 = 30,
  overrides: Partial<SimulationRequestV2> = {}
): SimulationRequestV2 {
  const resolution = size === 30 ? "low" : size === 90 ? "medium" : "high";
  return {
    bbox,
    storm: {
      id: "storm:test",
      rainfallDepthMm: 50,
      durationMinutes: 60,
      distribution: "uniform",
      resolution,
      includeDrainage: false,
      hash: "storm:fixed",
    },
    surface: {
      id: "now",
      surfaceHash: "surface:now",
      baselineLayerHash: "baseline:fixed",
      modifiers: { bbox, rows: size, cols: size, cells: [] },
      provenance: [evidence],
    },
    ...overrides,
  };
}

function input(
  size: 30 | 90 | 180 = 30,
  overrides: Partial<HydrologyInput> = {}
): HydrologyInput {
  return {
    request: request(size),
    elevation: bowl(size),
    elevationProvenance: evidence,
    elevationStatus: "observed",
    ...overrides,
  };
}

describe("surface-aware D8 hydrology", () => {
  it("routes a fixed bowl grid deterministically", () => {
    const first = runHydrology(input());
    const second = runHydrology(input());

    expect(second).toEqual(first);
    expect(first.modelVersion).toBe(HYDROLOGY_MODEL_VERSION);
    expect(first.elevationHash).toMatch(/^fnv1a64:/);
    expect(first.flow_paths.length).toBeGreaterThan(0);
  });

  it("rejects drainage instead of accepting and ignoring it", () => {
    const candidate = request();
    candidate.storm.includeDrainage = true as false;
    expect(() => validateSimulationRequest(candidate)).toThrow(
      /drainage is not implemented/i
    );
  });

  it.each([30, 90, 180] as const)(
    "runs the supported %i by %i grid",
    (size) => {
      const result = runHydrology(input(size));
      expect(result.metadata.cells_analyzed).toBe(size * size);
    }
  );

  it("cannot increase generated runoff when retention increases", () => {
    const now = runHydrology(input());
    const possibleRequest = request();
    possibleRequest.surface = {
      ...possibleRequest.surface,
      id: "possible",
      surfaceHash: "surface:possible",
      modifiers: {
        ...possibleRequest.surface.modifiers,
        cells: Array.from({ length: 30 * 30 }, (_, index) => ({
          row: Math.floor(index / 30),
          col: index % 30,
          retentionFractionDelta: 0.4,
          storageDeltaMm: 0,
          roughnessDelta: 0,
        })),
      },
    };
    const possible = runHydrology(
      input(30, { request: possibleRequest })
    );

    expect(possible.waterBalance.runoffM3).toBeLessThanOrEqual(
      now.waterBalance.runoffM3
    );
    expect(possible.stormHash).toBe(now.stormHash);
    expect(possible.surfaceHash).not.toBe(now.surfaceHash);
  });

  it("closes the water balance without counting downstream accumulation twice", () => {
    const result = runHydrology(input());
    const balance = result.waterBalance;
    expect(
      balance.rainfallM3 -
        balance.infiltratedM3 -
        balance.storedM3 -
        balance.runoffM3
    ).toBeCloseTo(0, 8);
    expect(balance.closureErrorM3).toBeLessThanOrEqual(
      balance.rainfallM3 * 1e-6
    );
    expect(
      result.flow_paths.reduce((sum, path) => sum + path.volume_m3, 0)
    ).toBeGreaterThan(balance.runoffM3);
  });

  it("caps calibrated storage at rain remaining in the cell", () => {
    const candidate = request();
    candidate.surface.modifiers.cells = [
      {
        row: 0,
        col: 0,
        retentionFractionDelta: 0,
        storageDeltaMm: 5_000,
        roughnessDelta: 0,
        calibrationProvenance: [evidence],
      },
    ];
    const result = runHydrology(input(30, { request: candidate }));
    expect(result.waterBalance.storedM3).toBeGreaterThan(0);
    expect(result.waterBalance.storedM3).toBeLessThan(
      result.waterBalance.rainfallM3
    );
    expect(result.waterBalance.closureErrorM3).toBeLessThan(1e-6);
  });

  it("uses longitude-latitude coordinate order", () => {
    const point = runHydrology(input()).flow_paths[0].points[0];
    expect(point[0]).toBeGreaterThanOrEqual(bbox.west);
    expect(point[0]).toBeLessThanOrEqual(bbox.east);
    expect(point[1]).toBeGreaterThanOrEqual(bbox.south);
    expect(point[1]).toBeLessThanOrEqual(bbox.north);
  });

  it("keeps row zero on the north edge of every spatial output", () => {
    const elevation = Array.from({ length: 30 }, (_, row) =>
      Array.from({ length: 30 }, () => row)
    );
    const result = runHydrology(input(30, { elevation }));
    const riskLatitudes = result.risk_zones.flatMap((zone) =>
      zone.polygon.map((point) => point[1])
    );
    const midpoint = (bbox.north + bbox.south) / 2;

    expect(riskLatitudes.length).toBeGreaterThan(0);
    expect(Math.min(...riskLatitudes)).toBeGreaterThan(midpoint);
  });

  it("marks synthetic fallback elevation as illustrative and non-optimizable", () => {
    const result = runHydrology(
      input(30, { elevationStatus: "illustrative" })
    );
    expect(result.warnings.join(" ")).toMatch(
      /illustrative synthetic elevation/i
    );
    expect(result.optimizationClaimsAllowed).toBe(false);
    expect(result.elevationStatus).toBe("illustrative");
    expect(result.provenance).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceId: evidence.sourceId,
          confidence: "low",
          status: "derived",
        }),
      ])
    );
  });

  it("fails closed when loaded elevation differs from the expected grid", () => {
    const candidate = input();
    candidate.request.expectedElevationHash = "fnv1a64:0000000000000000";
    expect(() => runHydrology(candidate)).toThrow(/elevation identity/i);
  });
});

describe("V2 request validation", () => {
  it("rejects malformed hashes", () => {
    const candidate = request();
    candidate.surface.surfaceHash = " ";
    expect(() => validateSimulationRequest(candidate)).toThrow(/surface hash/i);
  });

  it("rejects out-of-bounds and duplicate modifier cells", () => {
    const outside = request();
    outside.surface.modifiers.cells = [
      {
        row: 30,
        col: 0,
        retentionFractionDelta: 0.2,
        storageDeltaMm: 0,
        roughnessDelta: 0,
      },
    ];
    expect(() => validateSimulationRequest(outside)).toThrow(/bounds/i);

    const duplicate = request();
    duplicate.surface.modifiers.cells = [
      {
        row: 1,
        col: 1,
        retentionFractionDelta: 0.2,
        storageDeltaMm: 0,
        roughnessDelta: 0,
      },
      {
        row: 1,
        col: 1,
        retentionFractionDelta: 0.4,
        storageDeltaMm: 0,
        roughnessDelta: 0,
      },
    ];
    expect(() => validateSimulationRequest(duplicate)).toThrow(/duplicate/i);
  });

  it("rejects unsupported area and mismatched dimensions", () => {
    const huge = request();
    huge.bbox = { north: 41, south: 40, east: -73, west: -74 };
    huge.surface.modifiers.bbox = huge.bbox;
    expect(() => validateSimulationRequest(huge)).toThrow(/50 km/i);

    const result = request();
    expect(() =>
      runHydrology(input(30, { request: result, elevation: bowl(29) }))
    ).toThrow(/dimensions/i);
  });

  it("rejects nonzero uncalibrated storage or roughness", () => {
    const candidate = request();
    candidate.surface.modifiers.cells = [
      {
        row: 0,
        col: 0,
        retentionFractionDelta: 0.2,
        storageDeltaMm: 10,
        roughnessDelta: 0,
      },
    ];
    expect(() => validateSimulationRequest(candidate)).toThrow(
      /calibration provenance/i
    );
  });
});
