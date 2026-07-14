import { useState } from "react";
import { CloudRain, Play, MapPin } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { SimulationRequest, SimulationResponse } from "@/lib/simulation-types";

interface SimulationPanelProps {
  onRunSimulation: (params: SimulationRequest) => void;
  simulationResult?: SimulationResponse;
  isLoading?: boolean;
}

const RESOLUTION_OPTIONS = [
  { value: "low", label: "Low (faster)" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High (slower)" },
] as const;

export function SimulationPanel({
  onRunSimulation,
  simulationResult,
  isLoading = false,
}: SimulationPanelProps) {
  const [rainfall, setRainfall] = useState<number[]>([50]);
  const [resolution, setResolution] = useState<string>("medium");

  const handleRun = () => {
    onRunSimulation({
      bbox: {
        north: 0,
        south: 0,
        east: 0,
        west: 0,
      },
      rainfall_mm: rainfall[0],
      resolution: resolution as "low" | "medium" | "high",
      include_drainage: true,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <CloudRain className="h-5 w-5 text-primary" />
        <h2 className="text-sm font-semibold">Runoff Simulation</h2>
      </div>

      {/* Rainfall Slider */}
      <div className="space-y-3">
        <Label className="text-sm">
          Rainfall: {rainfall[0]}mm
        </Label>
        <Slider
          value={rainfall}
          onValueChange={setRainfall}
          min={10}
          max={200}
          step={10}
          className="py-2"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>10mm</span>
          <span>200mm</span>
        </div>
      </div>

      {/* Resolution Selector */}
      <div className="space-y-2">
        <Label className="text-sm">Resolution</Label>
        <Select value={resolution} onValueChange={setResolution}>
          <SelectTrigger>
            <SelectValue placeholder="Select resolution" />
          </SelectTrigger>
          <SelectContent>
            {RESOLUTION_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Run Button */}
      <Button
        onClick={handleRun}
        disabled={isLoading}
        className="w-full"
      >
        {isLoading ? (
          <>
            <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Simulating...
          </>
        ) : (
          <>
            <Play className="mr-2 h-4 w-4" />
            Run Full Simulation
          </>
        )}
      </Button>

      {/* Results Display */}
      {simulationResult && (
        <div className="rounded-lg border border-border bg-card/60 p-4 space-y-3">
          <h3 className="text-sm font-semibold">Results</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Area:</span>
              <span className="font-medium">{simulationResult.metadata.processed_area_km2.toFixed(2)} km²</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Risk zones:</span>
              <span className="font-medium">{simulationResult.risk_zones.length}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}