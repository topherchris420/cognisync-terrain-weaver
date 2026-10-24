import { ArrowRight, FolderOpen, Layers3, Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AnalysisLaunchPanelProps {
  location: string;
  areaKm2: number;
  mapReady: boolean;
  mapUnavailable?: boolean;
  onAnalyze: () => void;
  onExample?: () => void;
  /** Reopen an exported experiment file: verified and replayed before anything is shown. */
  onOpenFile?: (file: File) => void;
}

const isApple = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

export function AnalysisLaunchPanel({ location, areaKm2, mapReady, mapUnavailable, onAnalyze, onExample, onOpenFile }: AnalysisLaunchPanelProps) {
  return (
    <section aria-labelledby="analysis-launch-title" className="atlas-launch">
      {onExample && (
        <div className="atlas-example-start">
          <p>First visit? Try the complete workflow.</p>
          <button type="button" onClick={onExample}>
            Explore an example <ArrowRight size={15} aria-hidden="true" />
          </button>
          <small>Illustrative data. No scan or account needed.</small>
        </div>
      )}
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
          {mapReady || mapUnavailable ? <Layers3 size={16} /> : <Loader2 size={16} className="animate-spin" />}
          {mapReady ? "Scan this area" : mapUnavailable ? "Live map unavailable" : "Acquiring satellite feed"}
        </span>
        {mapReady && (
          <span className="flex items-center gap-2">
            <kbd className="atlas-kbd hidden sm:inline-flex" aria-label={isApple ? "Command Enter" : "Control Enter"}>
              {isApple ? "⌘" : "Ctrl"} ↵
            </kbd>
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" aria-hidden="true" />
          </span>
        )}
      </Button>
      {mapUnavailable && <p role="status" className="mt-3 text-xs leading-relaxed text-muted-foreground">Reconnect the map to scan a place. The example and saved experiment files are still available.</p>}
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">AI estimates five surface types from the satellite image in frame. Pan or zoom to change the study area. Results are estimates.</p>
      {onOpenFile && (
        <div className="atlas-example-link atlas-open-link">
          <label className="flex min-h-11 w-full cursor-pointer items-center justify-between text-sm font-medium hover:text-primary focus-within:outline focus-within:outline-2 focus-within:outline-offset-4 focus-within:outline-primary">
            <span>Open an experiment file</span>
            <input
              type="file"
              accept=".json,application/json"
              className="sr-only"
              aria-label="Open an experiment file"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onOpenFile(file);
                event.target.value = "";
              }}
            />
            <FolderOpen size={15} aria-hidden="true" />
          </label>
          <p className="mt-1 text-[11px] text-muted-foreground">Exported evidence (JSON) is verified and replayed here before anything is shown.</p>
        </div>
      )}
    </section>
  );
}
