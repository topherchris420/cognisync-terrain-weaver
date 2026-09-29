import type { ExperimentResult, ExperimentSpec, ResultTable } from "./experiment";

export interface RecordedInput {
  path: string;
  contentHash: string;
  source: string;
  retrievedAt: string;
  evidence: string;
}

export interface RunRecord {
  codeCommit: string;
  workingTreeDirty: boolean;
  ranAt: string;
  runtime: string;
}

const VERDICT_WORD: Record<ExperimentResult["verdict"]["status"], string> = {
  supported: "SUPPORTED",
  "not-supported": "NOT SUPPORTED",
  inconclusive: "INCONCLUSIVE",
  descriptive: "DESCRIPTIVE (no hypothesis tested)",
};

const TIER_MEANING: Record<ExperimentSpec["tier"], string> = {
  "synthetic-verification": "Synthetic verification: does the code reproduce known analytic answers?",
  "internal-consistency": "Internal consistency: do the instrument's own parts agree? Says nothing about nature.",
  "repeated-measurement": "Repeated measurement: how stable is an output under repetition or resampling?",
  "reference-model": "Reference model: comparison with an independent published model, not with observations.",
  "reference-dataset": "Reference dataset: comparison with an independent map or remote-sensing product, which has its own error.",
  "independent-observation": "Independent observation: comparison with observations of outcomes that the model never used.",
};

function table(t: ResultTable): string {
  const esc = (v: unknown) => (v === null || v === undefined ? "—" : String(v).replace(/\|/g, "\\|"));
  return [
    `**${t.title}**`,
    "",
    `| ${t.columns.map(esc).join(" | ")} |`,
    `|${t.columns.map(() => "---").join("|")}|`,
    ...t.rows.map((row) => `| ${row.map(esc).join(" | ")} |`),
  ].join("\n");
}

export function renderReport(
  spec: ExperimentSpec,
  result: ExperimentResult,
  inputs: RecordedInput[],
  versions: Record<string, string>,
  run: RunRecord,
  resultHash: string,
): string {
  return [
    `# ${spec.title}`,
    "",
    `\`${spec.id}\` · ${TIER_MEANING[spec.tier]}`,
    "",
    "## Question",
    "",
    spec.question,
    "",
    "## Hypothesis",
    "",
    spec.hypothesis ?? "None. This is a descriptive measurement.",
    "",
    "## Result",
    "",
    `**${VERDICT_WORD[result.verdict.status]}.** ${result.verdict.statement}`,
    "",
    ...result.observations.map((o) => `- ${o}`),
    "",
    ...result.tables.flatMap((t) => [table(t), ""]),
    "## Headline findings (machine-readable)",
    "",
    "| finding | value |",
    "|---|---|",
    ...Object.entries(result.findings).map(([k, v]) => `| ${k} | ${v === null ? "—" : String(v)} |`),
    "",
    "## Calibration / validation boundary",
    "",
    spec.split,
    "",
    "## Conditions",
    "",
    ...Object.entries(spec.conditions).map(([k, v]) => `- ${k}: ${String(v)}`),
    "",
    "## Limitations",
    "",
    ...spec.limitations.map((l) => `- ${l}`),
    "",
    "## Reproduce",
    "",
    "```bash",
    `npm run experiment -- ${spec.id}`,
    "```",
    "",
    `Inputs are frozen fixtures; no network access is needed. Result hash \`${resultHash}\`. CI re-runs this experiment and fails if the committed result no longer matches the code.`,
    "",
    "| input | evidence | source | retrieved | content hash |",
    "|---|---|---|---|---|",
    ...(inputs.length ? inputs.map((i) => `| ${i.path} | ${i.evidence} | ${i.source} | ${i.retrievedAt.slice(0, 10)} | \`${i.contentHash}\` |`) : ["| (none: analytic or built-in inputs) | | | | |"]),
    "",
    "| model component | version |",
    "|---|---|",
    ...Object.entries(versions).map(([k, v]) => `| ${k} | \`${v}\` |`),
    "",
    `Run at ${run.ranAt} from commit \`${run.codeCommit}\`${run.workingTreeDirty ? " with uncommitted changes (the commit that adds this report contains them)" : ""} on ${run.runtime}.`,
    "",
  ].join("\n");
}
