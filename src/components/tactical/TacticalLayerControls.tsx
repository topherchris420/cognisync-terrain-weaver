import { Radio, Navigation, Truck, Waves, AlertTriangle } from "lucide-react";
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
    <div className="flex flex-wrap items-center gap-1 p-1 rounded-md border border-border bg-card/90 backdrop-blur-md shadow-md">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => toggle("showSensors")}
        className={cn(
          "h-6 px-2 text-xs font-mono gap-1 transition-all",
          layers.showSensors
            ? "bg-primary/20 text-primary border border-primary/40"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Radio className="h-3 w-3" />
        USGS Streamgages
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => toggle("showCorridors")}
        className={cn(
          "h-6 px-2 text-xs font-mono gap-1 transition-all",
          layers.showCorridors
            ? "bg-primary/20 text-primary border border-primary/40"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Navigation className="h-3 w-3" />
        Transit Arteries
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => toggle("showSupply")}
        className={cn(
          "h-6 px-2 text-xs font-mono gap-1 transition-all",
          layers.showSupply
            ? "bg-primary/20 text-primary border border-primary/40"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Truck className="h-3 w-3" />
        DPW Staging
      </Button>

      <div className="h-3.5 w-px bg-border mx-0.5" />

      <Button
        variant="ghost"
        size="sm"
        onClick={() => toggle("showFlows")}
        className={cn(
          "h-6 px-2 text-xs font-mono gap-1 transition-all",
          layers.showFlows
            ? "bg-primary/20 text-primary border border-primary/40"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Waves className="h-3 w-3" />
        Hydro Runoff
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => toggle("showRiskZones")}
        className={cn(
          "h-6 px-2 text-xs font-mono gap-1 transition-all",
          layers.showRiskZones
            ? "bg-destructive/20 text-destructive border border-destructive/40"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <AlertTriangle className="h-3 w-3" />
        Inundation Polygons
      </Button>
    </div>
  );
}
