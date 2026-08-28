import { AlertTriangle, CloudLightning, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { WeatherAlert } from "@/hooks/useWeatherAlerts";

interface WeatherAlertPanelProps {
  alerts: WeatherAlert[];
  status: "loading" | "ready" | "error";
  updatedAt: Date | null;
  onRefresh: () => void;
}

function severityClass(severity: string) {
  if (severity === "Extreme" || severity === "Severe") return "border-destructive/60 bg-destructive/10";
  if (severity === "Moderate") return "border-warning/60 bg-warning/10";
  return "border-primary/40 bg-primary/5";
}

export function WeatherAlertPanel({ alerts, status, updatedAt, onRefresh }: WeatherAlertPanelProps) {
  const activeAlert = alerts[0];
  const timeLabel = updatedAt ? updatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";

  return (
    <section className="w-[min(360px,calc(100vw-1.5rem))] rounded-lg border border-border bg-card/95 p-3 font-mono shadow-lg backdrop-blur-md" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <CloudLightning className="h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <h2 className="truncate text-xs font-semibold uppercase tracking-wider text-foreground">Live weather watch</h2>
            <p className="text-[10px] text-muted-foreground">NWS point alerts · {timeLabel}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onRefresh} disabled={status === "loading"} aria-label="Refresh weather alerts">
          {status === "loading" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {status === "error" ? (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-warning/50 bg-warning/10 p-2 text-[11px] text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
          <span>Live feed unavailable. Local resilience layers remain active.</span>
        </div>
      ) : activeAlert ? (
        <div className={cn("mt-3 rounded-md border p-2", severityClass(activeAlert.severity))}>
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="text-[11px] font-semibold text-foreground">{activeAlert.event}</p>
                <Badge variant="outline" className="h-4 px-1 text-[9px]">{activeAlert.severity}</Badge>
              </div>
              <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-muted-foreground">{activeAlert.headline}</p>
              <p className="mt-1 text-[9px] uppercase tracking-wide text-muted-foreground">Expires {new Date(activeAlert.expires).toLocaleString()}</p>
            </div>
          </div>
          {alerts.length > 1 && <p className="mt-2 text-[10px] text-muted-foreground">+{alerts.length - 1} additional active alert{alerts.length === 2 ? "" : "s"}</p>}
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 p-2 text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" /> No active NWS alerts for this sector.
        </div>
      )}
    </section>
  );
}
