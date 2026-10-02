import findingsJson from "./findings.json";
import { assumption } from "@/lib/assumptions/registry";
import type { EvidenceStatus, ValidationLevel } from "./status";

/**
 * "How do we know?" — one row per component of the instrument, generated from
 * committed experiment findings (npm run experiment) so the answer shown in
 * the app cannot drift from the evidence. Each row says what kind of number
 * the component produces, how far it has been tested, and what was found.
 */
type Findings = Record<string, number | string | boolean | null>;
const FINDINGS = findingsJson as unknown as Record<string, { title: string; verdict: { status: string; statement: string }; findings: Findings }>;

function finding(experiment: string, key: string): number {
  const value = FINDINGS[experiment]?.findings[key];
  if (typeof value !== "number") throw new Error(`Missing finding ${experiment}:${key}. Run npm run experiment.`);
  return value;
}

export type Question = "What was?" | "What is?" | "What could be?";

export interface LedgerEntry {
  id: string;
  question: Question;
  component: string;
  evidence: EvidenceStatus;
  validation: ValidationLevel;
  finding: string;
  experiments: string[];
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

export const HOLDOUT_ROUTING = {
  auc: finding("routing/R5-311-association-holdout", "aucAccumulation"),
  lowElevationAuc: finding("routing/R5-311-association-holdout", "aucLowElevation"),
  reports: finding("routing/R5-311-association-holdout", "complaints"),
};

/** Plain-language holdout result, shown wherever routed zones are shown. */
export const ROUTED_ZONES_CAVEAT = `On a held-out NYC storm (29 September 2023, ${HOLDOUT_ROUTING.reports} street-flooding reports), these routed zones located reported flooding no better than chance (AUC ${HOLDOUT_ROUTING.auc.toFixed(2)}); simply ranking low ground did better (${HOLDOUT_ROUTING.lowElevationAuc.toFixed(2)}). Read them as where this model sends water, not where flooding is likely.`;

/** Classification error ranges measured by experiment, for sensitivity defaults. */
export const CLASSIFICATION_ERROR = {
  benchmarkPP: assumption("classification.sensitivity_default_pp").value,
  benchmarkMeasuredPP: finding("classification/C1-nlcd-agreement", "perviousMaePP"),
  benchmarkFrames: finding("classification/C1-nlcd-agreement", "frames"),
  repeatRangePP: finding("classification/C2-repeat-stability", "perviousRangePP"),
  repeats: finding("classification/C2-repeat-stability", "repeats"),
};

export const EVIDENCE_LEDGER: LedgerEntry[] = [
  {
    id: "history",
    question: "What was?",
    component: "1609 reconstruction (Welikia blocks, island benchmark)",
    evidence: "reconstructed",
    validation: "unvalidated",
    finding: "A historical ecology reconstruction reduced to block boxes and one island-wide benchmark. Not compared with independent evidence in this repository.",
    experiments: [],
  },
  {
    id: "classification",
    question: "What is?",
    component: "Five-class land cover from imagery",
    evidence: "inferred",
    validation: "benchmarked",
    finding: `Pervious share differs from NLCD 2021 by ${CLASSIFICATION_ERROR.benchmarkMeasuredPP.toFixed(1)} pp on average across ${CLASSIFICATION_ERROR.benchmarkFrames} frames. One frame classified ${CLASSIFICATION_ERROR.repeats} times spanned ${CLASSIFICATION_ERROR.repeatRangePP.toFixed(0)} pp of pervious share; ${pct(finding("classification/C2-repeat-stability", "feedShareMultipleOf5"))} of values are multiples of 5.`,
    experiments: ["classification/C1-nlcd-agreement", "classification/C2-repeat-stability"],
  },
  {
    id: "score",
    question: "What is?",
    component: "Urban Absorption Score",
    evidence: "modeled",
    validation: "internally-consistent",
    finding: `Computed by code from land cover, never read from storage: ${finding("classification/C3-stored-score-integrity", "mismatched")} of ${finding("classification/C3-stored-score-integrity", "rows")} stored scores were stale. Not validated against observed flooding.`,
    experiments: ["classification/C3-stored-score-integrity"],
  },
  {
    id: "coefficients",
    question: "What is?",
    component: "Retention coefficients",
    evidence: "assumed",
    validation: "benchmarked",
    finding: `Compared with the NRCS curve-number method: vegetation and pavement stay inside its envelope at most depths; bare soil and roofs trip their review wires. Coefficients do not change with storm depth, so saturation cannot appear.`,
    experiments: ["hydrology/H2-curve-number-benchmark"],
  },
  {
    id: "bulk",
    question: "What could be?",
    component: "Bulk water budget",
    evidence: "modeled",
    validation: "internally-consistent",
    finding: "Rain = retained + runoff exactly, and the routing engine retains the same volume on the same land. Consistency, not correspondence with measured runoff.",
    experiments: ["hydrology/H1-cross-model-consistency"],
  },
  {
    id: "substrate",
    question: "What is?",
    component: "Urban substrate (compiled public records)",
    evidence: "measured",
    validation: "internally-consistent",
    finding: `Building footprints, street centrelines, shoreline, trees and reference land cover from NYC and federal open data, compiled into ${finding("substrate/S1-substrate-determinism", "tiles")} versioned tiles that recompile byte for byte from frozen inputs; tampering with one tile fails replay. Reproducibility, not accuracy: the records carry their own survey error, and routing does not read this geometry yet.`,
    experiments: ["substrate/S1-substrate-determinism"],
  },
  {
    id: "elevation",
    question: "What is?",
    component: "Elevation surface",
    evidence: "measured",
    validation: "benchmarked",
    finding: `Terrarium and USGS 3DEP differ by a median ${finding("routing/R3-dem-source-sensitivity", "medianElevationRmseM").toFixed(1)} m RMSE; only ${pct(finding("routing/R3-dem-source-sensitivity", "medianSameReceiverShare"))} of cells keep the same flow direction between them. Terrarium contains artefacts down to ${Math.round(finding("routing/R3-dem-source-sensitivity", "terrariumLowestM")).toLocaleString("en-US")} m.`,
    experiments: ["routing/R3-dem-source-sensitivity"],
  },
  {
    id: "routing",
    question: "What could be?",
    component: "Routed accumulation zones",
    evidence: "modeled",
    validation: "failed",
    finding: ROUTED_ZONES_CAVEAT,
    experiments: ["routing/R1-synthetic-terrains", "routing/R2-resolution-sensitivity", "routing/R4-311-association-development", "routing/R5-311-association-holdout"],
  },
  {
    id: "interventions",
    question: "What could be?",
    component: "Interventions, costs and Catalyst plans",
    evidence: "counterfactual",
    validation: "unvalidated",
    finding: `Model-internal only; no monitored intervention outcomes are held. Plans sized exactly to a target become inconclusive within measured classification error (${finding("interventions/I3-classification-uncertainty", "combinationsInconclusive")} of ${finding("interventions/I3-classification-uncertainty", "combinations")} tested). Unit costs are unsourced scenario assumptions.`,
    experiments: ["interventions/I1-bioswale-1500m2", "interventions/I2-plan-robustness", "interventions/I3-classification-uncertainty"],
  },
];

export function experimentVerdict(id: string) {
  return FINDINGS[id]?.verdict ?? null;
}
