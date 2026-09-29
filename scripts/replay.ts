/**
 * Replay an experiment export and verify it.
 *
 *   npm run replay -- path/to/experiment.json
 *
 * Checks the evidence hash, storm seal and elevation identity, re-routes NOW
 * and POSSIBLE with the current engine, and compares every recorded volume.
 * Exits non-zero unless the export is reproduced exactly.
 */
import { readFileSync } from "node:fs";
import { replayExperiment } from "@/lib/experiment-replay";

const file = process.argv[2];
if (!file) {
  console.error("Usage: npm run replay -- <experiment.json>");
  process.exit(2);
}
const report = replayExperiment(JSON.parse(readFileSync(file, "utf8")));
for (const check of report.checks) console.log(`${check.passed ? "PASS" : "FAIL"}  ${check.label.padEnd(36)} ${check.detail}`);
console.log(report.reproduced ? "\nReproduced: every input verified and every output matched." : `\nNot reproduced${report.sameModel ? "" : " (different routing model: read the differences as a comparison)"}.`);
process.exit(report.reproduced ? 0 : 1);
