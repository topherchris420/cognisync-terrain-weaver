import { contentHash } from "./sha256";
import type { SourceSummary } from "./provenance";

/**
 * The substrate state an experiment used: which compiled version, which
 * manifest, and exactly which tiles with which content hashes. Recorded in
 * every routed run and every experiment export, and checked by replay.
 */
export interface SubstrateIdentity {
  status: "loaded";
  schemaVersion: string;
  substrateVersion: string;
  manifestHash: string;
  /** Sorted tile ids the study loaded (local, closure and context). */
  tileIds: string[];
  tileHashes: Record<string, string>;
  /** Hash of the four fields above; what routed runs record as `substrate_hash`. */
  identityHash: string;
}

export type SubstrateUnavailableReason = "outside-coverage" | "load-failed" | "integrity-failed" | "no-substrate-published";

export interface SubstrateUnavailable {
  status: "unavailable";
  reason: SubstrateUnavailableReason;
  detail: string;
  identityHash: string;
}

export type SubstrateState = SubstrateIdentity | SubstrateUnavailable;

/** Recorded by routed runs that never consulted a substrate (tests, experiments, the edge function). */
export const SUBSTRATE_NONE = "substrate:none";

export function identityHashOf(identity: Pick<SubstrateIdentity, "schemaVersion" | "substrateVersion" | "manifestHash" | "tileHashes">): string {
  return contentHash({
    schemaVersion: identity.schemaVersion,
    substrateVersion: identity.substrateVersion,
    manifestHash: identity.manifestHash,
    tileHashes: identity.tileHashes,
  });
}

export function makeIdentity(input: Omit<SubstrateIdentity, "status" | "identityHash" | "tileIds">): SubstrateIdentity {
  const tileIds = Object.keys(input.tileHashes).sort();
  const tileHashes = Object.fromEntries(tileIds.map((id) => [id, input.tileHashes[id]]));
  const identity = { status: "loaded" as const, ...input, tileIds, tileHashes };
  return { ...identity, identityHash: identityHashOf(identity) };
}

export function unavailable(reason: SubstrateUnavailableReason, detail: string): SubstrateUnavailable {
  return { status: "unavailable", reason, detail, identityHash: `substrate:unavailable:${reason}` };
}

/** The key a routed run records: two runs pair only if these are equal. */
export function substrateRunKey(state: SubstrateState | null | undefined): string {
  return state ? state.identityHash : SUBSTRATE_NONE;
}

/** What an experiment export carries about the substrate. */
export interface SubstrateEvidence {
  state: SubstrateState;
  sources: SourceSummary[];
  layers: Array<{ id: string; title: string; evidence: string; caveats: string[] }>;
  coverage: { status: "complete" | "partial" | "outside"; fraction: number } | null;
  compiler: { name: string; version: string; configHash: string } | null;
  diagnostics: Record<string, number | null> | null;
  /** How the experiment used the substrate; honest about what it does not do yet. */
  use: string;
}
