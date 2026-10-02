import { stableHash } from "./counterfactual/hashing";
import { rasterizeSurfaceModifiers } from "./counterfactual/modifiers";
import type { InterventionFeature } from "./counterfactual/types";
import { routeWatershed } from "./hydrology/engine";
import { LOCAL_HYDROLOGY_MODEL, type ElevationGrid, type SimExtent } from "./hydrology/types";
import type { SimulationResponse } from "./simulation-types";
import { verifyStormSeal, type StormSeal } from "./storm-identity";
import type { LandCover } from "./types";
import { SUBSTRATE_NONE, type SubstrateEvidence } from "./urban-substrate/identity";
import { verifySubstrateIdentity, type SubstrateMismatch, type SubstrateReader } from "./urban-substrate/replay";

/**
 * EXPORT → IMPORT → VERIFY INPUTS → RERUN → COMPARE.
 *
 * Replays a routed NOW / POSSIBLE pair from an experiment export and reports
 * every check separately, so a failure says exactly what no longer holds.
 * A result from an older routing model is re-run with the current one and
 * reported as a comparison, not as a reproduction.
 *
 * An experiment that used an urban substrate is replayed only against that
 * exact substrate: every recorded tile must be found and must hash to the
 * recorded value. Current data is never substituted.
 */
export interface ReplayCheck {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface ReplayReport {
  reproduced: boolean;
  sameModel: boolean;
  checks: ReplayCheck[];
  /** Substrate tiles or manifest that could not be reconstructed, for diagnostics. */
  substrateMismatches: SubstrateMismatch[];
  rerun: { now: SimulationResponse; possible: SimulationResponse | null } | null;
}

export interface ReplayOptions {
  /** Where to find the substrate the experiment claims (e.g. public/substrate/<label>). */
  substrate?: SubstrateReader | null;
}

interface ReplayableExport {
  schema: string;
  evidenceHash: string;
  study: { landCover: LandCover };
  storm: StormSeal | null;
  interventions: InterventionFeature[];
  inputs?: {
    extent: SimExtent | null;
    elevation: (Omit<ElevationGrid, "warnings"> & { warnings?: string[] }) | null;
  };
  results: { now: SimulationResponse | null; possible: SimulationResponse | null };
  substrate?: SubstrateEvidence | null;
  [key: string]: unknown;
}

const RESOLUTION_BY_SIZE: Record<number, "low" | "medium" | "high"> = { 36: "low", 72: "medium", 120: "high" };

/** Relative agreement for replayed volumes; exact arithmetic should match to rounding. */
const TOLERANCE = 1e-9;

function close(a: number | undefined, b: number | undefined) {
  if (a === undefined || b === undefined) return false;
  return Math.abs(a - b) <= TOLERANCE * Math.max(1, Math.abs(a), Math.abs(b));
}

export function replayExperiment(exported: ReplayableExport, options: ReplayOptions = {}): ReplayReport {
  const checks: ReplayCheck[] = [];
  const add = (id: string, label: string, passed: boolean, detail: string) => checks.push({ id, label, passed, detail });
  let substrateMismatches: SubstrateMismatch[] = [];

  const { evidenceHash, ...evidence } = exported;
  const recomputed = stableHash(evidence);
  add("evidence-hash", "Evidence hash", recomputed === evidenceHash, recomputed === evidenceHash ? evidenceHash : `file says ${evidenceHash}, content hashes to ${recomputed}`);

  const storm = exported.storm;
  add("storm-seal", "Storm seal", Boolean(storm && verifyStormSeal(storm)), storm ? `seed ${storm.seed}` : "no storm in file");

  const extent = exported.inputs?.extent ?? null;
  const grid = exported.inputs?.elevation ?? null;
  const now = exported.results.now;
  add("inputs-present", "Extent and elevation embedded", Boolean(extent && grid && now), extent && grid ? `${grid.rows}×${grid.cols} grid` : "missing: export was made without replay inputs");

  // The substrate the runs recorded must be the one the export describes, and it must reconstruct.
  const recordedSubstrate = now?.metadata.substrate_hash;
  const described = exported.substrate ?? null;
  if (!described) {
    const none = recordedSubstrate === undefined || recordedSubstrate === SUBSTRATE_NONE;
    add("substrate", "Urban substrate", none, none ? (recordedSubstrate === undefined ? "not recorded (export predates substrate identity)" : "none consulted") : `runs claim ${recordedSubstrate}, which the export does not describe`);
  } else if (described.state.status !== "loaded") {
    const consistent = recordedSubstrate === undefined || recordedSubstrate === described.state.identityHash;
    add("substrate", "Urban substrate", consistent, `${described.state.status}: ${described.state.reason}${consistent ? "" : ` (runs recorded ${recordedSubstrate})`}`);
  } else {
    const consistent = recordedSubstrate === described.state.identityHash;
    add("substrate-runs", "Runs used the described substrate", consistent, consistent ? described.state.identityHash : `runs recorded ${recordedSubstrate ?? "(nothing)"}, export describes ${described.state.identityHash}`);
    const verification = verifySubstrateIdentity(described.state, options.substrate ?? null);
    for (const check of verification.checks) add(check.id, check.label, check.passed, check.detail);
    substrateMismatches = verification.mismatches;
  }
  if (!storm || !extent || !grid || !now) return { reproduced: false, sameModel: false, checks, substrateMismatches, rerun: null };

  const gridHash = stableHash(grid.values);
  add("elevation-hash", "Elevation grid identity", gridHash === grid.hash && gridHash === now.metadata.elevation_hash, `${gridHash}${gridHash === now.metadata.elevation_hash ? "" : ` ≠ routed ${now.metadata.elevation_hash}`}`);

  const elevation: ElevationGrid = { ...grid, warnings: grid.warnings ?? [] };
  const resolution = RESOLUTION_BY_SIZE[grid.rows];
  const base = {
    bbox: extent,
    rainfallDepthMm: storm.storm.rainfallDepthMm,
    durationMinutes: storm.storm.durationMinutes,
    resolution,
    landCover: exported.study.landCover,
    stormHash: storm.storm.hash,
    elevation,
    // Re-route under the substrate identity the runs recorded (verified above).
    ...(recordedSubstrate !== undefined ? { substrateHash: recordedSubstrate } : {}),
  };
  const rerunNow = routeWatershed({ ...base, surfaceId: "now", surfaceHash: now.metadata.surface_hash ?? "now" });
  const possible = exported.results.possible;
  const rerunPossible = possible
    ? routeWatershed({
        ...base,
        surfaceId: "possible",
        surfaceHash: possible.metadata.surface_hash ?? "possible",
        modifiers: rasterizeSurfaceModifiers(exported.interventions, extent, grid.rows, grid.cols),
        expectedElevationHash: rerunNow.elevationHash,
      })
    : null;

  const sameModel = now.metadata.model === LOCAL_HYDROLOGY_MODEL;
  add("model", "Routing model version", sameModel, sameModel ? LOCAL_HYDROLOGY_MODEL : `exported with ${now.metadata.model ?? "unknown"}, replayed with ${LOCAL_HYDROLOGY_MODEL}: a comparison, not a reproduction`);

  const compare = (label: string, original: SimulationResponse, rerun: SimulationResponse) => {
    for (const key of ["rainfall_volume_m3", "infiltrated_volume_m3", "runoff_volume_m3", "ponded_volume_m3", "outflow_volume_m3"] as const) {
      const a = original.metadata[key];
      const b = rerun.metadata[key];
      if (a === undefined && key.startsWith("p")) continue; // not recorded by routing v1
      if (a === undefined && key.startsWith("o")) continue;
      add(`${label}-${key}`, `${label.toUpperCase()} ${key.replace(/_/g, " ")}`, close(a, b), `exported ${a ?? "—"}, replayed ${b}`);
    }
  };
  compare("now", now, rerunNow);
  if (possible && rerunPossible) {
    compare("possible", possible, rerunPossible);
    add(
      "treatment",
      "Intervention surface identity",
      possible.metadata.modifier_hash === undefined || possible.metadata.modifier_hash === rerunPossible.metadata.modifier_hash,
      possible.metadata.modifier_hash === undefined ? "not recorded by this export" : `${rerunPossible.metadata.modifier_hash}`,
    );
  }
  return {
    reproduced: checks.every((c) => c.passed),
    sameModel,
    checks,
    substrateMismatches,
    rerun: { now: rerunNow, possible: rerunPossible },
  };
}
