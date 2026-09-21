/**
 * Catalyst — the hidden fourth layer of the map.
 *
 * The historical layer asks what was. Mannahatta describes what is.
 * Catalyst asks what could be.
 *
 * This module contains NO new hydrology. Every number Catalyst reports comes
 * from the existing, already-calibrated model:
 *
 *  - `computeAbsorptionScore` / `classifyFloodRisk`  (lib/absorption.ts)
 *  - `assessScenario` / `projectScore` / `INTERVENTIONS` (lib/scenario.ts)
 *  - the 1609 benchmark (lib/baseline.ts)
 *
 * What is added here is (a) an unlock, (b) a temporal frame, and (c) a
 * deterministic counterfactual solver that searches the SAME intervention
 * space the Scenario Studio exposes. Nothing is fabricated: where the model
 * cannot answer, Catalyst says so.
 */
import { classifyFloodRisk } from "./absorption";
import {
  EMPTY_SCENARIO,
  INTERVENTIONS,
  INTERVENTION_ORDER,
  assessScenario,
  projectScore,
  type InterventionKey,
  type Scenario,
  type ScenarioAssumptions,
  type ScenarioImpact,
} from "./scenario";
import { ABSORPTION_WEIGHTS } from "./absorption";
import type { FloodRisk, LandCover, LandCoverKey } from "./types";

/* ------------------------------------------------------------------ unlock */

export const CATALYST_STORAGE_KEY = "mannahatta.catalyst.unlocked";
/** How long the 1609 figure must be held before the layer opens. */
export const CATALYST_HOLD_MS = 1600;
export const CATALYST_UNLOCK_EVENT = "mannahatta:catalyst-unlock";

export function isCatalystUnlocked(): boolean {
  try {
    return window.localStorage.getItem(CATALYST_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function unlockCatalyst(): void {
  try {
    window.localStorage.setItem(CATALYST_STORAGE_KEY, "1");
  } catch {
    /* private mode — the unlock still holds for this session */
  }
  window.dispatchEvent(new CustomEvent(CATALYST_UNLOCK_EVENT, { detail: true }));
}

export function relockCatalyst(): void {
  try {
    window.localStorage.removeItem(CATALYST_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(CATALYST_UNLOCK_EVENT, { detail: false }));
}

/** The two lines the unlock reveals, in order. */
export const CATALYST_REVEAL = [
  "The land remembers.",
  "The historical layer is not the last layer.",
] as const;

/* ------------------------------------------------------------------ epochs */

export type Epoch = "1609" | "2026" | "future";

export const EPOCH_ORDER: Epoch[] = ["1609", "2026", "future"];

export interface EpochMeta {
  id: Epoch;
  /** Short label on the lens. */
  label: string;
  /** The question this layer answers. */
  question: string;
  /**
   * How the layer's numbers were arrived at. Shown verbatim so a reader can
   * always tell measurement from reconstruction from simulation.
   */
  provenance: "reconstructed" | "measured-derived" | "simulated";
  provenanceNote: string;
}

export const EPOCHS: Record<Epoch, EpochMeta> = {
  "1609": {
    id: "1609",
    label: "1609",
    question: "What was",
    provenance: "reconstructed",
    provenanceNote:
      "A single island-wide benchmark estimated from the Mannahatta Project's description of pre-city ecology, scored with the live model. No per-block historical geometry exists in this app, and none is drawn.",
  },
  "2026": {
    id: "2026",
    label: "2026",
    question: "What is",
    provenance: "measured-derived",
    provenanceNote:
      "Land-cover shares inferred by a vision model from the captured satellite tile, then scored deterministically. The imagery is measured; the classification is inferred.",
  },
  future: {
    id: "future",
    label: "+",
    question: "What could be",
    provenance: "simulated",
    provenanceNote:
      "A counterfactual: the same scoring weights applied to a land cover that does not exist yet. It is an argument about physics, not a forecast about politics.",
  },
};

/* ------------------------------------------------- counterfactual solving */

/** Score gained per dollar spent, per unit of converted source area. */
function efficiency(key: InterventionKey): number {
  const def = INTERVENTIONS[key];
  const lift = def.targetWeight - ABSORPTION_WEIGHTS[def.source as Exclude<LandCoverKey, "water">];
  return lift / def.unitCostUSD;
}

/** Share of the LAND (water excluded) held by an absorbing class. */
function landShare(cover: LandCover, key: LandCoverKey): number {
  const land =
    (Number(cover.vegetation) || 0) +
    (Number(cover.soil) || 0) +
    (Number(cover.buildings) || 0) +
    (Number(cover.pavement) || 0);
  if (land <= 0) return 0;
  return (Number(cover[key]) || 0) / land;
}

export interface SolveResult {
  scenario: Scenario;
  /** Score the solved scenario actually reaches, via `projectScore`. */
  achievedScore: number;
  baseScore: number;
  target: number;
  /** True when the target is met or exceeded within the intervention space. */
  reachable: boolean;
  /** Ceiling of the intervention space for this cover: everything converted. */
  ceilingScore: number;
  /** Interventions the solver actually used, cheapest-first. */
  used: InterventionKey[];
}

/**
 * Minimum-cost route to a target absorption score.
 *
 * Greedy on score-gained-per-dollar. Because each intervention's contribution
 * is linear and independent (Δ = share × fraction × Δweight), and each unit of
 * a source class can be spent only once, greedy on cost-effectiveness is
 * optimal here — this is a fractional knapsack, not a search.
 *
 * The answer is verified through `projectScore`, the same function the
 * Scenario Studio uses, so the solver can never disagree with the sliders.
 */
export function solveForTarget(cover: LandCover, target: number, areaM2?: number, maxBudgetUSD?: number): SolveResult {
  const baseScore = projectScore(cover, EMPTY_SCENARIO);
  const ceiling = { ...EMPTY_SCENARIO } as Scenario;
  // Ceiling: spend each source class entirely on its most effective option.
  const bestBySource = new Map<LandCoverKey, InterventionKey>();
  for (const key of INTERVENTION_ORDER) {
    const src = INTERVENTIONS[key].source;
    const incumbent = bestBySource.get(src);
    const lift = (k: InterventionKey) =>
      INTERVENTIONS[k].targetWeight -
      ABSORPTION_WEIGHTS[INTERVENTIONS[k].source as Exclude<LandCoverKey, "water">];
    if (!incumbent || lift(key) > lift(incumbent)) bestBySource.set(src, key);
  }
  for (const key of bestBySource.values()) ceiling[key] = 1;
  const ceilingScore = projectScore(cover, ceiling);

  const scenario: Scenario = { ...EMPTY_SCENARIO };
  const used: InterventionKey[] = [];
  const capacity = new Map<LandCoverKey, number>();
  let spentBudget = 0;

  let needed = target - baseScore;
  // If target is already met but budget is specified and we want to maximize score, we could change the loop condition.
  // But standard "reduce flood risk under $X" implies finding a solution that meets target and costs < $X.
  // Or, if target is not reachable, get as close as possible within budget.
  if (needed > 0 || maxBudgetUSD) {
    const order = [...INTERVENTION_ORDER].sort(
      (a, b) => efficiency(b) - efficiency(a)
    );
    for (const key of order) {
      if (needed <= 0) break;
      const def = INTERVENTIONS[key];
      const share = landShare(cover, def.source);
      if (share <= 0) continue;
      const spent = capacity.get(def.source) ?? 0;
      const room = Math.max(0, 1 - spent);
      if (room <= 0) continue;

      const lift =
        def.targetWeight -
        ABSORPTION_WEIGHTS[def.source as Exclude<LandCoverKey, "water">];
      if (lift <= 0) continue;

      const gainPerFraction = share * lift * 100;
      let fractionNeeded = needed > 0 ? needed / gainPerFraction : 0;
      
      // If we are just maximizing score within budget, we need as much fraction as possible
      if (needed <= 0 && maxBudgetUSD) fractionNeeded = room;

      let fraction = Math.min(room, fractionNeeded);
      
      // Budget constraint
      const costPerFraction = (areaM2 || 0) * share * def.unitCostUSD;
      if (maxBudgetUSD && costPerFraction > 0) {
         const affordableFraction = Math.max(0, maxBudgetUSD - spentBudget) / costPerFraction;
         fraction = Math.min(fraction, affordableFraction);
      }

      if (fraction <= 0) continue;

      scenario[key] = fraction;
      capacity.set(def.source, spent + fraction);
      used.push(key);
      needed -= fraction * gainPerFraction;
      spentBudget += fraction * costPerFraction;
      
      if (maxBudgetUSD && spentBudget >= maxBudgetUSD - 0.01) break;
    }
  }

  const achievedScore = projectScore(cover, scenario);
  return {
    scenario,
    achievedScore,
    baseScore,
    target,
    // Rounding at one decimal can leave the solver a hair short of an exact
    // target; treat that as met rather than reporting a false failure.
    reachable: achievedScore >= target - 0.05,
    ceilingScore,
    used,
  };
}

/* ------------------------------------------------------------- integrity */

export type Verdict = "supported" | "not_supported" | "inconclusive";

export const VERDICT_COPY: Record<Verdict, { label: string; tone: string }> = {
  supported: {
    label: "Supported under this simulation",
    tone: "text-primary",
  },
  not_supported: {
    label: "Not supported under this simulation",
    tone: "text-destructive",
  },
  inconclusive: {
    label: "Inconclusive under this simulation",
    tone: "text-warning",
  },
};

/**
 * Whether the hypothesis "this intervention reaches the target" holds.
 *
 * A band of ±`margin` points around the target reads as inconclusive: the
 * absorption weights are representative mid-range coefficients, not survey
 * data, so a result inside their uncertainty cannot be called either way.
 */
export function evaluateVerdict(
  achieved: number,
  target: number,
  margin = 1.5
): Verdict {
  if (achieved >= target + margin) return "supported";
  if (achieved <= target - margin) return "not_supported";
  return "inconclusive";
}

/* ------------------------------------------------------- projected state */

export interface FutureState {
  impact: ScenarioImpact;
  /**
   * Land cover after the intervention, in the app's five classes.
   *
   * Only conversions that genuinely change class are moved: depaving for trees
   * or bioswales becomes vegetation. Permeable pavement is still pavement and
   * a green roof is still a roof — their absorption changes, their class does
   * not — so those areas stay put and are reported separately as engineered
   * surface. Moving them would overstate the visible greening.
   */
  cover: LandCover;
  /** Share of the tile (%) re-engineered without changing class. */
  engineeredPct: number;
  risk: FloodRisk;
  /** Runoff volume (m³/yr) before and after, from score and site area. */
  runoffBeforeM3: number;
  runoffAfterM3: number;
}

const CLASS_CHANGING: Partial<Record<InterventionKey, LandCoverKey>> = {
  street_trees: "vegetation",
  bioswales: "vegetation",
};

/**
 * Project the full future state of a tile: cover, score, risk, and runoff.
 * All of it derived from `assessScenario` — this function moves numbers
 * around, it does not compute new ones.
 */
export function projectFuture(
  cover: LandCover,
  scenario: Scenario,
  areaM2: number,
  assumptions?: ScenarioAssumptions
): FutureState {
  const impact = assessScenario(cover, scenario, areaM2, assumptions);
  const next: LandCover = { ...cover };
  let engineered = 0;

  for (const key of INTERVENTION_ORDER) {
    const fraction = Math.min(1, Math.max(0, scenario[key] || 0));
    if (fraction <= 0) continue;
    const def = INTERVENTIONS[key];
    const movedPct = (Number(cover[def.source]) || 0) * fraction;
    const dest = CLASS_CHANGING[key];
    if (dest) {
      next[def.source] = Math.max(0, (next[def.source] || 0) - movedPct);
      next[dest] = (next[dest] || 0) + movedPct;
    } else {
      engineered += movedPct;
    }
  }

  const rainMm = assumptions?.annualRainfallMm ?? 1200;
  const area = Number.isFinite(areaM2) && areaM2 > 0 ? areaM2 : 0;
  // Runoff is the complement of the retained fraction the score reports.
  const runoff = (score: number) =>
    (area * rainMm * (1 - Math.min(100, Math.max(0, score)) / 100)) / 1000;

  return {
    impact,
    cover: next,
    engineeredPct: Math.round(engineered * 10) / 10,
    risk: classifyFloodRisk(impact.projectedScore),
    runoffBeforeM3: runoff(impact.baseScore),
    runoffAfterM3: runoff(impact.projectedScore),
  };
}

/** Default hypothesis: can this ground be brought to a moderate-risk band? */
export const DEFAULT_TARGET_SCORE = 40;

/** Limits stated on every Catalyst reading. Never omitted. */
export const CATALYST_LIMITS = [
  "Absorption weights are representative Rational Method coefficients, not a hydrological survey of this site.",
  "The model has no soil profile, water table, slope, or existing drainage capacity for this ground.",
  "Costs are planning-level unit rates; they carry no local labour, permitting, or land-acquisition data.",
  "The 1609 layer is one island-wide benchmark, not a reconstruction of this particular block.",
] as const;