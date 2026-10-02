import { canonicalJson } from "@/lib/counterfactual/hashing";
import { COMPATIBLE_SCHEMA_VERSIONS } from "./config";
import { parseTileId } from "./tile-id";
import { contentHash, sha256Text, utf8 } from "./sha256";
import type { SubstrateTile, UrbanSubstrateManifest } from "./types";

/**
 * Manifest fields that describe *when* and *from which checkout* a substrate
 * was compiled, not *what* it contains. They are excluded from the manifest
 * hash, so recompiling identical content elsewhere yields the same identity.
 */
export const NON_AUTHORITATIVE_FIELDS = ["generatedAt", "compiler.commit"] as const;

/** The manifest with non-authoritative fields and its own hash removed. */
export function authoritativeManifest(manifest: UrbanSubstrateManifest) {
  const { generatedAt: _generatedAt, hashes, compiler, ...rest } = manifest;
  const { commit: _commit, ...authoritativeCompiler } = compiler;
  return { ...rest, compiler: authoritativeCompiler, hashes: { tiles: hashes.tiles } };
}

export function computeManifestHash(manifest: UrbanSubstrateManifest): string {
  return contentHash(authoritativeManifest(manifest));
}

/** Tile text exactly as published: canonical JSON plus a trailing newline. */
export function serializeTile(tile: SubstrateTile): string {
  return `${canonicalJson(tile)}\n`;
}

/** The hash recorded for a tile: SHA-256 of its canonical content. */
export function tileHash(tile: SubstrateTile): string {
  return contentHash(tile);
}

/** Hash a published tile text the way readers do: parse, then canonicalise. */
export function hashTileText(text: string): string {
  return contentHash(JSON.parse(text));
}

export function serializeManifest(manifest: UrbanSubstrateManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export function textBytes(text: string): number {
  return utf8(text).length;
}

export function tilePath(tileIdValue: string): string {
  const key = parseTileId(tileIdValue);
  if (!key) throw new Error(`Malformed tile id ${tileIdValue}.`);
  return `tiles/${key.sizeM}/${key.ix}/${key.iy}.json`;
}

export function isCompatibleSchema(version: unknown): boolean {
  return typeof version === "string" && COMPATIBLE_SCHEMA_VERSIONS.includes(version);
}

/** Short display form of a hash: algorithm and first 12 hex digits. */
export function shortHash(hash: string): string {
  const [algorithm, hex] = hash.includes(":") ? hash.split(":") : ["", hash];
  return algorithm ? `${algorithm}:${hex.slice(0, 12)}` : hex.slice(0, 12);
}

export { sha256Text };
