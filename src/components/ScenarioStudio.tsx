import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  ArrowRight,
  Banknote,
  Droplets,
  Info,
  RotateCcw,
  Timer,
  TrendingUp,
} from "lucide-react";
import { Check, PenTool } from "lucide-react";
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
  INTERVENTION_COLORS,
  INTERVENTION_ORDER,
  assessScenario,
  formatCompactUSD,
  formatVolumeM3,
  hasActiveInterventions,
  type InterventionKey,
  type Scenario,
  type ScenarioAssumptions,
  type ScenarioExport,
} from "@/lib/scenario";
import type { LandCover } from "@/lib/types";

interface Props {
  cover: LandCover;
  bbox: unknown;
  scenario: Scenario;
  activeIntervention: InterventionKey | null;
  onInterventionSelect: (key: InterventionKey) => void;
  onScenarioExport?: (payload: ScenarioExport | null) => void;
  onClearDrawings?: () => void;
  /** What has been drawn with each tool, so the list doubles as an inventory. */
  drawn?: Partial<Record<InterventionKey, { count: number; areaM2: number }>>;
  /** Tools that cannot be modeled here, with the reason shown in their place. */
  unavailable?: Partial<Record<InterventionKey, string>>;
}

function formatArea(m2: number) {
  if (m2 >= 1e6) return `${(m2 / 1e6).toFixed(2)} km²`;
  if (m2 >= 1e4) return `${(m2 / 1e4).toFixed(1)} ha`;
  return `${Math.round(m2).toLocaleString()} m²`;
}

const riskBadgeClass = (risk: string) =>
  risk === "low"
    ? "border-primary/30 bg-primary/10 text-primary"
    : risk === "moderate"
    ? "border-warning/30 bg-warning/10 text-warning"
    : "border-destructive/30 bg-destructive/10 text-destructive";

/**
 * Scenario Studio — interactive what-if modeling over an analyzed tile.
 * Geometry drawn on the map drives the projected Urban Absorption Score,
 * stormwater retention, capital cost, and payback update live, using the
 * same transparent weights that produce the base score.
 */
export function ScenarioStudio({ cover, bbox, scenario, activeIntervention, onInterventionSelect, onScenarioExport, onClearDrawings, drawn = {}, unavailable = {} }: Props) {
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

  useEffect(() => {
    onScenarioExport?.(active ? { scenario, impact, assumptions } : null);
  }, [active, scenario, impact, assumptions, onScenarioExport]);

  return (
    <div className="space-y-4">
      <p className="atlas-section-note">
        Pick a tool, then draw on the map. Each shape converts the ground beneath
        it, and the projection below updates as you go.
      </p>
      {/* Map tool shortcuts; geometry remains canonical. */}
      <div className="atlas-tools" role="group" aria-label="Green infrastructure tools">
        {INTERVENTION_ORDER.map((key) => {
          const def = INTERVENTIONS[key];
          const sourceShare = Number(cover[def.source] ?? 0);
          const blocked = unavailable[key];
          const disabled = sourceShare <= 0 || Boolean(blocked);
          const isActive = activeIntervention === key;
          const placed = drawn[key];
          return (
            <button
              key={key}
              type="button"
              className="atlas-tool"
              data-active={isActive || undefined}
              data-placed={placed && placed.count > 0 ? true : undefined}
              style={{ "--tool": INTERVENTION_COLORS[key] } as CSSProperties}
              onClick={() => onInterventionSelect(key)}
              disabled={disabled}
              aria-pressed={isActive}
            >
              <span className="atlas-tool-swatch" aria-hidden="true">
                {isActive ? <PenTool className="h-3.5 w-3.5" /> : placed && placed.count > 0 ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
              </span>
              <span className="atlas-tool-body">
                <span className="atlas-tool-name">{def.label}</span>
                <span className="atlas-tool-meta">
                  {sourceShare <= 0
                    ? `No ${def.source} detected in this tile.`
                    : blocked
                    ? blocked
                    : placed && placed.count > 0
                    ? `${placed.count} ${placed.count === 1 ? "shape" : "shapes"} · ${formatArea(placed.areaM2)} · ${(scenario[key] * 100).toFixed(1)}% of ${def.source}`
                    : `${def.description} $${def.unitCostUSD}/m².`}
                </span>
              </span>
              <span className="atlas-tool-action">{disabled ? "Unavailable" : isActive ? "Drawing…" : "Draw"}</span>
            </button>
          );
        })}
      </div>

      {/* Rainfall assumption */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
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
        </div>

        {active && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onClearDrawings?.()}
            className="h-8 text-xs text-muted-foreground hover:text-destructive gap-1"
            title="Clear drawn interventions"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Clear drawings
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
            Select a tool and draw on the map. The projected score,
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
