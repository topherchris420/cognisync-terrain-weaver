import { Navigation, AlertTriangle, CheckCircle, ShieldAlert } from "lucide-react";
import type { TransitCorridor } from "@/lib/tactical/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface CorridorSafetyRouterProps {
  corridors: TransitCorridor[];
  onSelectCorridor?: (corridor: TransitCorridor) => void;
  selectedCorridorId?: string;
}

function getCorridorBadge(status: TransitCorridor["status"]) {
  switch (status) {
    case "closed":
      return (
        <Badge variant="outline" className="text-[10px] font-mono uppercase border-destructive/60 text-destructive bg-destructive/10">
          Closed
        </Badge>
      );
    case "flooded":
      return (
        <Badge variant="outline" className="text-[10px] font-mono uppercase border-warning/60 text-warning bg-warning/10">
          Inundated
        </Badge>
      );
    case "congested":
      return (
        <Badge variant="outline" className="text-[10px] font-mono uppercase border-amber-500/40 text-amber-400 bg-amber-500/10">
          Restricted
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-[10px] font-mono uppercase border-border text-muted-foreground bg-muted/20">
          Clear
        </Badge>
      );
  }
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
          <Navigation className="h-3.5 w-3.5 text-primary" />
          <h3 className="text-xs font-semibold tracking-wide uppercase font-mono text-foreground">
            DOT Arterials & Route Clearance
          </h3>
        </div>
        <span className="text-[11px] font-mono text-muted-foreground">
          {corridors.length} Corridors
        </span>
      </div>

      <div className="space-y-2 overflow-y-auto max-h-[380px] pr-1 scrollbar-thin">
        {corridors.map((corridor) => {
          const isSelected = corridor.id === selectedCorridorId;

          return (
            <div
              key={corridor.id}
              onClick={() => onSelectCorridor?.(corridor)}
              className={cn(
                "p-2.5 rounded-md border transition-all cursor-pointer bg-card/60",
                isSelected
                  ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/40"
                  : "border-border/60 hover:border-border hover:bg-card"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-xs font-medium leading-tight text-foreground line-clamp-1">
                    {corridor.name}
                  </h4>
                  <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                    {corridor.designation}
                  </p>
                </div>

                {getCorridorBadge(corridor.status)}
              </div>

              {/* Hazard & Inundation Depth Metric */}
              <div className="mt-2 flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <span>Hydro Hazard:</span>
                  <span
                    className={cn(
                      "font-semibold",
                      corridor.inundation_risk_score > 60
                        ? "text-destructive"
                        : corridor.inundation_risk_score > 25
                        ? "text-warning"
                        : "text-foreground"
                    )}
                  >
                    {corridor.inundation_risk_score} / 100
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Depth: {corridor.inundation_depth_m ? `${corridor.inundation_depth_m}m` : "0.0m"}
                </div>
              </div>

              {corridor.active_hazard_notes && (
                <p className="mt-1.5 text-[11px] text-muted-foreground font-mono line-clamp-2 bg-background/50 p-1.5 rounded border border-border/30">
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
