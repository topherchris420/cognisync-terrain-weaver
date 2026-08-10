import { Trees, Waves, Grid3X3, Building2, Eraser } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  INTERVENTIONS,
  INTERVENTION_ORDER,
  formatCompactUSD,
  type InterventionKey,
  type Scenario,
  type ScenarioImpact,
} from "@/lib/scenario";

const ICONS: Record<InterventionKey, LucideIcon> = {
  street_trees: Trees,
  bioswales: Waves,
  permeable_pavement: Grid3X3,
  green_roofs: Building2,
};

interface Props {
  active: InterventionKey | null;
  onSelect: (key: InterventionKey | null) => void;
  scenario: Scenario;
  impact: ScenarioImpact | null;
  hidden?: boolean;
}

/**
 * The ground palette — pick a material, draw it on the map.
 *
 * Sliders describe an intervention; a brush places one. Each swatch reports
 * the share of its source class already committed and what that costs, so the
 * budget is visible in the hand that is spending it.
 */
export function GroundPalette({ active, onSelect, scenario, impact, hidden }: Props) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute right-3 top-20 z-20 flex flex-col items-end gap-2 transition-all duration-700",
        hidden ? "translate-x-24 opacity-0" : "translate-x-0 opacity-100"
      )}
    >
      <div className="pointer-events-auto w-[13.5rem] rounded-xl border border-border/70 bg-background/80 p-2 shadow-2xl backdrop-blur-xl">
        <div className="px-1.5 pb-1.5 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          Redesign the ground
        </div>
        <div className="space-y-1">
          {INTERVENTION_ORDER.map((key) => {
            const def = INTERVENTIONS[key];
            const Icon = ICONS[key];
            const share = scenario[key] ?? 0;
            const cost = impact
              ? impact.convertedAreaM2[key] * def.unitCostUSD
              : 0;
            const on = active === key;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={on}
                onClick={() => onSelect(on ? null : key)}
                className={cn(
                  "flex w-full items-start gap-2 rounded-lg border px-2 py-1.5 text-left transition-colors",
                  on
                    ? "border-primary/60 bg-primary/15"
                    : "border-transparent hover:border-border hover:bg-muted/50"
                )}
              >
                <Icon
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0",
                    on ? "text-primary" : "text-muted-foreground"
                  )}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium">
                    {def.label}
                  </span>
                  <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">
                    {(share * 100).toFixed(0)}% of {def.source} ·{" "}
                    {cost > 0 ? formatCompactUSD(cost) : "—"}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        >
          <Eraser className="h-3.5 w-3.5" aria-hidden="true" />
          Stop painting
        </button>
        <p className="px-1.5 pb-0.5 pt-1 text-[10px] leading-snug text-muted-foreground">
          Draw a polygon on the map with the selected material. Area is measured
          against the classified share of its source class.
        </p>
      </div>
    </div>
  );
}