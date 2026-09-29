/**
 * Run registered experiments against frozen fixtures and write their records.
 *
 *   npm run experiment                      # all experiments
 *   npm run experiment -- routing           # one domain
 *   npm run experiment -- routing/R1-synthetic-terrains
 *   npm run validate                        # re-run all, fail if any committed result changed
 *
 * Writes, per experiment, experiments/<id>/{experiment.json,result.json,run.json,REPORT.md},
 * then regenerates experiments/INDEX.md, experiments/TRIPWIRES.md and the
 * compact findings the app displays (src/lib/evidence/findings.json).
 * No network access: experiments read only experiments/data/.
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { stableHash } from "@/lib/counterfactual/hashing";
import { ASSUMPTIONS } from "@/lib/assumptions/registry";
import { modelVersions, resultHash, type ExperimentResult, type Fixture, type FixtureLoader } from "@/lib/validation/experiment";
import { EXPERIMENTS, findExperiment } from "@/lib/validation/registry";
import { renderReport, type RecordedInput, type RunRecord } from "@/lib/validation/report";
import { evaluateTripwires, renderTripwires } from "@/lib/validation/tripwires";

const ROOT = resolve(import.meta.dirname ?? __dirname, "..");
const OUT = resolve(ROOT, "experiments");
const DATA = resolve(OUT, "data");

const args = process.argv.slice(2);
const check = args.includes("--check");
const queries = args.filter((a) => !a.startsWith("--"));
const selected = queries.length ? [...new Set(queries.flatMap(findExperiment))] : EXPERIMENTS;
if (selected.length === 0) {
  console.error(`No experiment matches ${queries.join(", ")}. Registered:\n${EXPERIMENTS.map((e) => `  ${e.spec.id}`).join("\n")}`);
  process.exit(2);
}

function git(command: string, fallback: string) {
  try {
    return execSync(`git ${command}`, { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return fallback;
  }
}

function recordingLoader() {
  const recorded = new Map<string, RecordedInput>();
  const cache = new Map<string, Fixture<unknown>>();
  const load: FixtureLoader = <T>(path: string) => {
    if (!cache.has(path)) cache.set(path, JSON.parse(readFileSync(resolve(DATA, path), "utf8")));
    const fixture = cache.get(path) as Fixture<T>;
    recorded.set(path, {
      path,
      contentHash: fixture.provenance.contentHash,
      source: fixture.provenance.source,
      retrievedAt: fixture.provenance.retrievedAt,
      evidence: fixture.provenance.evidence,
    });
    return fixture;
  };
  return { load, recorded };
}

/** Collapse many files in one directory (e.g. 48 DEM fixtures) into one auditable row. */
function summarizeInputs(inputs: RecordedInput[]): RecordedInput[] {
  const byDir = new Map<string, RecordedInput[]>();
  for (const input of [...inputs].sort((a, b) => a.path.localeCompare(b.path))) {
    const dir = input.path.includes("/") ? input.path.split("/")[0] : "";
    byDir.set(dir, [...(byDir.get(dir) ?? []), input]);
  }
  return [...byDir.entries()].flatMap(([dir, items]) =>
    dir && items.length > 4
      ? [{ ...items[0], path: `${dir}/ (${items.length} files)`, contentHash: stableHash(items.map((i) => [i.path, i.contentHash])) }]
      : items,
  );
}

const write = (path: string, text: string) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
};

const run: RunRecord = {
  codeCommit: git("rev-parse --short HEAD", "unknown"),
  workingTreeDirty: git("status --porcelain", "") !== "",
  ranAt: new Date().toISOString(),
  runtime: `Node ${process.version}`,
};

let failures = 0;
const reproduced = new Map<string, ExperimentResult>();
for (const experiment of selected) {
  const { spec } = experiment;
  const dir = resolve(OUT, spec.id);
  const started = Date.now();
  const { load, recorded } = recordingLoader();
  const result = experiment.run(load);
  const hash = resultHash(result);
  const inputs = summarizeInputs([...recorded.values()]);
  const versions = modelVersions();
  const committedPath = resolve(dir, "result.json");
  const committed = existsSync(committedPath) ? (JSON.parse(readFileSync(committedPath, "utf8")) as { resultHash: string }).resultHash : null;
  const status = committed === hash ? "unchanged" : committed ? "CHANGED" : "new";
  console.log(`${spec.id.padEnd(48)} ${result.verdict.status.padEnd(14)} ${status.padEnd(9)} ${Date.now() - started} ms`);
  reproduced.set(spec.id, result);
  if (check) {
    if (committed !== hash) {
      failures += 1;
      console.error(`  committed ${committed ?? "(none)"} ≠ reproduced ${hash}. Re-run \`npm run experiment -- ${spec.id}\`, review REPORT.md, and commit.`);
    }
    continue;
  }
  write(resolve(dir, "experiment.json"), `${JSON.stringify({ spec, inputs, modelVersions: versions }, null, 2)}\n`);
  write(committedPath, `${JSON.stringify({ resultHash: hash, result }, null, 2)}\n`);
  write(resolve(dir, "run.json"), `${JSON.stringify(run, null, 2)}\n`);
  write(resolve(dir, "REPORT.md"), renderReport(spec, result, inputs, versions, run, hash));
}

if (check) {
  // The app displays findings.json; it must equal what the experiments produce.
  const shipped = JSON.parse(readFileSync(resolve(ROOT, "src/lib/evidence/findings.json"), "utf8")) as Record<string, { findings: unknown; verdict: unknown }>;
  for (const [id, result] of reproduced) {
    if (JSON.stringify(shipped[id]?.findings) !== JSON.stringify(result.findings) || JSON.stringify(shipped[id]?.verdict) !== JSON.stringify(result.verdict)) {
      failures += 1;
      console.error(`src/lib/evidence/findings.json is stale for ${id}. Re-run \`npm run experiment\`.`);
    }
  }
  if (failures) {
    console.error(`${failures} experiment result(s) no longer reproduce.`);
    process.exit(1);
  }
  console.log("All committed experiment results reproduce.");
  process.exit(0);
}

/* ------------------------------------------------ index, tripwires, findings */

const all = EXPERIMENTS.flatMap((experiment) => {
  const path = resolve(OUT, experiment.spec.id, "result.json");
  if (!existsSync(path)) return [];
  const { result } = JSON.parse(readFileSync(path, "utf8")) as { result: ExperimentResult };
  return [{ spec: experiment.spec, result }];
});

const findings = Object.fromEntries(
  all.map(({ spec, result }) => [spec.id, { title: spec.title, domain: spec.domain, tier: spec.tier, verdict: result.verdict, findings: result.findings }]),
);
write(resolve(ROOT, "src/lib/evidence/findings.json"), `${JSON.stringify(findings, null, 2)}\n`);

const tripwires = evaluateTripwires(ASSUMPTIONS, findings);
write(resolve(OUT, "TRIPWIRES.md"), renderTripwires(tripwires));

write(
  resolve(OUT, "INDEX.md"),
  [
    "# Experiment index",
    "",
    "Generated by `npm run experiment`. Each row links to a report with its question, inputs, result, limitations and reproduction command. See [README](README.md) for conventions and [PREREGISTRATION](PREREGISTRATION.md) for the declared validation protocol.",
    "",
    "| experiment | evidence tier | verdict | statement |",
    "|---|---|---|---|",
    ...all.map(({ spec, result }) => `| [${spec.id}](${spec.id}/REPORT.md) | ${spec.tier} | **${result.verdict.status}** | ${result.verdict.statement.replace(/\|/g, "\\|")} |`),
    "",
    `Tripwires: ${tripwires.filter((t) => t.state === "tripped").length} tripped, ${tripwires.filter((t) => t.state === "clear").length} clear, ${tripwires.filter((t) => t.state === "qualitative").length} qualitative. See [TRIPWIRES](TRIPWIRES.md).`,
    "",
  ].join("\n"),
);
console.log("Updated experiments/INDEX.md, experiments/TRIPWIRES.md, src/lib/evidence/findings.json");
