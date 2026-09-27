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
  normalizeScenario,
  siteCoverShares,
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
  window.dispatchEvent(
    new CustomEvent(CATALYST_UNLOCK_EVENT, { detail: true }),
  );
}

export function relockCatalyst(): void {
  try {
    window.localStorage.removeItem(CATALYST_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(
    new CustomEvent(CATALYST_UNLOCK_EVENT, { detail: false }),
  );
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
      "A single island-wide benchmark estimated from the Mannahatta Project's description of pre-city ecology, scored with the live model. Where available, the separate Welikia layer uses reconstructed block bounding boxes; neither source is a historical measurement.",
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

/** A bounded, continuous planning solution, not surveyed spatial eligibility. */
export interface SolveResult {
  scenario: Scenario;
  achievedScore: number;
  baseScore: number;
  target: number;
  reachable: boolean;
  ceilingScore: number;
  budgetCeilingScore: number;
  costUSD: number | null;
  remainingGap: number;
  bindingConstraint: "none" | "surface" | "budget";
  used: InterventionKey[];
}

/**
 * Minimum cost on each source's upper concave cost/retention envelope.
 * A later segment replaces an earlier option (e.g. trees with bioswales).
 * Sorting incremental slopes then solves the separable continuous allocation.
 * Naive option-by-option knapsack is wrong: alternatives compete for pavement.
 */
export function solveForTarget(
  cover: LandCover,
  target: number,
  areaM2?: number,
  maxBudgetUSD?: number,
): SolveResult {
  if (!Number.isFinite(target) || target < 0 || target > 100)
    throw new Error("Target must be between 0 and 100.");
  const values = Object.values(cover);
  if (
    values.some((v) => !Number.isFinite(v) || v < 0) ||
    values.reduce((a, b) => a + b, 0) <= 0
  )
    throw new Error("Land cover must be finite, nonnegative and nonempty.");
  const hasArea = areaM2 !== undefined && Number.isFinite(areaM2) && areaM2 > 0;
  if (
    maxBudgetUSD !== undefined &&
    (!Number.isFinite(maxBudgetUSD) || maxBudgetUSD < 0 || !hasArea)
  )
    throw new Error(
      "A budget requires a known positive area and a finite nonnegative amount.",
    );
  const physical = siteCoverShares(cover);
  const landFraction = 1 - physical.water;
  const rawBase =
    landFraction > 0
      ? ((["vegetation", "soil", "buildings", "pavement"] as const).reduce(
          (sum, k) => sum + physical[k] * ABSORPTION_WEIGHTS[k],
          0,
        ) /
          landFraction) *
        100
      : 0;
  type Point = { key: InterventionKey | null; cost: number; lift: number };
  type Segment = { from: Point; to: Point; gain: number; cost: number };
  const segments: Segment[] = [];
  for (const source of ["pavement", "buildings"] as const) {
    if (physical[source] <= 0 || landFraction <= 0) continue;
    const points: Point[] = [
      { key: null, cost: 0, lift: 0 },
      ...INTERVENTION_ORDER.filter(
        (k) => INTERVENTIONS[k].source === source,
      ).map((key) => ({
        key,
        cost: INTERVENTIONS[key].unitCostUSD,
        lift: INTERVENTIONS[key].targetWeight - ABSORPTION_WEIGHTS[source],
      })),
    ].sort((a, b) => a.cost - b.cost || b.lift - a.lift);
    const hull: Point[] = [];
    for (const point of points) {
      if (hull.length && point.lift <= hull[hull.length - 1].lift) continue;
      while (hull.length >= 2) {
        const a = hull[hull.length - 2],
          b = hull[hull.length - 1];
        if (
          (b.lift - a.lift) / (b.cost - a.cost) >
          (point.lift - b.lift) / (point.cost - b.cost)
        )
          break;
        hull.pop();
      }
      hull.push(point);
    }
    for (let i = 1; i < hull.length; i++) {
      const from = hull[i - 1],
        to = hull[i];
      segments.push({
        from,
        to,
        gain: (physical[source] / landFraction) * (to.lift - from.lift) * 100,
        cost:
          (hasArea ? areaM2! : 1) * physical[source] * (to.cost - from.cost),
      });
    }
  }
  segments.sort((a, b) => b.gain / b.cost - a.gain / a.cost);
  const allocate = (needed: number, budget: number) => {
    const scenario = { ...EMPTY_SCENARIO };
    let spent = 0;
    for (const segment of segments) {
      const fraction = Math.max(
        0,
        Math.min(1, needed / segment.gain, (budget - spent) / segment.cost),
      );
      if (fraction <= 0) break;
      if (segment.from.key)
        scenario[segment.from.key] = Math.max(
          0,
          scenario[segment.from.key] - fraction,
        );
      scenario[segment.to.key!] += fraction;
      needed -= fraction * segment.gain;
      spent += fraction * segment.cost;
    }
    return { scenario, spent };
  };
  const ceilingScore = projectScore(
    cover,
    allocate(Infinity, Infinity).scenario,
  );
  const budget = maxBudgetUSD ?? Infinity;
  const budgetCeilingScore = projectScore(
    cover,
    allocate(Infinity, budget).scenario,
  );
  const solved = allocate(Math.max(0, target - rawBase), budget);
  const achievedScore = projectScore(cover, solved.scenario);
  const reachable = achievedScore >= target - 0.05;
  return {
    scenario: solved.scenario,
    achievedScore,
    baseScore: projectScore(cover, EMPTY_SCENARIO),
    target,
    reachable,
    ceilingScore,
    budgetCeilingScore,
    costUSD: hasArea ? solved.spent : null,
    remainingGap: Math.max(0, Math.round((target - achievedScore) * 10) / 10),
    bindingConstraint: reachable
      ? "none"
      : target > ceilingScore + 0.05
        ? "surface"
        : "budget",
    used: INTERVENTION_ORDER.filter((k) => solved.scenario[k] > 1e-10),
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
  margin = 1.5,
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
  assumptions?: ScenarioAssumptions,
): FutureState {
  const impact = assessScenario(cover, scenario, areaM2, assumptions);
  const next: LandCover = { ...cover };
  const normalized = normalizeScenario(scenario);
  let engineered = 0;

  for (const key of INTERVENTION_ORDER) {
    const fraction = normalized[key];
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
  const physicalShares = siteCoverShares(cover);
  const landKeys = ["vegetation", "soil", "buildings", "pavement"] as const;
  const runoffFraction = landKeys.reduce(
    (sum, key) => sum + physicalShares[key] * (1 - ABSORPTION_WEIGHTS[key]),
    0,
  );
  const runoffBeforeM3 = (area * rainMm * runoffFraction) / 1000;

  return {
    impact,
    cover: next,
    engineeredPct: Math.round(engineered * 10) / 10,
    risk: classifyFloodRisk(impact.projectedScore),
    runoffBeforeM3,
    runoffAfterM3: Math.max(0, runoffBeforeM3 - impact.addedRetentionM3),
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
