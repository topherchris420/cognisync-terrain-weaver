import { ABSORPTION_WEIGHTS } from "./absorption";
import { ASSUMPTIONS } from "./assumptions/registry";
import { controlledComparison } from "./counterfactual/controlled";
import { stableHash } from "./counterfactual/hashing";
import type { InterventionFeature } from "./counterfactual/types";
import { evidenced } from "./evidence/status";
import { EVIDENCE_LEDGER, ROUTED_ZONES_CAVEAT } from "./evidence/ledger";
import type { ElevationGrid, SimExtent } from "./hydrology/types";
import type { SimulationResponse } from "./simulation-types";
import type { StormSeal } from "./storm-identity";
import { verifyStormSeal } from "./storm-identity";
import { INTERVENTIONS, type Scenario } from "./scenario";
import type { AnalysisRecord } from "./types";
import { modelVersions } from "./validation/experiment";
import { SUBSTRATE_NONE, type SubstrateEvidence } from "./urban-substrate/identity";

/**
 * v3 (2026-10-02): adds the urban substrate an experiment used (identity,
 * tile hashes, sources, coverage, diagnostics). Replay still reads v2.
 */
export const EXPERIMENT_SCHEMA = "mannahatta-experiment-v3";

/** Build identity injected by Vite (VITE_GIT_COMMIT or the checkout's HEAD). */
const CODE_COMMIT: string = (import.meta.env?.VITE_GIT_COMMIT as string | undefined) || "unrecorded";

/**
 * Evidence package for one NOW / POSSIBLE experiment.
 *
 * With the elevation grid embedded, a routed pair can be replayed and
 * verified (`npm run replay -- file.json`): the grid's hash is checked, the
 * storm and interventions are re-applied, and the outputs are compared.
 * Imagery is never embedded, so the land-cover classification itself cannot
 * be replayed; it is carried as an inferred input.
 */
export function buildExperimentExport(input: {
  analysis: AnalysisRecord;
  scenario: Scenario;
  interventions: InterventionFeature[];
  storm: StormSeal | null;
  now: SimulationResponse | null;
  possible: SimulationResponse | null;
  /** The routed extent; required to replay. */
  extent?: SimExtent | null;
  /** The routed elevation grid; embedded to make replay possible. */
  elevation?: ElevationGrid | null;
  /** The urban substrate the study loaded, or why none was available. */
  substrate?: SubstrateEvidence | null;
  question?: string;
  hypothesis?: string | null;
}) {
  if (input.storm && !verifyStormSeal(input.storm))
    throw new Error("Invalid storm seal.");
  if ((input.now || input.possible) && !input.storm)
    throw new Error("Routed results require a storm identity.");
  for (const run of [input.now, input.possible]) {
    if (
      run &&
      (!run.metadata.surface_hash ||
        run.metadata.storm_hash !== input.storm?.storm.hash)
    )
      throw new Error("Routed output does not match the sealed storm.");
  }
  if (
    input.possible &&
    (!input.now ||
      !input.now.metadata.elevation_hash ||
      !input.now.metadata.model ||
      input.now.metadata.elevation_hash !==
        input.possible.metadata.elevation_hash ||
      input.now.metadata.model !== input.possible.metadata.model ||
      input.now.metadata.elevation_status !==
        input.possible.metadata.elevation_status)
  )
    throw new Error(
      "Routed results do not share model and terrain identities.",
    );
  if (input.elevation && input.now && input.elevation.hash !== input.now.metadata.elevation_hash)
    throw new Error("Embedded elevation does not match the routed elevation identity.");
  // Fail closed on substrate identity: a pair must share it, and the export
  // must describe exactly the substrate the runs recorded.
  const runSubstrate = input.now?.metadata.substrate_hash ?? null;
  if (input.possible && input.now && runSubstrate !== (input.possible.metadata.substrate_hash ?? null))
    throw new Error("Routed results do not share an urban substrate identity.");
  if (runSubstrate !== null && runSubstrate !== SUBSTRATE_NONE && runSubstrate !== input.substrate?.state.identityHash)
    throw new Error("Routed results claim an urban substrate the export does not describe.");
  if (input.substrate && runSubstrate !== null && runSubstrate !== input.substrate.state.identityHash)
    throw new Error("The described urban substrate is not the one the routed results used.");

  const analysis = input.analysis;
  const exampleCover = analysis.status === "example";
  const control = input.now && input.possible ? controlledComparison(input.now, input.possible) : null;
  const comparison =
    input.now && input.possible
      ? {
          controlled: control,
          nowRunoffM3: input.now.metadata.runoff_volume_m3 ?? null,
          possibleRunoffM3: input.possible.metadata.runoff_volume_m3 ?? null,
          avoidedRunoffM3:
            input.now.metadata.runoff_volume_m3 !== undefined && input.possible.metadata.runoff_volume_m3 !== undefined
              ? input.now.metadata.runoff_volume_m3 - input.possible.metadata.runoff_volume_m3
              : null,
          changed: input.interventions.map((f) => ({
            id: f.id,
            type: f.type,
            eligibleAreaM2: f.eligibility.validAreaM2,
            retentionFractionDelta: f.parameters.retentionFractionDelta,
          })),
        }
      : null;
  const replayable = Boolean(input.storm && input.now && input.extent && input.elevation);
  const evidence = {
    schema: EXPERIMENT_SCHEMA,
    question:
      input.question ??
      (input.possible
        ? "Under the same sealed storm, terrain and land cover, how much does the drawn intervention change routed runoff?"
        : "What happens when this storm meets this surface?"),
    hypothesis: input.hypothesis ?? null,
    study: {
      id: analysis.id,
      name: analysis.name,
      location: analysis.location_label,
      bbox: analysis.bbox,
      analyzedAt: analysis.created_at,
      dataStatus: analysis.status,
      landCover: analysis.land_cover,
    },
    provenance: {
      landCover: exampleCover ? "illustrative" : "inferred",
      score: "derived",
      storm: "simulated",
      elevation: input.now?.metadata.elevation_status ?? "not-loaded",
      substrate: input.substrate?.state.status ?? "not-consulted",
    },
    /** Every number that matters, with its epistemic status. */
    values: {
      landCover: evidenced(analysis.land_cover, exampleCover ? "illustrative" : "inferred", exampleCover ? "example fixture" : "analyze-terrain classifier", "% of frame"),
      score: evidenced(analysis.absorption_score, exampleCover ? "illustrative" : "modeled", "computeAbsorptionScore", "0–100"),
      retentionWeights: evidenced(ABSORPTION_WEIGHTS, "assumed", "assumption registry: retention.*", "fraction retained"),
      storm: input.storm ? evidenced(input.storm.storm, "assumed", "design storm chosen by the user; not an observed event") : null,
      elevation: input.now
        ? evidenced(input.now.metadata.elevation_hash ?? null, input.now.metadata.elevation_status === "observed" ? "measured" : "illustrative", input.elevation?.sourceId ?? "elevation grid")
        : null,
      nowResult: input.now ? evidenced(input.now.metadata.runoff_volume_m3 ?? null, exampleCover ? "illustrative" : "modeled", input.now.metadata.model ?? "routing engine", "m³ runoff") : null,
      possibleResult: input.possible ? evidenced(input.possible.metadata.runoff_volume_m3 ?? null, "counterfactual", input.possible.metadata.model ?? "routing engine", "m³ runoff") : null,
      unitCosts: evidenced(Object.fromEntries(Object.values(INTERVENTIONS).map((d) => [d.key, d.unitCostUSD])), "assumed", "assumption registry: cost.* (scenario assumptions, unsourced)", "USD per m²"),
    },
    models: { ...modelVersions(), codeCommit: CODE_COMMIT },
    coefficients: ABSORPTION_WEIGHTS,
    interventionAssumptions: INTERVENTIONS,
    assumptionRegistry: ASSUMPTIONS.map((a) => ({ id: a.id, value: a.value, unit: a.unit, basis: a.basis, source: a.source })),
    scenario: input.scenario,
    interventions: input.interventions,
    storm: input.storm,
    inputs: {
      extent: input.extent ?? null,
      elevation: input.elevation
        ? { rows: input.elevation.rows, cols: input.elevation.cols, hash: input.elevation.hash, status: input.elevation.status, sourceId: input.elevation.sourceId, values: input.elevation.values }
        : null,
    },
    substrate: input.substrate ?? null,
    results: { now: input.now, possible: input.possible },
    comparison,
    validationEvidence: EVIDENCE_LEDGER.map((e) => ({ component: e.component, evidence: e.evidence, validation: e.validation, finding: e.finding, experiments: e.experiments })),
    reproducibility: {
      replayable,
      how: replayable
        ? `npm run replay -- <this file>: verifies the evidence hash, storm seal and elevation hash${input.substrate?.state.status === "loaded" ? ", reconstructs every recorded substrate tile from its hash" : ""}, re-routes NOW and POSSIBLE, and compares outputs.`
        : "Not replayable: a routed pair, its extent and its elevation grid are all required.",
      notEmbedded: ["captured imagery (the classification cannot be re-run from this file)"],
    },
    limitations: [
      "Screening experiment; not validated against observed flooding.",
      "Accumulation divided by cell area is not surveyed or hydraulically solved flood depth.",
      ROUTED_ZONES_CAVEAT,
      "Support within the model is not evidence of a real-world outcome.",
      "Imagery is not embedded; land cover is an inferred input. Identity hashes are not signatures.",
      "The urban substrate is recorded as a controlled variable and as observed/reference context; D8 routing does not read substrate geometry in this version.",
      "Cost rates are unsourced installation assumptions; lifecycle costs excluded.",
    ],
  };
  // Hash the complete exported evidence; timestamps remain explicit inputs.
  return { ...evidence, evidenceHash: stableHash(evidence) };
}

export type ExperimentExport = ReturnType<typeof buildExperimentExport>;
