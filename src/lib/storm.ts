/**
 * Storm Mode — the same design storm, run twice.
 *
 * No new hydrology lives here. The server engine (`run-simulation`) routes
 * water over a real DEM; this module only (a) re-weights an existing run by
 * the runoff coefficient the scenario math already produces, so the second
 * storm can be drawn without pretending the DEM itself was re-solved, and
 * (b) reads plain-language constraints for the Catalyst solver.
 */
import type { SimulationResponse } from "@/lib/simulation-types";

/**
 * Ratio of post-intervention runoff to pre-intervention runoff, derived from
 * the absorption scores the existing model reports. 1 = no change.
 */
export function runoffRatio(baseScore: number, projectedScore: number): number {
  const before = 1 - Math.min(100, Math.max(0, baseScore)) / 100;
  const after = 1 - Math.min(100, Math.max(0, projectedScore)) / 100;
  if (before <= 0) return 1;
  return Math.min(1, Math.max(0, after / before));
}

const LEVELS = ["low", "moderate", "high", "severe"] as const;

/** Step a risk-zone level down as runoff falls. Never invents new zones. */
function softenLevel(level: string, ratio: number): (typeof LEVELS)[number] {
  const i = Math.max(0, LEVELS.indexOf(level as (typeof LEVELS)[number]));
  const steps = ratio <= 0.6 ? 2 : ratio <= 0.85 ? 1 : 0;
  return LEVELS[Math.max(0, i - steps)];
}

/**
 * The identical storm, over redesigned ground.
 *
 * Flow geometry is unchanged — the terrain's shape did not move, only what
 * the ground does with the water that lands on it. Volumes and velocities are
 * scaled by `ratio`, and risk zones soften accordingly. This is a re-weighting
 * of a measured run, not a second DEM solve, and the UI says so.
 */
export function reweightSimulation(
  sim: SimulationResponse,
  ratio: number
): SimulationResponse {
  const r = Math.min(1, Math.max(0, ratio));
  return {
    ...sim,
    flow_paths: sim.flow_paths.map((p) => ({
      ...p,
      volume_m3: p.volume_m3 * r,
      velocity_mps: p.velocity_mps * Math.sqrt(r),
    })),
    risk_zones: sim.risk_zones
      .map((z) => ({ ...z, level: softenLevel(z.level, r) }))
      // Zones that fall out of the "flooded" band under the lighter load are
      // dropped rather than redrawn somewhere new.
      .filter((z) => !(r <= 0.5 && z.level === "low")),
  };
}

export interface StormConstraint {
  /** Capital ceiling in USD, when one was stated. */
  budgetUSD: number | null;
  /** Absorption-score target, when one was stated. */
  targetScore: number | null;
  raw: string;
}

/**
 * Read a constraint written the way a planner would say it:
 * "reduce flood risk under $500k", "get to 45 for less than 1.2M",
 * "cut runoff with a $250,000 budget".
 */
export function parseConstraint(text: string): StormConstraint {
  const raw = text.trim();
  const lower = raw.toLowerCase();

  let budgetUSD: number | null = null;
  const money = lower.match(/\$?\s*([\d,.]+)\s*(k|m|bn|b|million|thousand)?/g) ?? [];
  for (const token of money) {
    if (!/[$]|k|m|million|thousand/.test(token) && !/\d{4,}/.test(token)) continue;
    const num = Number(token.replace(/[^\d.]/g, ""));
    if (!Number.isFinite(num) || num <= 0) continue;
    const mult = /m\b|million/.test(token)
      ? 1_000_000
      : /k\b|thousand/.test(token)
      ? 1_000
      : 1;
    const value = num * mult;
    if (value >= 1_000) {
      budgetUSD = value;
      break;
    }
  }

  let targetScore: number | null = null;
  const target = lower.match(/(?:to|reach|hit|score of|target)\s+(\d{1,3})(?:\s*\/\s*100)?/);
  if (target) {
    const value = Number(target[1]);
    if (Number.isFinite(value) && value > 0 && value <= 100) targetScore = value;
  }

  return { budgetUSD, targetScore, raw };
}
