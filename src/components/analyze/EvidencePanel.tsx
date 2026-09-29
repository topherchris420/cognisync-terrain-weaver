import { useId, useMemo, useState } from "react";
import { classificationEnvelope, type ClassificationErrorRange } from "@/lib/classification-envelope";
import { CLASSIFICATION_ERROR } from "@/lib/evidence/ledger";
import { recordAreaM2 } from "@/lib/geo";
import type { AnalysisRecord } from "@/lib/types";

type RangeKind = ClassificationErrorRange["kind"];

/** Measured error ranges come from committed experiments (classification/C1, C2). */
const PRESETS: Record<Exclude<RangeKind, "user-selected">, ClassificationErrorRange> = {
  "benchmark-derived": {
    pp: CLASSIFICATION_ERROR.benchmarkPP,
    kind: "benchmark-derived",
    label: `Benchmark-derived ±${CLASSIFICATION_ERROR.benchmarkPP} pp`,
    source: `Mean disagreement with NLCD 2021 across ${CLASSIFICATION_ERROR.benchmarkFrames} frames (${CLASSIFICATION_ERROR.benchmarkMeasuredPP.toFixed(1)} pp)`,
  },
  "repeat-run": {
    pp: Math.round(CLASSIFICATION_ERROR.repeatRangePP / 2),
    kind: "repeat-run",
    label: `Repeat-run ±${Math.round(CLASSIFICATION_ERROR.repeatRangePP / 2)} pp`,
    source: `Half the pervious-share range of one frame classified ${CLASSIFICATION_ERROR.repeats} times`,
  },
};

export function EvidencePanel({
  analysis,
  image,
}: {
  analysis: AnalysisRecord;
  image: string | null;
}) {
  const id = useId();
  const [kind, setKind] = useState<RangeKind>("benchmark-derived");
  const [custom, setCustom] = useState(CLASSIFICATION_ERROR.benchmarkPP);
  const range = useMemo<ClassificationErrorRange>(
    () =>
      kind === "user-selected"
        ? { pp: custom, kind, label: `Chosen ±${custom} pp`, source: "User-selected; not derived from measurement" }
        : PRESETS[kind],
    [kind, custom],
  );
  const envelope = useMemo(
    () => classificationEnvelope(analysis.land_cover, recordAreaM2(analysis), 50, range),
    [analysis, range],
  );
  const example = analysis.status === "example";
  const fmt = (v: number) => Math.round(v).toLocaleString();
  return (
    <section
      className="atlas-section space-y-4"
      aria-labelledby={`${id}-heading`}
    >
      <h3 id={`${id}-heading`} className="atlas-section-title">
        What if the classification is wrong?
      </h3>
      <p className="atlas-section-note">
        {example
          ? "ILLUSTRATIVE — these land-cover shares are example inputs."
          : "INFERRED — a vision model estimated these shares from imagery."}{" "}
        The score is derived using fixed coefficients. It has not been validated
        against observed flooding.
      </p>
      {image && (
        <details>
          <summary className="cursor-pointer text-sm">
            Inspect the captured imagery
          </summary>
          <img
            src={image}
            alt="Captured map imagery supplied to the land-cover classifier"
            className="mt-3 w-full"
          />
        </details>
      )}
      <fieldset className="space-y-2 text-xs">
        <legend className="mb-1">Vegetation ↔ pavement range</legend>
        {(["benchmark-derived", "repeat-run", "user-selected"] as const).map((option) => (
          <label key={option} className="flex items-start gap-2">
            <input
              type="radio"
              name={`${id}-range`}
              checked={kind === option}
              onChange={() => setKind(option)}
              className="mt-0.5 accent-primary"
            />
            <span>
              {option === "user-selected" ? "Choose my own" : PRESETS[option].label}
              <small className="block text-muted-foreground">
                {option === "user-selected" ? "A what-if, not derived from measurement" : PRESETS[option].source}
              </small>
            </span>
          </label>
        ))}
      </fieldset>
      {kind === "user-selected" && (
        <>
          <label htmlFor={`${id}-shift`} className="block text-xs">
            Vegetation ↔ pavement uncertainty: ±{custom} percentage points of the
            whole frame
          </label>
          <input
            id={`${id}-shift`}
            type="range"
            min="1"
            max="20"
            step="1"
            value={custom}
            onChange={(e) => setCustom(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </>
      )}
      <dl className="atlas-ledger" aria-label="Classification sensitivity envelope">
        <div>
          <dt>Pavement</dt>
          <dd>
            {envelope.pavementPercent.central.toFixed(0)}% ({envelope.pavementPercent.min.toFixed(0)}–{envelope.pavementPercent.max.toFixed(0)}%)
          </dd>
        </div>
        <div>
          <dt>Score</dt>
          <dd>
            {envelope.score.central.toFixed(1)} ({envelope.score.min.toFixed(1)}–{envelope.score.max.toFixed(1)})
          </dd>
        </div>
        <div>
          <dt>50 mm runoff, m³</dt>
          <dd>
            {fmt(envelope.nowRunoffM3.central)} ({fmt(envelope.nowRunoffM3.min)}–{fmt(envelope.nowRunoffM3.max)})
          </dd>
        </div>
      </dl>
      <div className="overflow-x-auto">
        <table className="w-full text-xs tabular-nums">
          <caption className="mb-2 text-left text-muted-foreground">
            50 mm bulk rainfall experiment · no interventions
          </caption>
          <thead>
            <tr>
              <th className="text-left py-2">Vegetation shift</th>
              <th>Score</th>
              <th>Runoff (m³)</th>
            </tr>
          </thead>
          <tbody>
            {envelope.rows.map((row, index) => (
              <tr key={index} className="border-t border-border">
                <th className="text-left py-2 font-normal">
                  {index === 1
                    ? "As classified"
                    : `${row.shiftPP > 0 ? "+" : ""}${row.shiftPP.toFixed(1)} pp`}
                </th>
                <td className="text-center">{row.score.toFixed(1)}</td>
                <td className="text-center">{fmt(row.nowRunoffM3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        A sensitivity range, not a confidence interval. The measured ranges come
        from comparing past classifications with an independent map and with
        each other; they do not cover every source of error. Transfers are capped
        by available vegetation or pavement; water, roofs and soil stay fixed.
        These experiments do not change the study. Fixed coefficients do not
        model saturation or drainage.
      </p>
    </section>
  );
}
