import { ABSORPTION_WEIGHTS } from "./absorption";
import { stableHash } from "./counterfactual/hashing";
import type { InterventionFeature } from "./counterfactual/types";
import type { SimulationResponse } from "./simulation-types";
import type { StormSeal } from "./storm-identity";
import { verifyStormSeal } from "./storm-identity";
import { INTERVENTIONS, type Scenario } from "./scenario";
import type { AnalysisRecord } from "./types";

/** Evidence package, not a replay claim: DEM samples and imagery are not bundled. */
export function buildExperimentExport(input: {
  analysis: AnalysisRecord;
  scenario: Scenario;
  interventions: InterventionFeature[];
  storm: StormSeal | null;
  now: SimulationResponse | null;
  possible: SimulationResponse | null;
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
  const analysis = input.analysis;
  const evidence = {
    schema: "mannahatta-experiment-v1",
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
      landCover: analysis.status === "example" ? "illustrative" : "inferred",
      score: "derived",
      storm: "simulated",
      elevation: input.now?.metadata.elevation_status ?? "not-loaded",
    },
    coefficients: ABSORPTION_WEIGHTS,
    interventionAssumptions: INTERVENTIONS,
    scenario: input.scenario,
    interventions: input.interventions,
    storm: input.storm,
    results: { now: input.now, possible: input.possible },
    limitations: [
      "Screening experiment; not validated against observed flooding.",
      "Accumulation divided by cell area is not surveyed or hydraulically solved flood depth.",
      "Source imagery and elevation samples are not embedded. Identity hashes are not a guarantee of exact replay or authenticity.",
      "Cost rates are installation assumptions with undocumented source year/geography; lifecycle costs excluded.",
    ],
  };
  // Hash the complete exported evidence; timestamps remain explicit inputs.
  return { ...evidence, evidenceHash: stableHash(evidence) };
}
