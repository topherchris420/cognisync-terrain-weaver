import type { EvidenceStatus } from "@/lib/evidence/status";
import { EVIDENCE_META } from "@/lib/evidence/status";
import { canonicalJson } from "@/lib/counterfactual/hashing";
import { contentHash, sha256Text } from "./sha256";
import type { SourceFixture, SourceRecord } from "./types";

const EVIDENCE_STATUSES = new Set(Object.keys(EVIDENCE_META));

/** Fields without which a source cannot be cited, traced or re-fetched. */
export const REQUIRED_SOURCE_FIELDS = ["sourceId", "title", "provider", "url", "query", "retrievedAt", "license", "crs", "contentHash", "method"] as const;

/**
 * SHA-256 of a source's records. A list of records is hashed as a SET (each
 * record canonicalised, then sorted), so the order a provider happened to
 * return them in never changes the identity; positional data such as a grid
 * is hashed as it stands.
 */
export function sourceContentHash(data: unknown): string {
  if (!Array.isArray(data)) return contentHash(data);
  const records = data.map((record) => canonicalJson(record)).sort();
  return sha256Text(`[${records.join(",")}]`);
}

/**
 * A SourceRecord from a frozen fixture. The content hash is computed here,
 * from the records themselves, so a fixture cannot vouch for its own content.
 */
export function sourceRecord<T>(fixture: SourceFixture<T>, recordCount: number): SourceRecord {
  const p = fixture.provenance;
  if (!EVIDENCE_STATUSES.has(p.evidence)) {
    throw new Error(`Source ${p.sourceId} declares unknown evidence status "${p.evidence}".`);
  }
  const record: SourceRecord = {
    sourceId: p.sourceId,
    title: p.source,
    provider: p.provider,
    datasetId: p.datasetId,
    url: p.url,
    query: p.query,
    datasetVersion: p.datasetVersion,
    retrievedAt: p.retrievedAt,
    license: p.license,
    evidence: p.evidence as EvidenceStatus,
    crs: p.crs,
    recordCount,
    contentHash: sourceContentHash(fixture.data),
    method: p.method,
    caveats: [...p.caveats],
  };
  const missing = missingSourceFields(record);
  if (missing.length) throw new Error(`Source ${p.sourceId || "(unnamed)"} lacks ${missing.join(", ")}.`);
  return record;
}

export function missingSourceFields(record: Partial<SourceRecord>): string[] {
  return REQUIRED_SOURCE_FIELDS.filter((field) => {
    const value = record[field];
    return typeof value !== "string" || value.trim() === "";
  });
}

/** Short form for experiment exports and the provenance inspector. */
export function sourceSummary(record: SourceRecord) {
  return {
    sourceId: record.sourceId,
    title: record.title,
    provider: record.provider,
    datasetId: record.datasetId,
    url: record.url,
    datasetVersion: record.datasetVersion,
    retrievedAt: record.retrievedAt,
    evidence: record.evidence,
    license: record.license,
    contentHash: record.contentHash,
  };
}

export type SourceSummary = ReturnType<typeof sourceSummary>;
