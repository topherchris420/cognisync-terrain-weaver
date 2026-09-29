/**
 * The smallest structure that makes a result traceable:
 * question → preregistered spec → frozen inputs → deterministic run → result.
 *
 * Experiments are pure functions of committed fixtures. The runner
 * (scripts/experiment.ts) records the code commit, input content hashes and
 * model/assumption versions next to each result, and CI re-runs every
 * experiment to prove the committed result is still what the code produces.
 */
import { ABSORPTION_WEIGHTS } from "@/lib/absorption";
import { ASSUMPTION_REGISTRY_VERSION } from "@/lib/assumptions/registry";
import { stableHash } from "@/lib/counterfactual/hashing";
import { LOCAL_HYDROLOGY_MODEL } from "@/lib/hydrology/types";
import { STORM_PROVENANCE } from "@/lib/paired-storm";

export type ExperimentDomain = "classification" | "hydrology" | "routing" | "interventions";

/**
 * What the comparison is against. Ordered from weakest to strongest; a result
 * is never described with a stronger word than its tier allows.
 */
export type EvidenceTier =
  | "synthetic-verification" // analytic cases: does code match known answers?
  | "internal-consistency" // do the instrument's own parts agree?
  | "repeated-measurement" // does the same input give the same output?
  | "reference-model" // comparison with an independent published model
  | "reference-dataset" // comparison with an independent remote-sensing/map product
  | "independent-observation"; // comparison with independent observations of outcomes

export interface ExperimentSpec {
  id: string;
  domain: ExperimentDomain;
  title: string;
  question: string;
  /** A falsifiable statement, or null for a descriptive measurement. */
  hypothesis: string | null;
  tier: EvidenceTier;
  /** Fixture paths relative to experiments/data. */
  inputs: string[];
  conditions: Record<string, string | number | boolean>;
  /** Calibration / validation boundary, or why none exists. */
  split: string;
  metrics: string[];
  limitations: string[];
}

export type Finding = number | string | boolean | null;

export interface ResultTable {
  title: string;
  columns: string[];
  rows: Array<Array<string | number | null>>;
}

export interface ExperimentResult {
  verdict: {
    status: "supported" | "not-supported" | "inconclusive" | "descriptive";
    statement: string;
  };
  /** Machine-readable headline numbers. Tripwires and the UI read these. */
  findings: Record<string, Finding>;
  /** Plain-language observations, negative and unexpected ones included. */
  observations: string[];
  tables: ResultTable[];
}

export interface Fixture<T> {
  provenance: {
    source: string;
    url: string;
    retrievedAt: string;
    license: string;
    evidence: string;
    contentHash: string;
    caveats: string[];
  };
  data: T;
}

export type FixtureLoader = <T>(path: string) => Fixture<T>;

export interface Experiment {
  spec: ExperimentSpec;
  run(load: FixtureLoader): ExperimentResult;
}

/** Identity of every model component an experiment might exercise. */
export function modelVersions() {
  return {
    score: `urban-absorption:${stableHash(ABSORPTION_WEIGHTS)}`,
    bulkBudget: STORM_PROVENANCE.model,
    routing: LOCAL_HYDROLOGY_MODEL,
    assumptions: ASSUMPTION_REGISTRY_VERSION,
  };
}

export function resultHash(result: ExperimentResult): string {
  return stableHash(result);
}
