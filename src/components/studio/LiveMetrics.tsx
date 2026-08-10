import { cn } from "@/lib/utils";
import { riskLabel } from "@/lib/absorption";
import { formatCompactUSD, formatVolumeM3, type ScenarioImpact } from "@/lib/scenario";
import type { FloodRisk } from "@/lib/types";

interface Props {
  score: number;
  risk: FloodRisk;
  impact: ScenarioImpact | null;
  /** Storm runoff volume (m³) from the last simulation, if any. */
  runoffM3: number | null;
  projectedRunoffM3: number | null;
  provenance: string;
  hidden?: boolean;
}

function Cell({
  label,
  value,
  delta,
  tone,
}: {
  label: string;
  value: string;
  delta?: string | null;
  tone?: "good" | "bad" | null;
}) {
  return (
    <div className="min-w-[5.5rem]">
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 font-mono text-lg font-semibold tabular-nums leading-none">
        {value}
      </div>
      {delta && (
        <div
          className={cn(
            "mt-1 font-mono text-[11px] tabular-nums",
            tone === "good" ? "text-primary" : tone === "bad" ? "text-destructive" : "text-muted-foreground"
          )}
        >
          {delta}
        </div>
      )}
    </div>
  );
}

/**
 * The instrument cluster. Every edit to the ground moves these numbers in the
 * same breath — score, risk, capital, retention, storm runoff.
 */
export function LiveMetrics({
  score,
  risk,
  impact,
  runoffM3,
  projectedRunoffM3,
  provenance,
  hidden,
}: Props) {
  const projected = impact?.projectedScore ?? score;
  const changed = Boolean(impact && Math.abs(impact.scoreDelta) >= 0.05);

  return (
    <div
      className={cn(
        "pointer-events-none absolute bottom-3 left-3 z-20 transition-all duration-700",
        hidden ? "translate-y-24 opacity-0" : "translate-y-0 opacity-100"
      )}
    >
      <div className="pointer-events-auto rounded-xl border border-border/70 bg-background/80 px-4 py-3 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
          <Cell
            label="Absorption"
            value={changed ? projected.toFixed(1) : score.toFixed(1)}
            delta={
              changed
                ? `${impact!.scoreDelta > 0 ? "+" : ""}${impact!.scoreDelta.toFixed(1)} from ${score.toFixed(1)}`
                : null
            }
            tone={changed && impact!.scoreDelta > 0 ? "good" : "bad"}
          />
          <Cell
            label="Flood risk"
            value={riskLabel(changed ? impact!.projectedRisk : risk)}
            delta={changed && impact!.projectedRisk !== impact!.baseRisk ? `was ${riskLabel(impact!.baseRisk)}` : null}
            tone="good"
          />
          <Cell
            label="Capital"
            value={impact && impact.capexUSD > 0 ? formatCompactUSD(impact.capexUSD) : "—"}
            delta={
              impact && impact.addedRetentionM3 > 0
                ? `+${formatVolumeM3(impact.addedRetentionM3)}/yr retained`
                : null
            }
          />
          <Cell
            label="Storm runoff"
            value={runoffM3 != null ? formatVolumeM3(runoffM3) : "—"}
            delta={
              runoffM3 != null && projectedRunoffM3 != null && projectedRunoffM3 < runoffM3
                ? `→ ${formatVolumeM3(projectedRunoffM3)} redesigned`
                : null
            }
            tone="good"
          />
        </div>
        <p className="mt-2 max-w-md text-[10px] leading-snug text-muted-foreground">
          {provenance}
        </p>
      </div>
    </div>
  );
}