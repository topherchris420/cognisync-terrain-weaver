import { AlertTriangle, ShieldAlert, CheckCircle, Info, Bell } from "lucide-react";
import type { TacticalAlert, AlertSeverity } from "@/lib/tactical/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface IncidentAlertFeedProps {
  alerts: TacticalAlert[];
  onAcknowledge: (alertId: string) => void;
}

function getAlertIcon(severity: AlertSeverity) {
  switch (severity) {
    case "emergency":
    case "warning":
      return <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />;
    case "watch":
    case "advisory":
      return <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0" />;
    default:
      return <Info className="h-4 w-4 text-sky-400 shrink-0" />;
  }
}

export function IncidentAlertFeed({ alerts, onAcknowledge }: IncidentAlertFeedProps) {
  const unacknowledgedCount = alerts.filter((a) => !a.acknowledged).length;

  return (
    <div className="flex flex-col space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-3.5 w-3.5 text-primary" />
          <h4 className="text-xs font-mono uppercase font-bold text-muted-foreground">
            Emergency Dispatch & Alert Stream
          </h4>
        </div>
        {unacknowledgedCount > 0 && (
          <Badge variant="outline" className="text-[10px] font-mono border-rose-500/40 text-rose-300 bg-rose-500/10 animate-pulse">
            {unacknowledgedCount} UNACKNOWLEDGED
          </Badge>
        )}
      </div>

      <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1 scrollbar-thin">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={cn(
              "p-2 rounded-lg border transition-all flex items-start justify-between gap-3 text-xs font-mono",
              !alert.acknowledged
                ? "border-rose-500/50 bg-rose-950/20"
                : "border-border/40 bg-muted/10 opacity-75"
            )}
          >
            <div className="flex items-start gap-2">
              {getAlertIcon(alert.severity)}
              <div>
                <div className="font-semibold text-foreground flex items-center gap-1.5">
                  <span>{alert.title}</span>
                  <span className="text-[10px] text-muted-foreground font-normal">
                    ({new Date(alert.timestamp).toLocaleTimeString()})
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                  {alert.message}
                </p>
                <div className="text-[10px] text-primary/80 mt-1">
                  Source: {alert.source}
                </div>
              </div>
            </div>

            {!alert.acknowledged && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onAcknowledge(alert.id)}
                className="h-6 px-2 text-[10px] shrink-0 font-mono border-rose-500/40 hover:bg-rose-900/30 text-rose-300"
              >
                Ack
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
