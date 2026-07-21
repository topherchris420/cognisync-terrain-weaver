import { useMemo, useState } from "react";
import { CloudRain, Play, Waves, TriangleAlert, Layers, Clock } from "lucide-react";
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
import type { SimulationResponse } from "@/lib/simulation-types";
import { estimateRunoffVolumeM3 } from "@/lib/simulation";
import type { BBox } from "@/lib/geo";
import type { LandCover } from "@/lib/types";

export interface SimulationRunParams {
  rainfall_mm: number;
  resolution: "low" | "medium" | "high";
  include_drainage: boolean;
}

interface SimulationPanelProps {
  /** Land cover of the analyzed tile, for the instant client-side estimate. */
  landCover: LandCover;
  /** Analyzed footprint, for the instant estimate. Null if none was stored. */
  bbox: BBox | null;
  onRunSimulation: (params: SimulationRunParams) => void;
  simulationResult?: SimulationResponse;
  isLoading?: boolean;
  /** When set, the run button is disabled and this note explains why. */
  disabledReason?: string | null;
}

const RESOLUTION_OPTIONS = [
  { value: "low", label: "Low (faster)" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High (slower)" },
] as const;

/** Compact volume label: 12 m³, 3.4k m³, 1.2M m³. */
function formatVolume(m3: number): string {
  if (m3 >= 1e6) return `${(m3 / 1e6).toFixed(1)}M m³`;
  if (m3 >= 1e3) return `${(m3 / 1e3).toFixed(1)}k m³`;
  return `${Math.round(m3)} m³`;
}

export function SimulationPanel({
  landCover,
  bbox,
  onRunSimulation,
  simulationResult,
  isLoading = false,
  disabledReason = null,
}: SimulationPanelProps) {
  const [rainfall, setRainfall] = useState<number[]>([50]);
  const [resolution, setResolution] = useState<string>("medium");

  const estimatedRunoff = useMemo(
    () => (bbox ? estimateRunoffVolumeM3(landCover, rainfall[0], bbox) : null),
    [landCover, bbox, rainfall]
  );

  const handleRun = () => {
    onRunSimulation({
      rainfall_mm: rainfall[0],
      resolution: resolution as "low" | "medium" | "high",
      include_drainage: true,
    });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <CloudRain className="h-4 w-4 text-primary" aria-hidden="true" />
        <h3 className="text-sm font-semibold">Runoff simulation</h3>
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">
        Route a design storm across the terrain and see where water accumulates.
        Flow paths and flood-risk zones draw straight onto the map.
      </p>

      {/* Rainfall Slider */}
      <div className="space-y-3">
        <Label htmlFor="rainfall" className="text-sm">
          Rainfall: <span className="font-mono">{rainfall[0]}mm</span>
        </Label>
        <Slider
          id="rainfall"
          value={rainfall}
          onValueChange={setRainfall}
          min={10}
          max={200}
          step={10}
          className="py-2"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>10mm (light)</span>
          <span>200mm (extreme)</span>
        </div>
      </div>

      {/* Resolution Selector */}
      <div className="space-y-2">
        <Label htmlFor="sim-resolution" className="text-sm">
          Grid resolution
        </Label>
        <Select value={resolution} onValueChange={setResolution}>
          <SelectTrigger id="sim-resolution">
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

      {/* Instant client-side estimate — shown before the full sim returns. */}
      {estimatedRunoff !== null && (
        <div className="flex items-center gap-2 rounded-md border border-border/70 bg-muted/40 p-2.5 text-xs">
          <Waves className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
          <span className="text-muted-foreground">
            Quick estimate:{" "}
            <span className="font-medium text-foreground">
              {formatVolume(estimatedRunoff)}
            </span>{" "}
            of runoff over the analyzed site.
          </span>
        </div>
      )}

      {/* Run Button */}
      <Button
        onClick={handleRun}
        disabled={isLoading || Boolean(disabledReason)}
        className="w-full"
      >
        {isLoading ? (
          <>
            <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Simulating…
          </>
        ) : (
          <>
            <Play className="mr-2 h-4 w-4" aria-hidden="true" />
            Run full simulation
          </>
        )}
      </Button>

      {disabledReason && (
        <div className="flex items-start gap-2 rounded-md border border-border/70 bg-muted/40 p-2.5 text-xs text-muted-foreground">
          <TriangleAlert
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent"
            aria-hidden="true"
          />
          <span>{disabledReason}</span>
        </div>
      )}

      {/* Results Display */}
      {simulationResult && (
        <div className="space-y-3 rounded-lg border border-border bg-card/60 p-4">
          <h4 className="text-sm font-semibold">Results</h4>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Risk zones</dt>
              <dd className="font-medium">{simulationResult.risk_zones.length}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Flow paths</dt>
              <dd className="font-medium">{simulationResult.flow_paths.length}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Area</dt>
              <dd className="font-medium">
                {simulationResult.metadata.processed_area_km2.toFixed(2)} km²
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Cells</dt>
              <dd className="font-medium">
                {simulationResult.metadata.cells_analyzed.toLocaleString()}
              </dd>
            </div>
          </dl>
          <div className="flex items-center gap-3 border-t border-border/60 pt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Layers className="h-3 w-3" aria-hidden="true" />
              D8 flow accumulation
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" aria-hidden="true" />
              {simulationResult.metadata.computation_time_ms} ms
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
