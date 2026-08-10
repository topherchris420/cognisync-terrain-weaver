import { describe, expect, it } from "vitest";
import type {
  CounterfactualSession,
  DataProvenance,
  RealitySimulation,
  RealitySurface,
  SpatialContextSnapshot,
  StormDefinition,
} from "./types";
import {
  counterfactualReducer,
  createCounterfactualSession,
  selectCanCompare,
  selectProjectedStatus,
} from "./session";
import type { AnalysisRecord } from "@/lib/types";

const PROVENANCE: DataProvenance = {
  sourceId: "test-source",
  title: "Test provenance",
  agency: "Codex",
  url: "https://example.com/provenance",
  accessedAt: "2026-08-10T00:00:00.000Z",
  confidence: "high",
  status: "modeled",
  caveats: [],
};

function makeAnalysis(id: string): AnalysisRecord {
  return {
    id,
    name: `Analysis ${id}`,
    location_label: "Test site",
    center_lat: 40.7,
    center_lng: -74.0,
    zoom: 14,
    bbox: [
      [-74.01, 40.7],
      [-73.99, 40.72],
    ],
    image_data_url: null,
    land_cover: {
      pavement: 40,
      buildings: 30,
      vegetation: 20,
      water: 5,
      soil: 5,
    },
    absorption_score: 42,
    flood_risk: "moderate",
    recommendations: [],
    ai_notes: null,
    status: "complete",
    created_at: "2026-08-10T00:00:00.000Z",
  };
}

function makeSurface(
  id: "now" | "possible",
  overrides: Partial<RealitySurface> = {}
): RealitySurface {
  return {
    id,
    baselineLayerHash: "surface:baseline",
    interventionHash: id === "possible" ? "surface:possible:interventions" : "surface:now:interventions",
    surfaceHash: id === "possible" ? "surface:possible" : "surface:now",
    interventions: [],
    modifiers: {
      bbox: { north: 40.72, south: 40.7, east: -73.99, west: -74.01 },
      rows: 1,
      cols: 1,
      cells: [],
    },
    provenance: [PROVENANCE],
    warnings: [],
    ...overrides,
  };
}

function makeBaseline(): RealitySurface {
  return makeSurface("now");
}

function makeStorm(overrides: Partial<StormDefinition> = {}): StormDefinition {
  return {
    id: "storm-1",
    rainfallDepthMm: 50,
    durationMinutes: 60,
    distribution: "uniform",
    resolution: "medium",
    includeDrainage: false,
    hash: "storm:default",
    ...overrides,
  };
}

function makeSimulation(
  stormHash: string,
  surfaceHash: string,
  overrides: Partial<RealitySimulation> = {}
): RealitySimulation {
  return {
    stormHash,
    surfaceHash,
    modelVersion: "terrain-model@1",
    flowPaths: [],
    riskZones: [],
    impactPoints: [],
    waterBalance: {
      rainfallM3: 10,
      infiltratedM3: 2,
      storedM3: 1,
      runoffM3: 7,
      closureErrorM3: 0,
    },
    optimizationClaimsAllowed: false,
    warnings: [],
    provenance: [PROVENANCE],
    ...overrides,
  };
}

function makeSpatialContext(): SpatialContextSnapshot {
  return {
    featureCollection: {
      type: "FeatureCollection",
      features: [],
    },
    coverage: {
      status: "complete",
      requestedAreaM2: 100,
      classifiedAreaM2: 100,
    },
    provenance: [PROVENANCE],
    warnings: [],
  };
}

function makeEditedSession(): CounterfactualSession {
  const storm = makeStorm({ hash: "storm:edited" });
  let state = counterfactualReducer(createCounterfactualSession(), {
    type: "ANALYSIS_SUCCEEDED",
    analysis: makeAnalysis("edited"),
    baseline: makeBaseline(),
    storm,
  });

  state = counterfactualReducer(state, {
    type: "INTERVENTIONS_CHANGED",
    features: [],
    surface: makeSurface("possible", {
      interventionHash: "surface:edited:interventions",
      surfaceHash: "surface:edited",
    }),
  });

  state = counterfactualReducer(state, {
    type: "NOW_SIMULATION_SUCCEEDED",
    result: makeSimulation(storm.hash, state.nowSurface!.surfaceHash),
  });

  state = counterfactualReducer(state, {
    type: "POSSIBLE_SIMULATION_SUCCEEDED",
    result: makeSimulation(storm.hash, state.possibleSurface!.surfaceHash),
  });

  state = counterfactualReducer(state, {
    type: "COMPARE_OPENED",
  });

  return state;
}

describe("counterfactual session reducer", () => {
  it("preserves one storm across NOW and POSSIBLE runs", () => {
    const storm = makeStorm({ hash: "storm:fixed" });
    let state = counterfactualReducer(createCounterfactualSession(), {
      type: "ANALYSIS_SUCCEEDED",
      analysis: makeAnalysis("a"),
      baseline: makeBaseline(),
      storm,
    });

    state = counterfactualReducer(state, {
      type: "NOW_SIMULATION_SUCCEEDED",
      result: makeSimulation("storm:fixed", state.nowSurface!.surfaceHash),
    });

    state = counterfactualReducer(state, {
      type: "INTERVENTIONS_CHANGED",
      features: [],
      surface: makeSurface("possible"),
    });

    state = counterfactualReducer(state, {
      type: "POSSIBLE_SIMULATION_SUCCEEDED",
      result: makeSimulation("storm:fixed", state.possibleSurface!.surfaceHash),
    });

    expect(state.storm).toBe(storm);
    expect(selectCanCompare(state)).toBe(true);
  });

  it("clears location-bound edits and results on a new place", () => {
    const next = counterfactualReducer(makeEditedSession(), {
      type: "ANALYSIS_STARTED",
      requestId: "new-place",
    });

    expect(next.possibleSurface.interventions).toEqual([]);
    expect(next.nowSimulation).toBeNull();
    expect(next.possibleSimulation).toBeNull();
    expect(next.compareOpen).toBe(false);
  });

  it("ignores stale request failures and context responses", () => {
    let state = counterfactualReducer(createCounterfactualSession(), {
      type: "ANALYSIS_SUCCEEDED",
      analysis: makeAnalysis("stable"),
      baseline: makeBaseline(),
      storm: makeStorm(),
    });

    state = counterfactualReducer(state, {
      type: "ANALYSIS_STARTED",
      requestId: "fresh",
    });

    const failed = counterfactualReducer(state, {
      type: "ANALYSIS_FAILED",
      requestId: "stale",
      message: "stale failure",
    });

    expect(failed).toBe(state);

    const contextIgnored = counterfactualReducer(state, {
      type: "SPATIAL_CONTEXT_SUCCEEDED",
      requestId: "stale",
      context: makeSpatialContext(),
    });

    expect(contextIgnored).toBe(state);
  });

  it("accepts spatial context that completes after its analysis", () => {
    let state = counterfactualReducer(createCounterfactualSession(), {
      type: "ANALYSIS_STARTED",
      requestId: "current-place",
    });

    state = counterfactualReducer(state, {
      type: "ANALYSIS_SUCCEEDED",
      analysis: makeAnalysis("current-place"),
      baseline: makeBaseline(),
      storm: makeStorm(),
    });

    const context = makeSpatialContext();
    state = counterfactualReducer(state, {
      type: "SPATIAL_CONTEXT_SUCCEEDED",
      requestId: "current-place",
      context,
    });

    expect(state.spatialContext).toBe(context);
  });

  it("keeps the last valid analysis when the latest request fails", () => {
    const analysis = makeAnalysis("kept");
    let state = counterfactualReducer(createCounterfactualSession(), {
      type: "ANALYSIS_SUCCEEDED",
      analysis,
      baseline: makeBaseline(),
      storm: makeStorm(),
    });

    state = counterfactualReducer(state, {
      type: "ANALYSIS_STARTED",
      requestId: "retry",
    });

    state = counterfactualReducer(state, {
      type: "ANALYSIS_FAILED",
      requestId: "retry",
      message: "network down",
    });

    expect(state.analysis).toBe(analysis);
    expect(state.lastError).toBe("network down");
  });

  it("rejects simulation results that do not match the session storm or surface", () => {
    const storm = makeStorm({ hash: "storm:valid" });
    let state = counterfactualReducer(createCounterfactualSession(), {
      type: "ANALYSIS_SUCCEEDED",
      analysis: makeAnalysis("a"),
      baseline: makeBaseline(),
      storm,
    });

    const ignoredNow = counterfactualReducer(state, {
      type: "NOW_SIMULATION_SUCCEEDED",
      result: makeSimulation("storm:wrong", state.nowSurface!.surfaceHash),
    });

    expect(ignoredNow).toBe(state);

    state = counterfactualReducer(state, {
      type: "NOW_SIMULATION_SUCCEEDED",
      result: makeSimulation(storm.hash, state.nowSurface!.surfaceHash),
    });

    const ignoredPossible = counterfactualReducer(state, {
      type: "POSSIBLE_SIMULATION_SUCCEEDED",
      result: makeSimulation(storm.hash, "surface:other"),
    });

    expect(ignoredPossible).toBe(state);
  });

  it("invalidates POSSIBLE simulation and compare state after edits", () => {
    const edited = makeEditedSession();

    const next = counterfactualReducer(edited, {
      type: "INTERVENTIONS_CHANGED",
      features: [],
      surface: makeSurface("possible", {
        interventionHash: "surface:edited:v2",
        surfaceHash: "surface:edited:v2",
      }),
    });

    expect(next.possibleSimulation).toBeNull();
    expect(next.compareOpen).toBe(false);
    expect(selectProjectedStatus(next)).toBe("estimated");
  });

  it("requires matching model versions and distinct surface hashes before comparing", () => {
    const storm = makeStorm({ hash: "storm:fixed" });
    let state = counterfactualReducer(createCounterfactualSession(), {
      type: "ANALYSIS_SUCCEEDED",
      analysis: makeAnalysis("a"),
      baseline: makeBaseline(),
      storm,
    });

    state = counterfactualReducer(state, {
      type: "NOW_SIMULATION_SUCCEEDED",
      result: makeSimulation(storm.hash, state.nowSurface!.surfaceHash, {
        modelVersion: "terrain-model@1",
      }),
    });

    state = counterfactualReducer(state, {
      type: "POSSIBLE_SIMULATION_SUCCEEDED",
      result: makeSimulation(storm.hash, state.possibleSurface!.surfaceHash, {
        modelVersion: "terrain-model@2",
      }),
    });

    expect(selectCanCompare(state)).toBe(false);

    state = counterfactualReducer(state, {
      type: "POSSIBLE_SIMULATION_SUCCEEDED",
      result: makeSimulation(storm.hash, state.nowSurface!.surfaceHash, {
        modelVersion: "terrain-model@1",
      }),
    });

    expect(selectCanCompare(state)).toBe(false);
  });

  it("reports modeled status only after a valid POSSIBLE simulation", () => {
    const storm = makeStorm({ hash: "storm:fixed" });
    let state = counterfactualReducer(createCounterfactualSession(), {
      type: "ANALYSIS_SUCCEEDED",
      analysis: makeAnalysis("a"),
      baseline: makeBaseline(),
      storm,
    });

    expect(selectProjectedStatus(state)).toBe("estimated");

    state = counterfactualReducer(state, {
      type: "NOW_SIMULATION_SUCCEEDED",
      result: makeSimulation(storm.hash, state.nowSurface!.surfaceHash),
    });

    state = counterfactualReducer(state, {
      type: "POSSIBLE_SIMULATION_SUCCEEDED",
      result: makeSimulation(storm.hash, state.possibleSurface!.surfaceHash),
    });

    expect(selectProjectedStatus(state)).toBe("modeled");
  });

  it("reset clears location-bound evidence while preserving the viewport", () => {
    const edited = makeEditedSession();

    const next = counterfactualReducer(edited, {
      type: "RESET",
    });

    expect(next.analysis).toBeNull();
    expect(next.storm).toBeNull();
    expect(next.nowSimulation).toBeNull();
    expect(next.possibleSimulation).toBeNull();
    expect(next.compareOpen).toBe(false);
    expect(next.viewport).toEqual(edited.viewport);
  });
});
