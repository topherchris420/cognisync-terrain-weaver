import { useState } from "react";
import { useSensorOptics } from "@/lib/sensor-optics-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Target, AlertTriangle, ShieldCheck, Droplets, MapPin, X } from "lucide-react";
import type { IoTSensor } from "@/lib/tactical/types";
import type { FlowPath, RiskZone } from "@/lib/simulation-types";

export interface DetectionTarget {
  id: string;
  label: string;
  category: "SENSOR" | "RISK_ZONE" | "FLOW_CHANNEL" | "INFRASTRUCTURE";
  coordinates: [number, number]; // [lng, lat]
  metricLabel: string;
  metricValue: string;
  status: "NORMAL" | "ALERT" | "CRITICAL";
}

interface DetectionOverlayProps {
  sensors?: IoTSensor[];
  riskZones?: RiskZone[];
  flowPaths?: FlowPath[];
  onSelectTarget?: (target: DetectionTarget) => void;
}

export function DetectionOverlay({
  sensors = [],
  riskZones = [],
  flowPaths = [],
  onSelectTarget,
}: DetectionOverlayProps) {
  const { detectionOpen, opticConfig, soundEnabled } = useSensorOptics();
  const [selectedTarget, setSelectedTarget] = useState<DetectionTarget | null>(null);

  if (!detectionOpen) return null;

  // Derive target items from sensors, risk zones, and flow paths
  const targets: DetectionTarget[] = [];

  sensors.forEach((s) => {
    targets.push({
      id: s.id,
      label: s.name,
      category: "SENSOR",
      coordinates: s.coordinates,
      metricLabel: "Water Depth",
      metricValue: `${s.current_depth_m.toFixed(2)}m`,
      status: s.status === "critical" ? "CRITICAL" : s.status === "warning" ? "ALERT" : "NORMAL",
    });
  });

  riskZones.forEach((rz, i) => {
    if (rz.coordinates.length > 0) {
      targets.push({
        id: rz.id || `rz-${i}`,
        label: `Inundation Zone #${i + 1}`,
        category: "RISK_ZONE",
        coordinates: rz.coordinates[0],
        metricLabel: "Inundation Risk",
        metricValue: `${(rz.risk_score * 100).toFixed(0)}%`,
        status: rz.risk_score > 0.7 ? "CRITICAL" : "ALERT",
      });
    }
  });

  flowPaths.slice(0, 3).forEach((fp, i) => {
    if (fp.coordinates.length > 0) {
      const mid = fp.coordinates[Math.floor(fp.coordinates.length / 2)];
      targets.push({
        id: fp.id || `fp-${i}`,
        label: `Hydro Flow Vector #${i + 1}`,
        category: "FLOW_CHANNEL",
        coordinates: mid,
        metricLabel: "Discharge Accumulation",
        metricValue: `${fp.flow_volume_m3.toFixed(1)} m³`,
        status: fp.flow_volume_m3 > 200 ? "CRITICAL" : "NORMAL",
      });
    }
  });

  if (targets.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-20 font-mono text-xs overflow-hidden">
      {/* Target Reticle Card Panel when a target is selected */}
      {selectedTarget && (
        <div className="pointer-events-auto absolute top-16 right-4 w-72 bg-card/95 backdrop-blur-md p-3 rounded-lg border border-border shadow-2xl space-y-2">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <div className="flex items-center gap-1.5 font-bold text-foreground">
              <Target className="h-4 w-4" style={{ color: opticConfig.accentColor }} />
              <span className="truncate">{selectedTarget.label}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedTarget(null)}
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="space-y-1.5 text-[11px] text-muted-foreground">
            <div className="flex justify-between">
              <span>Category:</span>
              <Badge variant="outline" className="font-mono text-[10px] uppercase">
                {selectedTarget.category}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span>Coordinates:</span>
              <span className="text-foreground">
                [{selectedTarget.coordinates[1].toFixed(4)}°, {selectedTarget.coordinates[0].toFixed(4)}°]
              </span>
            </div>
            <div className="flex justify-between">
              <span>{selectedTarget.metricLabel}:</span>
              <span className="font-bold text-foreground">{selectedTarget.metricValue}</span>
            </div>
          </div>

          <div className="pt-2">
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                onSelectTarget?.(selectedTarget);
              }}
              className="w-full text-xs font-mono gap-1.5 h-7"
            >
              <MapPin className="h-3.5 w-3.5" />
              Focus Target Lock
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
