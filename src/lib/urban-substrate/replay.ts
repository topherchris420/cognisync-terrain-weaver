import { computeManifestHash, hashTileText, isCompatibleSchema } from "./manifest";
import { identityHashOf, type SubstrateIdentity } from "./identity";
import type { UrbanSubstrateManifest } from "./types";

/** Synchronous access to a published substrate (a directory, an archive, memory). */
export interface SubstrateReader {
  /** Where the substrate was looked for, for diagnostics. */
  location: string;
  manifest(): string | null;
  tile(tileId: string): string | null;
}

export interface SubstrateCheck {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface SubstrateMismatch {
  kind: "missing-tile" | "tile-hash" | "manifest-hash" | "schema" | "version" | "unlisted-tile" | "identity";
  tileId?: string;
  expected: string;
  actual: string;
}

export interface SubstrateVerification {
  verified: boolean;
  checks: SubstrateCheck[];
  mismatches: SubstrateMismatch[];
}

/**
 * Verify that the substrate an experiment claims can be reconstructed exactly
 * from a reader. Fails closed: a missing manifest or tile, a different hash,
 * an incompatible schema or an internally inconsistent claim all fail, and
 * nothing current is ever substituted for what the experiment used.
 */
export function verifySubstrateIdentity(identity: SubstrateIdentity, reader: SubstrateReader | null): SubstrateVerification {
  const checks: SubstrateCheck[] = [];
  const mismatches: SubstrateMismatch[] = [];
  const add = (id: string, label: string, passed: boolean, detail: string) => checks.push({ id, label, passed, detail });
  const done = () => ({ verified: checks.every((c) => c.passed), checks, mismatches });

  const claimed = identityHashOf(identity);
  add("substrate-claim", "Substrate claim is self-consistent", claimed === identity.identityHash, claimed === identity.identityHash ? identity.identityHash : `claims ${identity.identityHash}, contents hash to ${claimed}`);
  if (claimed !== identity.identityHash) mismatches.push({ kind: "identity", expected: identity.identityHash, actual: claimed });
  add("substrate-schema-claim", "Claimed substrate schema is supported", isCompatibleSchema(identity.schemaVersion), identity.schemaVersion);
  if (!isCompatibleSchema(identity.schemaVersion)) mismatches.push({ kind: "schema", expected: "a supported schema", actual: identity.schemaVersion });

  const manifestText = reader?.manifest() ?? null;
  add("substrate-manifest-present", "Substrate manifest available", manifestText !== null, manifestText !== null ? reader!.location : `no manifest at ${reader?.location ?? "(no substrate store given)"}`);
  if (manifestText === null) {
    mismatches.push({ kind: "manifest-hash", expected: identity.manifestHash, actual: "(manifest not found)" });
    return done();
  }
  let manifest: UrbanSubstrateManifest;
  try {
    manifest = JSON.parse(manifestText) as UrbanSubstrateManifest;
  } catch {
    add("substrate-manifest-parse", "Substrate manifest readable", false, "manifest is not valid JSON");
    return done();
  }
  const schemaOk = isCompatibleSchema(manifest.schemaVersion) && manifest.schemaVersion === identity.schemaVersion;
  add("substrate-schema", "Substrate schema compatible", schemaOk, `store ${manifest.schemaVersion}, experiment ${identity.schemaVersion}`);
  if (!schemaOk) {
    mismatches.push({ kind: "schema", expected: identity.schemaVersion, actual: String(manifest.schemaVersion) });
    return done();
  }
  const recomputed = computeManifestHash(manifest);
  const manifestOk = recomputed === manifest.hashes.manifest && recomputed === identity.manifestHash;
  add("substrate-manifest-hash", "Substrate manifest hash", manifestOk, manifestOk ? recomputed : `expected ${identity.manifestHash}, store content hashes to ${recomputed}`);
  if (!manifestOk) mismatches.push({ kind: "manifest-hash", expected: identity.manifestHash, actual: recomputed });
  const versionOk = manifest.substrateVersion === identity.substrateVersion;
  add("substrate-version", "Substrate version", versionOk, `store ${manifest.substrateVersion}, experiment ${identity.substrateVersion}`);
  if (!versionOk) mismatches.push({ kind: "version", expected: identity.substrateVersion, actual: manifest.substrateVersion });

  let tilesOk = true;
  for (const id of identity.tileIds) {
    const expected = identity.tileHashes[id];
    const listed = manifest.hashes.tiles[id];
    if (listed === undefined) {
      tilesOk = false;
      mismatches.push({ kind: "unlisted-tile", tileId: id, expected, actual: "(not in manifest)" });
      continue;
    }
    const text = reader!.tile(id);
    if (text === null) {
      tilesOk = false;
      mismatches.push({ kind: "missing-tile", tileId: id, expected, actual: "(missing)" });
      continue;
    }
    let actual: string;
    try {
      actual = hashTileText(text);
    } catch {
      actual = "(unreadable)";
    }
    if (actual !== expected || listed !== expected) {
      tilesOk = false;
      mismatches.push({ kind: "tile-hash", tileId: id, expected, actual });
    }
  }
  add("substrate-tiles", "Substrate tiles reconstruct", tilesOk, tilesOk ? `${identity.tileIds.length} tiles match` : `${mismatches.filter((m) => m.tileId).length} of ${identity.tileIds.length} tiles differ or are missing`);
  return done();
}

/** Human-readable diagnostics, e.g. for `npm run replay`. */
export function describeMismatches(mismatches: SubstrateMismatch[]): string[] {
  return mismatches.flatMap((m) => {
    const title =
      m.kind === "missing-tile" ? "Substrate tile missing:" :
      m.kind === "tile-hash" ? "Substrate mismatch:" :
      m.kind === "unlisted-tile" ? "Substrate tile not in manifest:" :
      m.kind === "manifest-hash" ? "Substrate manifest mismatch:" :
      m.kind === "schema" ? "Substrate schema incompatible:" :
      m.kind === "version" ? "Substrate version mismatch:" :
      "Substrate claim inconsistent:";
    return [title, ...(m.tileId ? [`tile:     ${m.tileId}`] : []), `expected: ${m.expected}`, `actual:   ${m.actual}`, ""];
  });
}
