import { classifyFloodRisk, computeAbsorptionScore } from "./absorption";
import type { FloodRisk, LandCover } from "./types";

/**
 * Deterministic code decides the score; storage does not.
 *
 * classification/C3 found 24 of 61 live scans whose stored score predates
 * the 2026-07-14 recalibration (up to 15 points off; 9 in another band): the
 * backfill migration in supabase/migrations never reached them. Every record
 * entering the app is therefore rescored from its land cover. The stored
 * value is kept alongside, so a disagreement stays visible rather than
 * silently overwritten.
 */
export interface Rescored {
  absorption_score: number;
  flood_risk: FloodRisk;
  /** What the database held, when it differs from the current scorer. */
  stored_absorption_score?: number;
}

const KEYS = ["vegetation", "soil", "buildings", "pavement", "water"] as const;

function usableCover(value: unknown): LandCover | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (!KEYS.every((k) => typeof raw[k] === "number" && Number.isFinite(raw[k]) && (raw[k] as number) >= 0)) return null;
  return raw as unknown as LandCover;
}

export function withCurrentScore<T extends { land_cover?: unknown; absorption_score?: unknown }>(record: T): Omit<T, keyof Rescored> & Rescored {
  const stored = Number(record.absorption_score);
  const cover = usableCover(record.land_cover);
  if (!cover) {
    return { ...record, absorption_score: stored, flood_risk: classifyFloodRisk(stored) };
  }
  const score = computeAbsorptionScore(cover);
  const differs = !Number.isFinite(stored) || Math.abs(stored - score) > 0.05;
  return {
    ...record,
    absorption_score: score,
    flood_risk: classifyFloodRisk(score),
    ...(differs ? { stored_absorption_score: stored } : {}),
  };
}
