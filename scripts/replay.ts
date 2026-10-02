/**
 * Replay an experiment export and verify it.
 *
 *   npm run replay -- path/to/experiment.json
 *   npm run replay -- path/to/experiment.json --substrate public/substrate/<label>
 *
 * Checks the evidence hash, storm seal and elevation identity; when the
 * experiment used an urban substrate, reconstructs every recorded tile and
 * the manifest from their hashes; then re-routes NOW and POSSIBLE with the
 * current engine and compares every recorded volume. Exits non-zero unless
 * the export is reproduced exactly. Current substrate data is never
 * substituted for the substrate an experiment recorded.
 */
import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { replayExperiment } from "@/lib/experiment-replay";
import { describeMismatches } from "@/lib/urban-substrate/replay";
import type { SubstrateEvidence } from "@/lib/urban-substrate/identity";
import { directoryReader, publishedSubstrates } from "./lib/substrate-store";

const ROOT = resolve(import.meta.dirname ?? __dirname, "..");
const args = process.argv.slice(2);
const flag = args.indexOf("--substrate");
const substrateDir = flag >= 0 ? args[flag + 1] : null;
const file = args.find((a, i) => !a.startsWith("--") && (flag < 0 || i !== flag + 1));
if (!file) {
  console.error("Usage: npm run replay -- <experiment.json> [--substrate <directory>]");
  process.exit(2);
}
const exported = JSON.parse(readFileSync(file, "utf8"));
const described = (exported.substrate ?? null) as SubstrateEvidence | null;

/** The store holding the claimed manifest; else one with the same version label (for diagnostics). */
function findSubstrate() {
  if (substrateDir) return directoryReader(resolve(substrateDir));
  if (!described || described.state.status !== "loaded") return null;
  const state = described.state;
  const published = publishedSubstrates(resolve(ROOT, "public/substrate"));
  const exact = published.find((p) => p.manifestHash === state.manifestHash);
  if (exact) return directoryReader(exact.directory);
  const sameLabel = published.find((p) => basename(p.directory) === state.substrateVersion);
  return sameLabel ? directoryReader(sameLabel.directory) : null;
}

const report = replayExperiment(exported, { substrate: findSubstrate() });
for (const check of report.checks) console.log(`${check.passed ? "PASS" : "FAIL"}  ${check.label.padEnd(36)} ${check.detail}`);
if (report.reproduced) {
  console.log("\nReproduced: every input verified and every output matched.");
  process.exit(0);
}
console.log(`\nREPLAY FAILED${report.sameModel ? "" : " (different routing model: read the differences as a comparison)"}\n`);
for (const line of describeMismatches(report.substrateMismatches)) console.log(line);
process.exit(1);
