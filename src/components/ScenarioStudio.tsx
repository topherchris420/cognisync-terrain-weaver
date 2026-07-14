import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Banknote,
  Droplets,
  Info,
  RotateCcw,
  Timer,
  TrendingUp,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { riskLabel } from "@/lib/absorption";
import { recordAreaM2 } from "@/lib/geo";
import {
  DEFAULT_ASSUMPTIONS,
  EMPTY_SCENARIO,
  INTERVENTIONS,
  INTERVENTION_ORDER,
  assessScenario,
  formatCompactUSD,
  formatVolumeM3,
  hasActiveInterventions,
  type Scenario,
  type ScenarioAssumptions,
  type ScenarioExport,
} from "@/lib/scenario";
import type { LandCover } from "@/lib/types";

interface Props {
  cover: LandCover;
  /** Raw bbox from the analysis record — used to size the site footprint. */
  bbox: unknown;
  /** Fires with the current scenario whenever it changes (null when empty). */
  onScenarioChange?: (payload: ScenarioExport | null) => void;
}

const riskBadgeClass = (risk: string) =>
  risk === "low"
    ? "border-primary/30 bg-primary/10 text-primary"
    : risk === "moderate"
    ? "border-warning/30 bg-warning/10 text-warning"
    : "border-destructive/30 bg-destructive/10 text-destructive";

/**
 * Scenario Studio — interactive what-if modeling over an analyzed tile.
 * Planners drag intervention sliders; the projected Urban Absorption Score,
 * stormwater retention, capital cost, and payback update live, using the
 * same transparent weights that produce the base score.
 */
export function ScenarioStudio({ cover, bbox, onScenarioChange }: Props) {
  const [scenario, setScenario] = useState<Scenario>(EMPTY_SCENARIO);
  const [rainfallMm, setRainfallMm] = useState(
    DEFAULT_ASSUMPTIONS.annualRainfallMm
  );

  const areaM2 = useMemo(() => recordAreaM2({ bbox }), [bbox]);
  const assumptions = useMemo<ScenarioAssumptions>(
    () => ({ ...DEFAULT_ASSUMPTIONS, annualRainfallMm: rainfallMm }),
    [rainfallMm]
  );
  const impact = useMemo(
    () => assessScenario(cover, scenario, areaM2, assumptions),
    [cover, scenario, areaM2, assumptions]
  );
  const active = hasActiveInterventions(scenario);

  // A new analysis means a new baseline — stale sliders would mislead.
  useEffect(() => {
    setScenario(EMPTY_SCENARIO);
  }, [cover]);

  useEffect(() => {
    onScenarioChange?.(active ? { scenario, impact, assumptions } : null);
  }, [active, scenario, impact, assumptions, onScenarioChange]);

  const setFraction = (key: (typeof INTERVENTION_ORDER)[number], pct: number) => {
    setScenario((prev) => {
      const next = { ...prev, [key]: pct / 100 };
      // Keep same-source sliders honest in the UI: cap the one being moved
      // so its source class can't exceed 100% conversion.
      const source = INTERVENTIONS[key].source;
      const others = INTERVENTION_ORDER.filter(
        (k) => k !== key && INTERVENTIONS[k].source === source
      ).reduce((sum, k) => sum + next[k], 0);
      next[key] = Math.min(next[key], Math.max(0, 1 - others));
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Intervention sliders */}
      <div className="space-y-4">
        {INTERVENTION_ORDER.map((key) => {
          const def = INTERVENTIONS[key];
          const sourceShare = Number(cover[def.source] ?? 0);
          const pct = Math.round(scenario[key] * 100);
          const disabled = sourceShare <= 0;
          return (
            <div key={key} className={cn(disabled && "opacity-45")}>
              <div className="flex items-baseline justify-between gap-2">
                <Label
                  htmlFor={`slider-${key}`}
                  className="text-sm font-medium"
                >
                  {def.label}
                </Label>
                <span className="font-mono text-xs text-muted-foreground">
                  {pct}% of {def.source} · ${def.unitCostUSD}/m²
                </span>
              </div>
              <Slider
                id={`slider-${key}`}
                className="mt-2"
                value={[pct]}
                min={0}
                max={100}
                step={5}
                disabled={disabled}
                onValueChange={([v]) => setFraction(key, v)}
                aria-label={`${def.label} — percent of ${def.source} converted`}
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                {disabled
                  ? `No ${def.source} detected in this tile.`
                  : def.description}
              </p>
            </div>
          );
        })}
      </div>

      {/* Rainfall assumption */}
      <div className="flex items-center gap-3">
        <Label htmlFor="rainfall" className="shrink-0 text-xs text-muted-foreground">
          Annual rainfall
        </Label>
        <Input
          id="rainfall"
          type="number"
          min={0}
          max={12000}
          value={rainfallMm}
          onChange={(e) => {
            const v = Number(e.target.value);
            setRainfallMm(
              Number.isFinite(v) ? Math.min(12000, Math.max(0, v)) : 0
            );
          }}
          className="h-8 w-24 font-mono text-xs"
        />
        <span className="text-xs text-muted-foreground">mm / year</span>
        {active && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-8 gap-1.5 text-xs"
            onClick={() => setScenario(EMPTY_SCENARIO)}
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </Button>
        )}
      </div>

      {/* Projection */}
      <div
        className={cn(
          "rounded-xl border p-4 transition-colors",
          active ? "border-primary/40 panel" : "border-dashed border-border"
        )}
        aria-live="polite"
      >
        {!active ? (
          <p className="text-xs text-muted-foreground">
            Drag a slider to model an intervention. The projected score,
            retention volume, and investment case update instantly.
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-2xl font-semibold text-muted-foreground">
                  {impact.baseScore.toFixed(0)}
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <span className="font-mono text-3xl font-bold text-primary">
                  {impact.projectedScore.toFixed(0)}
                </span>
                <span className="rounded-full bg-primary/15 px-2 py-0.5 font-mono text-xs font-semibold text-primary">
                  +{impact.scoreDelta.toFixed(1)}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 font-medium",
                    riskBadgeClass(impact.baseRisk)
                  )}
                >
                  {riskLabel(impact.baseRisk)}
                </span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 font-medium",
                    riskBadgeClass(impact.projectedRisk)
                  )}
                >
                  {riskLabel(impact.projectedRisk)}
                </span>
              </div>
            </div>

            {areaM2 > 0 ? (
              <div className="mt-4 grid grid-cols-2 gap-3">
                {[
                  {
                    icon: Droplets,
                    label: "Added retention",
                    value: `${formatVolumeM3(impact.addedRetentionM3)}/yr`,
                    tint: "text-accent",
                  },
                  {
                    icon: Banknote,
                    label: "Capital cost",
                    value: formatCompactUSD(impact.capexUSD),
                    tint: "text-warning",
                  },
                  {
                    icon: TrendingUp,
                    label: "Annual benefit",
                    value: `${formatCompactUSD(impact.annualBenefitUSD)}/yr`,
                    tint: "text-primary",
                  },
                  {
                    icon: Timer,
                    label: "Simple payback",
                    value:
                      impact.paybackYears === null
                        ? "—"
                        : impact.paybackYears > 100
                        ? "100+ yr"
                        : `${impact.paybackYears.toFixed(1)} yr`,
                    tint: "text-foreground",
                  },
                ].map(({ icon: Icon, label, value, tint }) => (
                  <div
                    key={label}
                    className="rounded-lg border border-border/70 bg-background/40 p-3"
                  >
                    <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                      <Icon className={cn("h-3 w-3", tint)} aria-hidden="true" />
                      {label}
                    </div>
                    <div className="mt-1 font-mono text-sm font-semibold">
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">
                This analysis has no stored footprint, so volumes and costs
                can't be sized — the score projection above is still exact.
              </p>
            )}

            <div className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
              <Info className="mt-0.5 h-3 w-3 shrink-0 text-accent" aria-hidden="true" />
              <span>
                Planning-level estimate over{" "}
                {areaM2 > 0
                  ? `${(areaM2 / 1e6).toFixed(2)} km²`
                  : "the analyzed tile"}
                : unit costs and the ${assumptions.benefitPerM3USD.toFixed(2)}
                /m³ retention benefit are transparent defaults — calibrate them
                to your market before underwriting.
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
