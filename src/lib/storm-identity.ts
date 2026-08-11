import { stableHash } from "@/lib/counterfactual/hashing";
import type { StormDefinition } from "@/lib/counterfactual/types";

/**
 * A storm seal is the visible, verifiable identity of one storm event.
 *
 * The seed and hash are derived ONLY from the physical storm parameters, so the
 * same storm re-run against a different surface produces a byte-identical seed.
 * The timestamp is recorded for the audit trail but never enters the hash — it
 * is metadata about when the storm was sealed, not part of the storm itself.
 */
export interface StormSeal {
  storm: StormDefinition;
  /** Deterministic 16-hex seed derived from the storm parameters. */
  seed: string;
  /** Short human-readable form of the seed. */
  shortSeed: string;
  /** ISO-8601 UTC time the storm was first sealed (excluded from the hash). */
  sealedAt: string;
}

export interface DeterminismCheck {
  id: string;
  label: string;
  passed: boolean;
  now: string;
  possible: string;
}

export interface DeterminismReport {
  /** True only when every check passes. */
  identical: boolean;
  checks: DeterminismCheck[];
  /** Human-readable summary of the failed checks. */
  mismatches: string[];
}

function seedFromStorm(storm: {
  rainfallDepthMm: number;
  durationMinutes: number;
  distribution: string;
  resolution: string;
  includeDrainage: boolean;
}): string {
  const hash = stableHash({
    rainfallDepthMm: storm.rainfallDepthMm,
    durationMinutes: storm.durationMinutes,
    distribution: storm.distribution,
    resolution: storm.resolution,
    includeDrainage: storm.includeDrainage,
  });
  return hash.replace(/^fnv1a64:/, "");
}

export function createStormSeal(
  storm: StormDefinition,
  sealedAt: string = new Date().toISOString()
): StormSeal {
  const seed = seedFromStorm(storm);
  return {
    storm,
    seed,
    shortSeed: `${seed.slice(0, 4)}-${seed.slice(4, 8)}-${seed.slice(8, 12)}`.toUpperCase(),
    sealedAt,
  };
}

/** Recomputes the seed from the sealed storm parameters — detects tampering. */
export function verifyStormSeal(seal: StormSeal): boolean {
  return seedFromStorm(seal.storm) === seal.seed;
}

function check(
  id: string,
  label: string,
  now: unknown,
  possible: unknown
): DeterminismCheck {
  const a = String(now);
  const b = String(possible);
  return { id, label, passed: a === b, now: a, possible: b };
}

/**
 * Proves that a NOW run and a POSSIBLE run were driven by the identical storm.
 * Every parameter that can change the forcing is compared explicitly; nothing
 * is inferred from the hash alone.
 */
export function checkStormDeterminism(
  now: StormSeal,
  possible: StormSeal
): DeterminismReport {
  const checks: DeterminismCheck[] = [
    check("seed", "Storm seed", now.seed, possible.seed),
    check("hash", "Storm hash", now.storm.hash, possible.storm.hash),
    check("rainfall", "Rainfall depth (mm)", now.storm.rainfallDepthMm, possible.storm.rainfallDepthMm),
    check("duration", "Duration (min)", now.storm.durationMinutes, possible.storm.durationMinutes),
    check("distribution", "Temporal distribution", now.storm.distribution, possible.storm.distribution),
    check("resolution", "Grid resolution", now.storm.resolution, possible.storm.resolution),
    check("drainage", "Drainage included", now.storm.includeDrainage, possible.storm.includeDrainage),
    {
      id: "integrity",
      label: "Seal integrity",
      passed: verifyStormSeal(now) && verifyStormSeal(possible),
      now: verifyStormSeal(now) ? "valid" : "tampered",
      possible: verifyStormSeal(possible) ? "valid" : "tampered",
    },
  ];

  return {
    identical: checks.every((c) => c.passed),
    checks,
    mismatches: checks.filter((c) => !c.passed).map((c) => c.label),
  };
}

export function formatSealedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${date.toISOString().slice(0, 19).replace("T", " ")}Z`;
}
