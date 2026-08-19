import { Navigation, AlertTriangle, CheckCircle, XCircle, ArrowUpRight } from "lucide-react";
import type { TransitCorridor } from "@/lib/tactical/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface CorridorSafetyRouterProps {
  corridors: TransitCorridor[];
  onSelectCorridor?: (corridor: TransitCorridor) => void;
  selectedCorridorId?: string;
}

export function CorridorSafetyRouter({
  corridors,
  onSelectCorridor,
  selectedCorridorId,
}: CorridorSafetyRouterProps) {
  return (
    <div className="flex flex-col h-full space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Navigation className="h-4 w-4 text-amber-400" />
          <h3 className="text-sm font-semibold tracking-wide uppercase font-mono">
            Transit & Evacuation Corridors
          </h3>
        </div>
        <Badge variant="outline" className="text-[11px] font-mono border-amber-500/40 text-amber-300">
          {corridors.length} ARTERIES MONITORED
        </Badge>
      </div>

      <div className="space-y-2 overflow-y-auto max-h-[380px] pr-1 scrollbar-thin">
        {corridors.map((corridor) => {
          const isSelected = corridor.id === selectedCorridorId;
          const isClosed = corridor.status === "closed";
          const isFlooded = corridor.status === "flooded";
          const isCongested = corridor.status === "congested";

          return (
            <div
              key={corridor.id}
              onClick={() => onSelectCorridor?.(corridor)}
              className={cn(
                "p-3 rounded-lg border transition-all cursor-pointer",
                isSelected
                  ? "border-amber-500 bg-amber-950/20 ring-1 ring-amber-500/40"
                  : isClosed
                  ? "border-rose-500/50 bg-rose-950/20 hover:bg-rose-900/30"
                  : isFlooded
                  ? "border-amber-500/50 bg-amber-950/20 hover:bg-amber-900/30"
                  : "border-border/60 bg-muted/20 hover:bg-muted/40"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-xs font-semibold leading-tight line-clamp-1">
                    {corridor.name}
                  </h4>
                  <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                    {corridor.designation}
                  </p>
                </div>

                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] font-mono uppercase shrink-0",
                    isClosed
                      ? "border-rose-500/50 text-rose-400 bg-rose-500/10"
                      : isFlooded
                      ? "border-amber-500/50 text-amber-400 bg-amber-500/10"
                      : isCongested
                      ? "border-yellow-500/50 text-yellow-400 bg-yellow-500/10"
                      : "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                  )}
                >
                  {corridor.status}
                </Badge>
              </div>

              {/* Hazard & Inundation Metric */}
              <div className="mt-2.5 flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <span>Hydro Hazard Score:</span>
                  <span
                    className={cn(
                      "font-bold",
                      corridor.inundation_risk_score > 60
                        ? "text-rose-400"
                        : corridor.inundation_risk_score > 25
                        ? "text-amber-400"
                        : "text-emerald-400"
                    )}
                  >
                    {corridor.inundation_risk_score} / 100
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Flow: {corridor.intersecting_flow_volume_m3} m³
                </div>
              </div>

              {corridor.active_hazard_notes && (
                <p className="mt-1.5 text-[11px] text-muted-foreground/90 font-mono line-clamp-2 bg-background/40 p-1.5 rounded border border-border/30">
                  {corridor.active_hazard_notes}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
