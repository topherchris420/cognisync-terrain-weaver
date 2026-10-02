import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { SUBSTRATE_INDEX_FILE } from "../../src/lib/urban-substrate/config";
import { tilePath } from "../../src/lib/urban-substrate/manifest";
import type { SubstrateReader } from "../../src/lib/urban-substrate/replay";
import type { SourceFixture } from "../../src/lib/urban-substrate/types";

/** A substrate directory on disk, read synchronously (replay and checks). */
export function directoryReader(directory: string): SubstrateReader {
  const read = (path: string) => {
    const file = resolve(directory, path);
    return existsSync(file) ? readFileSync(file, "utf8") : null;
  };
  return { location: directory, manifest: () => read("manifest.json"), tile: (id) => read(tilePath(id)) };
}

/** Every published substrate under a root (e.g. public/substrate), by manifest hash. */
export function publishedSubstrates(root: string): Array<{ directory: string; manifestHash: string | null }> {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(resolve(root, entry.name, "manifest.json")))
    .map((entry) => {
      const directory = resolve(root, entry.name);
      try {
        const manifest = JSON.parse(readFileSync(resolve(directory, "manifest.json"), "utf8")) as { hashes?: { manifest?: string } };
        return { directory, manifestHash: manifest.hashes?.manifest ?? null };
      } catch {
        return { directory, manifestHash: null };
      }
    })
    .sort((a, b) => (a.directory < b.directory ? -1 : 1));
}

export function fixtureLoader(dataRoot: string) {
  return <T>(path: string) => JSON.parse(readFileSync(resolve(dataRoot, path), "utf8")) as SourceFixture<T>;
}

export const INDEX_FILE = SUBSTRATE_INDEX_FILE;
