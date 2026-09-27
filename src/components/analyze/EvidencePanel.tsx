import { useId, useMemo, useState } from "react";
import { landCoverSensitivity } from "@/lib/land-cover-sensitivity";
import { recordAreaM2 } from "@/lib/geo";
import type { AnalysisRecord } from "@/lib/types";

export function EvidencePanel({
  analysis,
  image,
}: {
  analysis: AnalysisRecord;
  image: string | null;
}) {
  const id = useId();
  const [shift, setShift] = useState(5);
  const rows = useMemo(
    () =>
      landCoverSensitivity(
        analysis.land_cover,
        recordAreaM2(analysis),
        50,
        shift,
      ),
    [analysis, shift],
  );
  const example = analysis.status === "example";
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
      <label htmlFor={`${id}-shift`} className="block text-xs">
        Vegetation ↔ pavement uncertainty: ±{shift} percentage points of the
        whole frame
      </label>
      <input
        id={`${id}-shift`}
        type="range"
        min="1"
        max="15"
        step="1"
        value={shift}
        onChange={(e) => setShift(Number(e.target.value))}
        className="w-full accent-primary"
      />
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
            {rows.map((row, index) => (
              <tr key={index} className="border-t border-border">
                <th className="text-left py-2 font-normal">
                  {index === 1
                    ? "As classified"
                    : `${row.shiftPP > 0 ? "+" : ""}${row.shiftPP.toFixed(1)} pp`}
                </th>
                <td className="text-center">{row.score.toFixed(1)}</td>
                <td className="text-center">
                  {Math.round(row.runoffM3).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        A user-selected sensitivity range, not a confidence interval. Transfers
        are capped by available vegetation or pavement; water, roofs and soil
        stay fixed. These experiments do not change the study. Fixed
        coefficients do not model saturation or drainage.
      </p>
    </section>
  );
}
