import { Radio, Activity, Navigation, Truck, Waves, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface TacticalLayersState {
  showSensors: boolean;
  showCorridors: boolean;
  showSupply: boolean;
  showFlows: boolean;
  showRiskZones: boolean;
}

interface TacticalLayerControlsProps {
  layers: TacticalLayersState;
  onChange: (layers: TacticalLayersState) => void;
}

export function TacticalLayerControls({ layers, onChange }: TacticalLayerControlsProps) {
  const toggle = (key: keyof TacticalLayersState) => {
    onChange({ ...layers, [key]: !layers[key] });
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-xl border border-border/80 bg-background/90 backdrop-blur-md shadow-lg">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => toggle("showSensors")}
        className={cn(
          "h-7 px-2.5 text-xs font-mono gap-1.5 transition-all",
          layers.showSensors
            ? "bg-sky-500/20 text-sky-400 border border-sky-500/40"
            : "text-muted-foreground opacity-60 hover:opacity-100"
        )}
      >
        <Radio className="h-3.5 w-3.5" />
        IoT Sensors
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => toggle("showCorridors")}
        className={cn(
          "h-7 px-2.5 text-xs font-mono gap-1.5 transition-all",
          layers.showCorridors
            ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
            : "text-muted-foreground opacity-60 hover:opacity-100"
        )}
      >
        <Navigation className="h-3.5 w-3.5" />
        Transit Arteries
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => toggle("showSupply")}
        className={cn(
          "h-7 px-2.5 text-xs font-mono gap-1.5 transition-all",
          layers.showSupply
            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
            : "text-muted-foreground opacity-60 hover:opacity-100"
        )}
      >
        <Truck className="h-3.5 w-3.5" />
        Supply / Shelters
      </Button>

      <div className="h-4 w-px bg-border/60 mx-0.5" />

      <Button
        variant="ghost"
        size="sm"
        onClick={() => toggle("showFlows")}
        className={cn(
          "h-7 px-2.5 text-xs font-mono gap-1.5 transition-all",
          layers.showFlows
            ? "bg-blue-500/20 text-blue-400 border border-blue-500/40"
            : "text-muted-foreground opacity-60 hover:opacity-100"
        )}
      >
        <Waves className="h-3.5 w-3.5" />
        D8 Hydro Runoff
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => toggle("showRiskZones")}
        className={cn(
          "h-7 px-2.5 text-xs font-mono gap-1.5 transition-all",
          layers.showRiskZones
            ? "bg-rose-500/20 text-rose-400 border border-rose-500/40"
            : "text-muted-foreground opacity-60 hover:opacity-100"
        )}
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        Inundation Zones
      </Button>
    </div>
  );
}
