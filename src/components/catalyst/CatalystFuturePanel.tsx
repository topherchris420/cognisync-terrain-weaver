import { useCallback, useEffect, useMemo, useState } from "react";
import { Columns2, RotateCcw, Wand2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { riskLabel } from "@/lib/absorption";
import { recordAreaM2 } from "@/lib/geo";
import {
  DEFAULT_ASSUMPTIONS,
  EMPTY_SCENARIO,
  INTERVENTIONS,
  INTERVENTION_ORDER,
  formatCompactUSD,
  formatVolumeM3,
  hasActiveInterventions,
  type InterventionKey,
  type Scenario,
} from "@/lib/scenario";
import {
  CATALYST_LIMITS,
  DEFAULT_TARGET_SCORE,
  VERDICT_COPY,
  evaluateVerdict,
  projectFuture,
  solveForTarget,
  type FutureState,
} from "@/lib/catalyst";
import { LAND_COVER_META, type LandCover, type LandCoverKey } from "@/lib/types";

interface Props {
  cover: LandCover;
  /** Raw bbox from the analysis record, used to size the site. */
  bbox: unknown;
  /** Fires whenever the modelled future changes, so the map can follow. */
  onFutureChange?: (state: { scenario: Scenario; future: FutureState } | null) => void;
  /** Opens the split-map comparison. Only offered once a future is simulated. */
  onCompare?: () => void;
  comparing?: boolean;
}

const COVER_ORDER: LandCoverKey[] = [
  "vegetation",
  "soil",
  "water",
  "buildings",
  "pavement",
];

/**
 * Catalyst // Possible futures.
 *
 * Interventions, a target-seeking solver, and a deterministic simulation of
 * the result — every figure produced by the model that already scores this
 * tile. Nothing here computes hydrology of its own; it composes what exists.
 */
export function CatalystFuturePanel({
  cover,
  bbox,
  onFutureChange,
  onCompare,
  comparing,
}: Props) {
  const [scenario, setScenario] = useState<Scenario>(EMPTY_SCENARIO);
  const [target, setTarget] = useState(DEFAULT_TARGET_SCORE);
  const [simulated, setSimulated] = useState<FutureState | null>(null);

  const areaM2 = useMemo(() => recordAreaM2({ bbox }), [bbox]);
  const future = useMemo(
    () => projectFuture(cover, scenario, areaM2, DEFAULT_ASSUMPTIONS),
    [cover, scenario, areaM2]
  );
  const active = hasActiveInterventions(scenario);

  // A new tile is a new baseline; a stale future would describe other ground.
  useEffect(() => {
    setScenario(EMPTY_SCENARIO);
    setSimulated(null);
  }, [cover]);

  useEffect(() => {
    onFutureChange?.(simulated ? { scenario, future: simulated } : null);
  }, [simulated, scenario, onFutureChange]);

  const setFraction = useCallback((key: InterventionKey, pct: number) => {
    setSimulated(null);
    setScenario((prev) => {
      const next = { ...prev, [key]: pct / 100 };
      const source = INTERVENTIONS[key].source;
      const others = INTERVENTION_ORDER.filter(
        (k) => k !== key && INTERVENTIONS[k].source === source
      ).reduce((sum, k) => sum + next[k], 0);
      next[key] = Math.min(next[key], Math.max(0, 1 - others));
      return next;
    });
  }, []);

  const solve = () => {
    const result = solveForTarget(cover, target);
    setScenario(result.scenario);
    setSimulated(null);
  };

  const solvePreview = useMemo(() => solveForTarget(cover, target), [cover, target]);
  const verdict = simulated
    ? evaluateVerdict(simulated.impact.projectedScore, target)
    : null;

  return (
    <section
      aria-label="Catalyst possible futures"
      className="catalyst-plate rounded-xl p-5"
    >
      <header>
        <h2 className="catalyst-serif text-sm uppercase text-catalyst">
          Catalyst // Possible futures
        </h2>
        <div className="catalyst-rule mt-2 w-full" aria-hidden="true" />
        <p className="catalyst-body mt-3 text-xs leading-relaxed text-muted-foreground">
          The historical layer asks what was. Mannahatta describes what is.
          Catalyst asks what could be — using the same weights, on ground that
          does not exist yet.
        </p>
      </header>

      {/* Hypothesis */}
      <div className="mt-5 flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label
            htmlFor="catalyst-target"
            className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground"
          >
            Hypothesis — reach a score of
          </Label>
          <Input
            id="catalyst-target"
            type="number"
            min={0}
            max={100}
            value={target}
            onChange={(e) => {
              const v = Number(e.target.value);
              setTarget(Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 0);
              setSimulated(null);
            }}
            className="h-8 w-24 font-mono text-xs"
          />
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={solve}
          className="h-8 gap-1.5 border-catalyst/40 text-xs text-catalyst hover:bg-catalyst/10"
        >
          <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />
          Minimum intervention
        </Button>
      </div>
      {!solvePreview.reachable && (
        <p className="catalyst-body mt-2 text-[11px] leading-relaxed text-warning">
          Converting every eligible surface on this tile reaches{" "}
          {solvePreview.ceilingScore.toFixed(1)} — a score of {target} is not
          attainable here within this intervention set. That is a finding, not
          an error.
        </p>
      )}

      {/* Interventions */}
      <div className="mt-5 space-y-4">
        {INTERVENTION_ORDER.map((key) => {
          const def = INTERVENTIONS[key];
          const sourceShare = Number(cover[def.source] ?? 0);
          const pct = Math.round(scenario[key] * 100);
          const disabled = sourceShare <= 0;
          return (
            <div key={key} className={cn(disabled && "opacity-45")}>
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor={`catalyst-${key}`} className="text-xs font-medium">
                  {def.label}
                </Label>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {pct}% of {def.source}
                </span>
              </div>
              <Slider
                id={`catalyst-${key}`}
                className="mt-2"
                value={[pct]}
                min={0}
                max={100}
                step={5}
                disabled={disabled}
                onValueChange={([v]) => setFraction(key, v)}
                aria-label={`${def.label} — percent of ${def.source} converted`}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={!active}
          onClick={() => setSimulated(future)}
          className="h-9 flex-1 bg-catalyst text-catalyst-foreground hover:bg-catalyst/90"
        >
          Simulate future
        </Button>
        {active && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-9 gap-1.5 text-xs"
            onClick={() => {
              setScenario(EMPTY_SCENARIO);
              setSimulated(null);
            }}
          >
            <RotateCcw className="h-3 w-3" aria-hidden="true" />
            Reset
          </Button>
        )}
      </div>
      {!active && (
        <p className="catalyst-body mt-2 text-[11px] text-muted-foreground">
          Choose an intervention — or let the solver find the cheapest route to
          your target — then simulate.
        </p>
      )}

      {/* Result */}
      {simulated && (
        <div className="mt-5 animate-fade-in" aria-live="polite">
          <div className="catalyst-rule w-full" aria-hidden="true" />

          <div className="mt-4 grid grid-cols-2 gap-3">
            <ScoreCard
              caption="Current"
              score={simulated.impact.baseScore}
              risk={riskLabel(simulated.impact.baseRisk)}
              runoff={simulated.runoffBeforeM3}
            />
            <ScoreCard
              caption="Catalyst future"
              score={simulated.impact.projectedScore}
              risk={riskLabel(simulated.risk)}
              runoff={simulated.runoffAfterM3}
              gold
            />
          </div>

          {/* Verdict — never "proven". */}
          {verdict && (
            <p
              className={cn(
                "mt-4 text-[11px] uppercase tracking-[0.2em]",
                VERDICT_COPY[verdict].tone
              )}
            >
              {VERDICT_COPY[verdict].label}
              <span className="ml-2 font-mono normal-case tracking-normal text-muted-foreground">
                target {target.toFixed(0)} · reached{" "}
                {simulated.impact.projectedScore.toFixed(1)}
              </span>
            </p>
          )}

          {/* Land-cover movement */}
          <dl className="mt-4 space-y-1.5">
            {COVER_ORDER.map((key) => {
              const before = Number(cover[key]) || 0;
              const after = Number(simulated.cover[key]) || 0;
              const delta = Math.round((after - before) * 10) / 10;
              if (Math.abs(delta) < 0.05) return null;
              return (
                <div
                  key={key}
                  className="flex items-baseline justify-between gap-2 text-[11px]"
                >
                  <dt className="text-muted-foreground">
                    {LAND_COVER_META[key].label}
                  </dt>
                  <dd className="font-mono tabular-nums">
                    {before.toFixed(1)}% → {after.toFixed(1)}%
                    <span
                      className={cn(
                        "ml-2",
                        delta > 0 ? "text-primary" : "text-destructive"
                      )}
                    >
                      {delta > 0 ? "+" : ""}
                      {delta.toFixed(1)}
                    </span>
                  </dd>
                </div>
              );
            })}
            {simulated.engineeredPct > 0 && (
              <div className="flex items-baseline justify-between gap-2 text-[11px]">
                <dt className="text-muted-foreground">
                  Re-engineered in place (permeable paving, green roofs)
                </dt>
                <dd className="font-mono tabular-nums text-catalyst">
                  {simulated.engineeredPct.toFixed(1)}%
                </dd>
              </div>
            )}
          </dl>

          {/* Money and water, where the footprint supports it */}
          {areaM2 > 0 ? (
            <dl className="mt-4 grid grid-cols-2 gap-3">
              <Metric
                label="Added retention"
                value={`${formatVolumeM3(simulated.impact.addedRetentionM3)}/yr`}
              />
              <Metric
                label="Runoff avoided"
                value={`${formatVolumeM3(
                  Math.max(0, simulated.runoffBeforeM3 - simulated.runoffAfterM3)
                )}/yr`}
              />
              <Metric
                label="Capital cost"
                value={formatCompactUSD(simulated.impact.capexUSD)}
              />
              <Metric
                label="Surface converted"
                value={`${(simulated.impact.totalConvertedAreaM2 / 1e4).toFixed(
                  1
                )} ha`}
              />
            </dl>
          ) : (
            <p className="catalyst-body mt-4 text-[11px] text-muted-foreground">
              This analysis stored no footprint, so volumes, areas and costs
              cannot be sized. The score and risk-band projection above are
              still exact.
            </p>
          )}

          {onCompare && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onCompare}
              className="mt-4 w-full gap-2 border-catalyst/40 text-catalyst hover:bg-catalyst/10"
            >
              <Columns2 className="h-3.5 w-3.5" aria-hidden="true" />
              {comparing ? "Comparing realities…" : "Compare realities"}
            </Button>
          )}

          {/* Integrity */}
          <details className="mt-4 text-[11px] text-muted-foreground">
            <summary className="cursor-pointer uppercase tracking-[0.2em] text-catalyst-muted">
              Assumptions & limits
            </summary>
            <ul className="catalyst-body mt-2 list-disc space-y-1 pl-4 leading-relaxed">
              <li>
                Simulated on {DEFAULT_ASSUMPTIONS.annualRainfallMm} mm of annual
                rainfall at ${DEFAULT_ASSUMPTIONS.benefitPerM3USD.toFixed(2)}/m³
                of retention benefit — both editable defaults, not local data.
              </li>
              {CATALYST_LIMITS.map((limit) => (
                <li key={limit}>{limit}</li>
              ))}
              <li>
                Catalyst reports what is supported under this simulation. It
                does not prove anything about this site.
              </li>
            </ul>
          </details>
        </div>
      )}
    </section>
  );
}

function ScoreCard({
  caption,
  score,
  risk,
  runoff,
  gold,
}: {
  caption: string;
  score: number;
  risk: string;
  runoff: number;
  gold?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        gold ? "border-catalyst/40 bg-catalyst/5" : "border-border bg-background/40"
      )}
    >
      <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
        {caption}
      </div>
      <div
        className={cn(
          "mt-1 font-mono text-2xl font-semibold tabular-nums",
          gold && "text-catalyst"
        )}
      >
        {score.toFixed(1)}
      </div>
      <div className="mt-1 text-[11px] text-muted-foreground">{risk} flood risk</div>
      {runoff > 0 && (
        <div className="mt-1 font-mono text-[10px] text-muted-foreground">
          {formatVolumeM3(runoff)}/yr runoff
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/40 p-3">
      <dt className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-sm font-semibold">{value}</dd>
    </div>
  );
}