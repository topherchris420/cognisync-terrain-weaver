/**
 * Compile the urban substrate from frozen public records, or check that the
 * published substrate is exactly what the frozen records compile to.
 *
 *   npm run substrate:compile     # write public/substrate/<label>/ and the index
 *   npm run substrate:check       # fail if any published byte differs (run by `npm run validate`)
 *
 * No network access: sources are the fixtures under experiments/data/substrate/.
 * Recompiling unchanged content keeps the previous generatedAt and commit,
 * which are recorded but excluded from every hash, so a recompile is never a
 * spurious diff.
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { compileSubstrate } from "@/lib/urban-substrate/compiler";
import { SUBSTRATE_PUBLIC_DIR, SUBSTRATE_SCHEMA_VERSION } from "@/lib/urban-substrate/config";
import { computeManifestHash, serializeManifest } from "@/lib/urban-substrate/manifest";
import { NYC_LOWER_MANHATTAN, NYC_LOWER_MANHATTAN_SOURCES } from "@/lib/urban-substrate/regions";
import { loadSources } from "@/lib/urban-substrate/sources";
import type { SubstrateIndex } from "@/lib/urban-substrate/loader";
import type { UrbanSubstrateManifest } from "@/lib/urban-substrate/types";
import { fixtureLoader, INDEX_FILE } from "./lib/substrate-store";

const ROOT = resolve(import.meta.dirname ?? __dirname, "..");
const PUBLIC = resolve(ROOT, "public", SUBSTRATE_PUBLIC_DIR);
const DATA = resolve(ROOT, "experiments/data");
const mode = process.argv[2] ?? "compile";
if (mode !== "compile" && mode !== "check") {
  console.error("Usage: vite-node scripts/substrate.ts compile|check");
  process.exit(2);
}

function git(command: string): string | null {
  try {
    return execSync(`git ${command}`, { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] }).toString().trim() || null;
  } catch {
    return null;
  }
}

function listFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory).flatMap((name) => {
    const path = resolve(directory, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

const config = NYC_LOWER_MANHATTAN;
const directory = resolve(PUBLIC, config.label);
const manifestPath = resolve(directory, "manifest.json");
const previous = existsSync(manifestPath) ? (JSON.parse(readFileSync(manifestPath, "utf8")) as UrbanSubstrateManifest) : null;

const started = Date.now();
const compiled = compileSubstrate(loadSources(fixtureLoader(DATA), NYC_LOWER_MANHATTAN_SOURCES), config, {
  generatedAt: new Date().toISOString(),
  commit: git("rev-parse --short HEAD"),
});
const compileMs = Date.now() - started;
const { manifest } = compiled;
const unchanged = previous?.hashes.manifest === manifest.hashes.manifest;
if (unchanged && previous) {
  manifest.generatedAt = previous.generatedAt;
  manifest.compiler.commit = previous.compiler.commit;
}
if (computeManifestHash(manifest) !== manifest.hashes.manifest) throw new Error("Non-authoritative fields leaked into the manifest hash.");

const index: SubstrateIndex = {
  schemaVersion: SUBSTRATE_SCHEMA_VERSION,
  substrates: [{ label: config.label, title: config.title, path: config.label, manifestHash: manifest.hashes.manifest, bounds: manifest.bounds }],
};
const expected = new Map<string, string>([
  [manifestPath, serializeManifest(manifest)],
  [resolve(PUBLIC, INDEX_FILE), `${JSON.stringify(index, null, 2)}\n`],
  ...[...compiled.texts.entries()].map(([id, text]): [string, string] => [resolve(directory, manifest.tiles[id].path), text]),
]);

const tiles = Object.values(manifest.tiles);
const summary = [
  `${config.label}: ${tiles.filter((t) => t.level === "local").length} local + ${tiles.filter((t) => t.level === "context").length} context tiles, ${(tiles.reduce((s, t) => s + t.bytes, 0) / 1024).toFixed(0)} KiB`,
  `manifest ${manifest.hashes.manifest}`,
  `validation: ${manifest.validation.errors} errors, ${manifest.validation.warnings} warnings; compiled in ${compileMs} ms`,
];

if (mode === "check") {
  const problems: string[] = [];
  if (manifest.validation.errors > 0) problems.push(`substrate validation reports ${manifest.validation.errors} error(s)`);
  for (const [path, text] of expected) {
    if (!existsSync(path)) problems.push(`missing ${relative(ROOT, path)}`);
    else if (path === manifestPath) {
      if (previous?.hashes.manifest !== manifest.hashes.manifest) problems.push(`manifest hash ${previous?.hashes.manifest ?? "(none)"} ≠ recompiled ${manifest.hashes.manifest}`);
    } else if (readFileSync(path, "utf8") !== text) problems.push(`stale ${relative(ROOT, path)}`);
  }
  for (const file of listFiles(directory)) if (!expected.has(file)) problems.push(`unexpected ${relative(ROOT, file)}`);
  summary.forEach((line) => console.log(line));
  if (problems.length) {
    problems.slice(0, 20).forEach((p) => console.error(`  ${p}`));
    console.error(`Published substrate does not match its frozen sources (${problems.length} problem(s)). Run \`npm run substrate:compile\`, review, and commit.`);
    process.exit(1);
  }
  console.log("Published substrate reproduces byte for byte from frozen sources.");
  process.exit(0);
}

for (const file of listFiles(directory)) if (!expected.has(file)) rmSync(file);
for (const [path, text] of expected) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}
summary.forEach((line) => console.log(line));
for (const check of manifest.validation.checks) console.log(`  ${check.passed ? "ok  " : check.severity === "error" ? "FAIL" : "warn"} ${check.label}: ${check.detail}`);
console.log(unchanged ? "Content unchanged; previous generatedAt and commit kept." : `Wrote ${relative(ROOT, directory)}.`);
if (manifest.validation.errors > 0) process.exit(1);
