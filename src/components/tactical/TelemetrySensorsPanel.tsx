import { Radio, CloudRain, Droplets, Waves, Battery, Activity } from "lucide-react";
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
    case "usgs_streamgage":
      return <Activity className="h-3.5 w-3.5 text-primary" />;
    case "rain_gauge":
      return <CloudRain className="h-3.5 w-3.5 text-sky-400" />;
    case "water_level":
      return <Waves className="h-3.5 w-3.5 text-primary" />;
    case "soil_moisture":
      return <Droplets className="h-3.5 w-3.5 text-amber-400" />;
    case "storm_surge":
      return <Waves className="h-3.5 w-3.5 text-teal-400" />;
  }
}

function getStatusBadge(status: IoTSensor["status"]) {
  switch (status) {
    case "critical":
      return (
        <Badge variant="outline" className="text-[10px] font-mono uppercase border-destructive/60 text-destructive bg-destructive/10">
          Flood Action
        </Badge>
      );
    case "warning":
      return (
        <Badge variant="outline" className="text-[10px] font-mono uppercase border-warning/60 text-warning bg-warning/10">
          Advisory
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-[10px] font-mono uppercase border-border text-muted-foreground bg-muted/20">
          Nominal
        </Badge>
      );
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
          <Radio className="h-3.5 w-3.5 text-primary" />
          <h3 className="text-xs font-semibold tracking-wide uppercase font-mono text-foreground">
            USGS & Catchment Streamgages
          </h3>
        </div>
        <span className="text-[11px] font-mono text-muted-foreground">
          {sensors.length} Stations Active
        </span>
      </div>

      <div className="space-y-2 overflow-y-auto max-h-[380px] pr-1 scrollbar-thin">
        {sensors.map((sensor) => {
          const isSelected = sensor.id === selectedSensorId;

          return (
            <div
              key={sensor.id}
              onClick={() => onSelectSensor?.(sensor)}
              className={cn(
                "p-2.5 rounded-md border transition-all cursor-pointer bg-card/60",
                isSelected
                  ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/40"
                  : "border-border/60 hover:border-border hover:bg-card"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded bg-background/80 border border-border/50">
                    {getSensorIcon(sensor.type)}
                  </div>
                  <div>
                    <h4 className="text-xs font-medium leading-tight text-foreground line-clamp-1">
                      {sensor.name}
                    </h4>
                    <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                      Station: {sensor.station_code || sensor.id}
                    </p>
                  </div>
                </div>

                {getStatusBadge(sensor.status)}
              </div>

              {/* Metric & Mini Sparkline Bar */}
              <div className="mt-2 flex items-baseline justify-between">
                <div>
                  <span className="text-lg font-bold font-mono tracking-tight text-foreground">
                    {sensor.reading}
                  </span>
                  <span className="text-xs font-mono text-muted-foreground ml-1.5">
                    {sensor.unit}
                  </span>
                  {sensor.stage_height_m && (
                    <span className="text-[10px] font-mono text-muted-foreground ml-2">
                      (Stage: {sensor.stage_height_m}m)
                    </span>
                  )}
                </div>

                {/* Refined Sparkline History */}
                <div className="flex items-end gap-1 h-5 px-1.5 py-0.5 rounded bg-background/60 border border-border/40">
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
                          "w-1 rounded-t-xs transition-all duration-300",
                          h.value >= sensor.threshold_emergency
                            ? "bg-destructive"
                            : h.value >= sensor.threshold_warning
                            ? "bg-warning"
                            : "bg-primary/80"
                        )}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Threshold & Device Health */}
              <div className="mt-2 pt-1.5 border-t border-border/30 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                <span>
                  Action Limit: {sensor.threshold_warning} / Major: {sensor.threshold_emergency}
                </span>
                <div className="flex items-center gap-1">
                  <Battery className="h-3 w-3 text-muted-foreground" />
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
