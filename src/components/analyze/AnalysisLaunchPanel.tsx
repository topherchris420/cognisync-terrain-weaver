import { ArrowRight, Layers3, Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AnalysisLaunchPanelProps {
  location: string;
  areaKm2: number;
  mapReady: boolean;
  onAnalyze: () => void;
  onExample?: () => void;
}

export function AnalysisLaunchPanel({ location, areaKm2, mapReady, onAnalyze, onExample }: AnalysisLaunchPanelProps) {
  return (
    <section aria-labelledby="analysis-launch-title" className="atlas-launch">
      <div className="atlas-target">
        <MapPin size={16} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <span className="atlas-eyebrow">Your study area</span>
          <h2 id="analysis-launch-title" className="truncate text-sm font-medium">{location || "Custom map view"}</h2>
        </div>
        <div className="text-right">
          <div className="font-mono text-lg tabular-nums">{areaKm2 > 0 ? areaKm2.toFixed(2) : "—"}</div>
          <span className="text-[10px] text-muted-foreground">km² in frame</span>
        </div>
      </div>
      <Button type="button" onClick={onAnalyze} disabled={!mapReady} className="atlas-primary group h-12 w-full justify-between px-4 text-sm">
        <span className="flex items-center gap-2">
          {mapReady ? <Layers3 size={16} /> : <Loader2 size={16} className="animate-spin" />}
          {mapReady ? "Initialize terrain scan" : "Acquiring satellite feed"}
        </span>
        {mapReady && <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />}
      </Button>
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">AI classifies the visible satellite image. Results are estimates; imagery and analysis require a connection.</p>
      {onExample && (
        <div className="atlas-example-link">
          <button type="button" onClick={onExample} className="flex w-full items-center justify-between text-sm font-medium hover:text-primary">
            Explore an example <ArrowRight size={15} aria-hidden="true" />
          </button>
          <p className="mt-1 text-[11px] text-muted-foreground">Illustrative data. No scan or account needed.</p>
        </div>
      )}
    </section>
  );
}
