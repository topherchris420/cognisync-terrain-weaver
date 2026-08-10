import { useState } from "react";
import { Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { riskLabel } from "@/lib/absorption";
import {
  INTERVENTIONS,
  formatCompactUSD,
  type Scenario,
} from "@/lib/scenario";
import {
  DEFAULT_TARGET_SCORE,
  evaluateVerdict,
  projectFuture,
  solveForTarget,
  VERDICT_COPY,
  type FutureState,
} from "@/lib/catalyst";
import { parseConstraint } from "@/lib/storm";
import type { LandCover } from "@/lib/types";

interface Props {
  cover: LandCover;
  areaM2: number;
  onSolved: (state: { scenario: Scenario; future: FutureState }) => void;
  solved: { scenario: Scenario; future: FutureState } | null;
  hidden?: boolean;
}

const PRESETS = [
  "Reduce flood risk under $500k",
  "Reach 45 for less than $1.2M",
  "Cut runoff with a $250,000 budget",
];

/**
 * Catalyst under constraint.
 *
 * The planner states a ceiling in plain language; the existing greedy solver
 * answers inside the same intervention space the palette exposes. No new
 * physics — just the cheapest route the model can find.
 */
export function CatalystConstraint({ cover, areaM2, onSolved, solved, hidden }: Props) {
  const [text, setText] = useState(PRESETS[0]);
  const [note, setNote] = useState<string | null>(null);

  const run = (raw: string) => {
    const constraint = parseConstraint(raw);
    const target = constraint.targetScore ?? DEFAULT_TARGET_SCORE;
    const result = solveForTarget(cover, target, areaM2, constraint.budgetUSD ?? undefined);
    const future = projectFuture(cover, result.scenario, areaM2);
    onSolved({ scenario: result.scenario, future });
    const verdict = evaluateVerdict(result.achievedScore, target);
    setNote(
      `${VERDICT_COPY[verdict].label} — target ${target.toFixed(0)}, reached ${result.achievedScore.toFixed(1)}` +
        (constraint.budgetUSD
          ? ` for ${formatCompactUSD(future.impact.capexUSD)} of a ${formatCompactUSD(constraint.budgetUSD)} ceiling`
          : "")
    );
  };

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 top-20 z-20 flex justify-center px-3 transition-all duration-700",
        hidden ? "-translate-y-6 opacity-0" : "translate-y-0 opacity-100"
      )}
    >
      <div className="catalyst-plate pointer-events-auto w-full max-w-xl rounded-xl p-3 shadow-2xl backdrop-blur-xl">
        <div className="text-[10px] uppercase tracking-[0.3em] text-catalyst-muted">
          Catalyst // constraint
        </div>
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(text);
          }}
        >
          <Input
            value={text}
            maxLength={140}
            onChange={(e) => setText(e.target.value)}
            aria-label="Design constraint"
            placeholder="Reduce flood risk under $500k"
            className="h-9 bg-background/60"
          />
          <Button type="submit" size="sm" className="shrink-0 gap-1.5">
            <Wand2 className="h-3.5 w-3.5" />
            Optimize
          </Button>
        </form>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                setText(p);
                run(p);
              }}
              className="rounded-full border border-catalyst/30 px-2.5 py-1 text-[11px] text-catalyst-muted transition-colors hover:border-catalyst/60 hover:text-catalyst"
            >
              {p}
            </button>
          ))}
        </div>

        {solved && (
          <div className="mt-2.5 border-t border-catalyst/20 pt-2">
            <div className="font-mono text-xs">
              {solved.future.impact.baseScore.toFixed(1)} →{" "}
              <span className="text-catalyst">
                {solved.future.impact.projectedScore.toFixed(1)}
              </span>{" "}
              · {riskLabel(solved.future.impact.baseRisk)} →{" "}
              {riskLabel(solved.future.risk)} ·{" "}
              {formatCompactUSD(solved.future.impact.capexUSD)}
            </div>
            <ul className="mt-1.5 space-y-0.5 text-[11px] text-muted-foreground">
              {Object.entries(solved.scenario)
                .filter(([, f]) => f > 0)
                .map(([key, f]) => (
                  <li key={key}>
                    {INTERVENTIONS[key as keyof typeof INTERVENTIONS].label} —{" "}
                    {(f * 100).toFixed(0)}% of available{" "}
                    {INTERVENTIONS[key as keyof typeof INTERVENTIONS].source}
                  </li>
                ))}
            </ul>
            {note && (
              <p className="catalyst-body mt-1.5 text-[11px] leading-snug text-muted-foreground">
                {note}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}