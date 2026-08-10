import { Banknote, CloudRain, Gauge, ShieldAlert } from "lucide-react";
import { riskLabel } from "@/lib/absorption";
import type { ProjectedMetrics } from "@/lib/counterfactual/projected-metrics";
import {
  formatCompactUSD,
  formatVolumeM3,
} from "@/lib/scenario";

interface ScenarioProjectionHUDProps {
  metrics: ProjectedMetrics | null;
}

export function ScenarioProjectionHUD({
  metrics,
}: ScenarioProjectionHUDProps) {
  if (!metrics) return null;
  const items = [
    {
      label: "Cost",
      value: formatCompactUSD(metrics.scenarioImpact.capexUSD),
      icon: Banknote,
    },
    {
      label: "Absorption",
      value: metrics.scenarioImpact.projectedScore.toFixed(0),
      icon: Gauge,
    },
    {
      label: "Runoff",
      value: formatVolumeM3(metrics.estimatedRunoffM3),
      icon: CloudRain,
    },
    {
      label: "Risk",
      value: riskLabel(metrics.estimatedRisk),
      icon: ShieldAlert,
    },
  ];

  return (
    <aside
      aria-label="Live redesign projection"
      aria-live="polite"
      className="rounded-2xl border border-white/15 bg-slate-950/88 p-3 text-white shadow-2xl backdrop-blur-xl"
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          Live projection
        </span>
        <span className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-2 py-0.5 text-[10px] font-medium text-cyan-100">
          {metrics.status}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {items.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-xl bg-white/[0.06] px-3 py-2">
            <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-400">
              <Icon className="h-3 w-3" aria-hidden="true" />
              {label}
            </span>
            <strong className="mt-1 block font-mono text-sm text-white">
              {value}
            </strong>
          </div>
        ))}
      </div>
      {metrics.warnings.length > 0 && (
        <p className="mt-2 text-[10px] leading-relaxed text-slate-400">
          {metrics.warnings.join(" ")}
        </p>
      )}
    </aside>
  );
}
