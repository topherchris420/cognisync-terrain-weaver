import { CloudRain, Columns2, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { riskLabel } from "@/lib/absorption";
import { formatVolumeM3 } from "@/lib/scenario";
import type { SimulationResponse } from "@/lib/simulation-types";
import type { FloodRisk } from "@/lib/types";

interface Props {
  rainfallMm: number;
  baseline: SimulationResponse | null;
  rerun: SimulationResponse | null;
  runoffBeforeM3: number;
  runoffAfterM3: number | null;
  baseRisk: FloodRisk;
  projectedRisk: FloodRisk | null;
  canRerun: boolean;
  running: boolean;
  onRerun: () => void;
  onCompare: () => void;
  hidden?: boolean;
}

/**
 * The verdict card for the second storm — identical rainfall, changed ground.
 * Language stays inside what the model can support.
 */
export function StormReadout({
  rainfallMm,
  baseline,
  rerun,
  runoffBeforeM3,
  runoffAfterM3,
  baseRisk,
  projectedRisk,
  canRerun,
  running,
  onRerun,
  onCompare,
  hidden,
}: Props) {
  if (!baseline) return null;
  const reduction =
    runoffAfterM3 != null && runoffBeforeM3 > 0
      ? 1 - runoffAfterM3 / runoffBeforeM3
      : 0;

  return (
    <div
      className={cn(
        "pointer-events-none absolute bottom-3 right-3 z-20 w-[19rem] transition-all duration-700",
        hidden ? "translate-y-24 opacity-0" : "translate-y-0 opacity-100"
      )}
    >
      <div className="pointer-events-auto rounded-xl border border-border/70 bg-background/85 p-3 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          <CloudRain className="h-3.5 w-3.5" aria-hidden="true" />
          {rainfallMm} mm design storm
        </div>

        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 font-mono text-xs">
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Flow paths</dt>
            <dd className="tabular-nums">{baseline.flow_paths.length}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Risk zones</dt>
            <dd className="tabular-nums">
              {(rerun ?? baseline).risk_zones.length}
              {rerun && rerun.risk_zones.length !== baseline.risk_zones.length && (
                <span className="ml-1 text-muted-foreground">was {baseline.risk_zones.length}</span>
              )}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Runoff over the site</dt>
            <dd className="tabular-nums">
              {formatVolumeM3(runoffBeforeM3)}
              {runoffAfterM3 != null && (
                <>
                  {" → "}
                  <span className="text-primary">{formatVolumeM3(runoffAfterM3)}</span>
                  <span className="ml-1 text-muted-foreground">
                    ({(reduction * 100).toFixed(0)}% less)
                  </span>
                </>
              )}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Risk band</dt>
            <dd>
              {riskLabel(baseRisk)}
              {projectedRisk && projectedRisk !== baseRisk && (
                <>
                  {" → "}
                  <span className="text-primary">{riskLabel(projectedRisk)}</span>
                </>
              )}
            </dd>
          </div>
        </dl>

        {rerun ? (
          <p className="catalyst-body mt-2 text-[11px] leading-snug text-muted-foreground">
            Lower runoff under the same storm is{" "}
            <span className="text-primary">supported under this simulation</span>.
            Flow geometry is held from the measured DEM run; volumes are
            re-weighted by the scenario's runoff coefficient, not re-solved.
          </p>
        ) : (
          <p className="catalyst-body mt-2 text-[11px] leading-snug text-muted-foreground">
            Now change the ground, then run the identical storm again.
          </p>
        )}

        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <Button size="sm" className="gap-1.5" disabled={!canRerun || running} onClick={onRerun}>
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Same storm
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={!rerun}
            onClick={onCompare}
          >
            <Columns2 className="h-3.5 w-3.5" />
            Compare
          </Button>
        </div>
      </div>
    </div>
  );
}