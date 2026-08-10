import { stableHash } from "./hashing";
import type {
  CounterfactualSession,
  Epoch,
  InterventionFeature,
  InterventionType,
  RealitySimulation,
  RealitySurface,
  SpatialContextSnapshot,
  StormDefinition,
} from "./types";
import type { AnalysisRecord } from "@/lib/types";

export type AnalyzePhase = CounterfactualSession["phase"];

export type CounterfactualAction =
  | { type: "MAP_READY" }
  | { type: "ANALYSIS_STARTED"; requestId: string }
  | {
      type: "ANALYSIS_SUCCEEDED";
      analysis: AnalysisRecord;
      baseline: RealitySurface;
      storm: StormDefinition;
    }
  | { type: "ANALYSIS_FAILED"; requestId: string; message: string }
  | {
      type: "SPATIAL_CONTEXT_SUCCEEDED";
      requestId: string;
      context: SpatialContextSnapshot;
    }
  | { type: "SPATIAL_CONTEXT_FAILED"; requestId: string; message: string }
  | { type: "TOOL_SELECTED"; tool: InterventionType | null }
  | {
      type: "INTERVENTIONS_CHANGED";
      features: InterventionFeature[];
      surface: RealitySurface;
    }
  | { type: "NOW_SIMULATION_SUCCEEDED"; result: RealitySimulation }
  | { type: "POSSIBLE_SIMULATION_STARTED" }
  | { type: "POSSIBLE_SIMULATION_SUCCEEDED"; result: RealitySimulation }
  | { type: "STORM_PLAYBACK_CHANGED"; playing: boolean; progress: number }
  | { type: "TEMPORAL_CHANGED"; epoch: Epoch }
  | { type: "COMPARE_OPENED" }
  | { type: "COMPARE_CLOSED" }
  | { type: "RESET" };

function createEmptySurface(id: "now" | "possible"): RealitySurface {
  const interventionHash = stableHash({ id, interventions: [] as unknown[] });
  const baselineLayerHash = stableHash({ id, baseline: "empty" });

  return {
    id,
    baselineLayerHash,
    interventionHash,
    surfaceHash: stableHash({ baselineLayerHash, interventionHash, id }),
    interventions: [],
    modifiers: {
      bbox: { north: 0, south: 0, east: 0, west: 0 },
      rows: 0,
      cols: 0,
      cells: [],
    },
    provenance: [],
    warnings: [],
  };
}

function cloneNowSurface(surface: RealitySurface): RealitySurface {
  return {
    ...surface,
    id: "now",
    interventions: [...surface.interventions],
    modifiers: {
      ...surface.modifiers,
      cells: [...surface.modifiers.cells],
    },
    provenance: [...surface.provenance],
    warnings: [...surface.warnings],
  };
}

function clonePossibleSurface(surface: RealitySurface): RealitySurface {
  return {
    ...surface,
    id: "possible",
    interventions: [...surface.interventions],
    modifiers: {
      ...surface.modifiers,
      cells: [...surface.modifiers.cells],
    },
    provenance: [...surface.provenance],
    warnings: [...surface.warnings],
  };
}

function getEditPhase(
  activeTool: InterventionType | null,
  possibleSurface: RealitySurface
): AnalyzePhase {
  if (activeTool) {
    return "edit";
  }

  return possibleSurface.interventions.length === 0 ? "edit-prompt" : "edit";
}

function matchesSurface(
  result: RealitySimulation,
  surface: RealitySurface | null
): boolean {
  return surface !== null && result.surfaceHash === surface.surfaceHash;
}

function matchesSessionStorm(
  state: CounterfactualSession,
  result: RealitySimulation
): boolean {
  return state.storm !== null && result.stormHash === state.storm.hash;
}

function isModeledProjection(state: CounterfactualSession): boolean {
  if (state.nowSimulation === null || state.possibleSimulation === null) {
    return false;
  }

  if (!matchesSessionStorm(state, state.nowSimulation)) {
    return false;
  }

  if (!matchesSessionStorm(state, state.possibleSimulation)) {
    return false;
  }

  if (!matchesSurface(state.nowSimulation, state.nowSurface)) {
    return false;
  }

  if (!matchesSurface(state.possibleSimulation, state.possibleSurface)) {
    return false;
  }

  return state.nowSimulation.modelVersion === state.possibleSimulation.modelVersion;
}

function nextCompareState(state: CounterfactualSession): CounterfactualSession {
  if (!state.compareOpen) {
    return state;
  }

  if (selectCanCompare(state)) {
    return {
      ...state,
      phase: "compare",
    };
  }

  return {
    ...state,
    compareOpen: false,
    phase: getEditPhase(state.activeTool, state.possibleSurface),
  };
}

export function createCounterfactualSession(): CounterfactualSession {
  return {
    phase: "boot",
    requestId: null,
    analysis: null,
    viewport: {
      center: [0, 0],
      zoom: 0,
      bearing: 0,
      pitch: 0,
    },
    spatialContext: null,
    storm: null,
    epoch: "2026",
    activeTool: null,
    nowSurface: createEmptySurface("now"),
    possibleSurface: createEmptySurface("possible"),
    nowSimulation: null,
    possibleSimulation: null,
    optimization: null,
    playback: { playing: false, progress: 0 },
    compareOpen: false,
    lastError: null,
  };
}

export function counterfactualReducer(
  state: CounterfactualSession,
  action: CounterfactualAction
): CounterfactualSession {
  switch (action.type) {
    case "MAP_READY":
      return state.phase === "boot"
        ? {
            ...state,
            phase: "edit-prompt",
          }
        : state;

    case "ANALYSIS_STARTED":
      return {
        ...state,
        phase: "analyzing",
        requestId: action.requestId,
        spatialContext: null,
        storm: null,
        epoch: "2026",
        activeTool: null,
        nowSurface: createEmptySurface("now"),
        possibleSurface: createEmptySurface("possible"),
        nowSimulation: null,
        possibleSimulation: null,
        optimization: null,
        playback: { playing: false, progress: 0 },
        compareOpen: false,
        lastError: null,
      };

    case "ANALYSIS_SUCCEEDED":
      return {
        ...state,
        phase: "storm-now",
        requestId: state.requestId,
        analysis: action.analysis,
        spatialContext: null,
        storm: action.storm,
        epoch: "2026",
        activeTool: null,
        nowSurface: cloneNowSurface(action.baseline),
        possibleSurface: clonePossibleSurface(action.baseline),
        nowSimulation: null,
        possibleSimulation: null,
        optimization: null,
        playback: { playing: false, progress: 0 },
        compareOpen: false,
        lastError: null,
      };

    case "ANALYSIS_FAILED":
      if (state.requestId !== action.requestId) {
        return state;
      }

      return {
        ...state,
        phase: "error",
        requestId: null,
        lastError: action.message,
      };

    case "SPATIAL_CONTEXT_SUCCEEDED":
      if (state.requestId !== action.requestId) {
        return state;
      }

      return {
        ...state,
        spatialContext: action.context,
      };

    case "SPATIAL_CONTEXT_FAILED":
      if (state.requestId !== action.requestId) {
        return state;
      }

      return {
        ...state,
        lastError: action.message,
      };

    case "TOOL_SELECTED":
      return {
        ...state,
        activeTool: action.tool,
        phase: getEditPhase(action.tool, state.possibleSurface),
      };

    case "INTERVENTIONS_CHANGED": {
      const possibleSurface = clonePossibleSurface({
        ...action.surface,
        id: "possible",
        interventions: action.features,
      });

      return {
        ...state,
        phase: getEditPhase(state.activeTool, possibleSurface),
        possibleSurface,
        possibleSimulation: null,
        optimization: null,
        playback: { playing: false, progress: 0 },
        compareOpen: false,
      };
    }

    case "NOW_SIMULATION_SUCCEEDED":
      if (!matchesSessionStorm(state, action.result) || !matchesSurface(action.result, state.nowSurface)) {
        return state;
      }

      return nextCompareState({
        ...state,
        phase: "edit-prompt",
        nowSimulation: action.result,
      });

    case "POSSIBLE_SIMULATION_STARTED":
      return {
        ...state,
        phase: "storm-possible",
      };

    case "POSSIBLE_SIMULATION_SUCCEEDED":
      if (!matchesSessionStorm(state, action.result) || !matchesSurface(action.result, state.possibleSurface)) {
        return state;
      }

      if (
        state.nowSimulation !== null &&
        state.nowSimulation.modelVersion !== action.result.modelVersion
      ) {
        return state;
      }

      return nextCompareState({
        ...state,
        phase: state.compareOpen ? "compare" : "edit",
        possibleSimulation: action.result,
      });

    case "STORM_PLAYBACK_CHANGED":
      return {
        ...state,
        playback: {
          playing: action.playing,
          progress: action.progress,
        },
      };

    case "TEMPORAL_CHANGED":
      return {
        ...state,
        epoch: action.epoch,
        compareOpen: action.epoch === "future" ? state.compareOpen : false,
        phase:
          action.epoch === "future" && state.compareOpen && selectCanCompare(state)
            ? "compare"
            : state.phase === "compare"
            ? getEditPhase(state.activeTool, state.possibleSurface)
            : state.phase,
      };

    case "COMPARE_OPENED":
      if (!selectCanCompare(state)) {
        return state;
      }

      return {
        ...state,
        compareOpen: true,
        phase: "compare",
      };

    case "COMPARE_CLOSED":
      return {
        ...state,
        compareOpen: false,
        phase: getEditPhase(state.activeTool, state.possibleSurface),
      };

    case "RESET":
      return {
        ...createCounterfactualSession(),
        viewport: state.viewport,
      };

    default:
      return state;
  }
}

export function selectCanCompare(state: CounterfactualSession): boolean {
  if (!isModeledProjection(state)) {
    return false;
  }

  return state.nowSimulation!.surfaceHash !== state.possibleSimulation!.surfaceHash;
}

export function selectProjectedStatus(
  state: CounterfactualSession
): "estimated" | "modeled" {
  return isModeledProjection(state) ? "modeled" : "estimated";
}
