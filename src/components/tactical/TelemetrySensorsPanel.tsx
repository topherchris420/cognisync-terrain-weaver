import { Radio, CloudRain, Droplets, Waves, BatteryCharging, AlertCircle, CheckCircle } from "lucide-react";
import type { IoTSensor, SensorType } from "@/lib/tactical/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface TelemetrySensorsPanelProps {
  sensors: IoTSensor[];
  onSelectSensor?: (sensor: IoTSensor) => void;
  selectedSensorId?: string;
}

function getSensorIcon(type: SensorType) {
  switch (type) {
    case "rain_gauge":
      return <CloudRain className="h-4 w-4 text-sky-400" />;
    case "water_level":
      return <Waves className="h-4 w-4 text-blue-400" />;
    case "soil_moisture":
      return <Droplets className="h-4 w-4 text-amber-400" />;
    case "storm_surge":
      return <Waves className="h-4 w-4 text-teal-400" />;
  }
}

export function TelemetrySensorsPanel({
  sensors,
  onSelectSensor,
  selectedSensorId,
}: TelemetrySensorsPanelProps) {
  return (
    <div className="flex flex-col h-full space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-sky-400 animate-pulse" />
          <h3 className="text-sm font-semibold tracking-wide uppercase font-mono">
            IoT Telemetry Array
          </h3>
        </div>
        <Badge variant="outline" className="text-[11px] font-mono border-sky-500/40 text-sky-300">
          {sensors.length} SENSORS ONLINE
        </Badge>
      </div>

      <div className="space-y-2 overflow-y-auto max-h-[380px] pr-1 scrollbar-thin">
        {sensors.map((sensor) => {
          const isSelected = sensor.id === selectedSensorId;
          const isCritical = sensor.status === "critical";
          const isWarning = sensor.status === "warning";

          return (
            <div
              key={sensor.id}
              onClick={() => onSelectSensor?.(sensor)}
              className={cn(
                "p-3 rounded-lg border transition-all cursor-pointer",
                isSelected
                  ? "border-primary bg-primary/10 shadow-md ring-1 ring-primary/40"
                  : isCritical
                  ? "border-rose-500/50 bg-rose-950/20 hover:bg-rose-900/30"
                  : isWarning
                  ? "border-amber-500/40 bg-amber-950/20 hover:bg-amber-900/30"
                  : "border-border/60 bg-muted/20 hover:bg-muted/40"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-background/80 border border-border/40">
                    {getSensorIcon(sensor.type)}
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold leading-tight line-clamp-1">
                      {sensor.name}
                    </h4>
                    <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                      ID: {sensor.id}
                    </p>
                  </div>
                </div>

                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] font-mono uppercase shrink-0",
                    isCritical
                      ? "border-rose-500/50 text-rose-400 bg-rose-500/10 animate-pulse"
                      : isWarning
                      ? "border-amber-500/50 text-amber-400 bg-amber-500/10"
                      : "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                  )}
                >
                  {sensor.status}
                </Badge>
              </div>

              {/* Metric & Mini Sparkline Bar */}
              <div className="mt-2.5 flex items-baseline justify-between">
                <div>
                  <span className="text-xl font-bold font-mono tracking-tight text-foreground">
                    {sensor.reading}
                  </span>
                  <span className="text-xs font-mono text-muted-foreground ml-1.5">
                    {sensor.unit}
                  </span>
                </div>

                {/* Micro Sparkline History */}
                <div className="flex items-end gap-1 h-6 px-2 py-0.5 rounded bg-background/60 border border-border/40">
                  {sensor.historical_readings.map((h, i) => {
                    const heightPct = Math.min(
                      100,
                      Math.max(15, (h.value / (sensor.threshold_emergency * 1.2)) * 100)
                    );
                    return (
                      <div
                        key={i}
                        title={`${h.timestamp}: ${h.value} ${sensor.unit}`}
                        style={{ height: `${heightPct}%` }}
                        className={cn(
                          "w-1.5 rounded-t-sm transition-all duration-300",
                          h.value >= sensor.threshold_emergency
                            ? "bg-rose-400"
                            : h.value >= sensor.threshold_warning
                            ? "bg-amber-400"
                            : "bg-sky-400"
                        )}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Threshold & Device Health */}
              <div className="mt-2 pt-2 border-t border-border/30 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                <span>
                  Limit: W:{sensor.threshold_warning} / E:{sensor.threshold_emergency}
                </span>
                <div className="flex items-center gap-1.5">
                  <BatteryCharging className="h-3 w-3 text-emerald-400" />
                  <span>{Math.round(sensor.battery_pct)}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
