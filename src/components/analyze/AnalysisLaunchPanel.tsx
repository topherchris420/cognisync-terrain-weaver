import { CloudRain, Database, Layers3, Loader2, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AnalysisLaunchPanelProps {
  location: string;
  areaKm2: number;
  mapReady: boolean;
  onAnalyze: () => void;
}

const PIPELINE = [
  { icon: ScanLine, label: "Classify", detail: "5 surfaces" },
  { icon: Database, label: "Quantify", detail: "runoff" },
  { icon: CloudRain, label: "Stress-test", detail: "50 mm" },
];

/** Mission-control launch surface shown before the first analysis. */
export function AnalysisLaunchPanel({
  location,
  areaKm2,
  mapReady,
  onAnalyze,
}: AnalysisLaunchPanelProps) {
  return (
    <section
      aria-labelledby="analysis-launch-title"
      className="analysis-launch hud-ticks relative overflow-hidden border border-white/10 bg-[hsl(240_26%_4%/0.92)] shadow-2xl backdrop-blur-xl"
    >
      <div className="pointer-events-none absolute inset-0 terrain-grid opacity-20" />
      <div className="pointer-events-none absolute -right-20 -top-24 h-48 w-48 rounded-full bg-primary/15 blur-3xl" />

      <div className="relative p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2">
              <span className="signal-dot" aria-hidden="true" />
              <span className="hud-label text-primary/80">Analysis target locked</span>
            </div>
            <h2 id="analysis-launch-title" className="truncate text-base font-semibold tracking-tight sm:text-lg">
              {location || "Target region"}
            </h2>
            <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
              Convert the visible satellite footprint into a defensible urban-resilience baseline.
            </p>
          </div>
          <div className="shrink-0 border-l border-border/80 pl-4 text-right">
            <div className="font-mono text-lg font-semibold tabular-nums text-foreground">
              {areaKm2.toFixed(2)}
            </div>
            <div className="hud-label mt-1">km² in frame</div>
          </div>
        </div>

        <div className="my-4 grid grid-cols-3 border-y border-border/70">
          {PIPELINE.map(({ icon: Icon, label, detail }, index) => (
            <div
              key={label}
              className="flex items-center gap-2 border-r border-border/70 px-2 py-3 last:border-r-0 sm:px-3"
            >
              <span className="font-mono text-[9px] text-primary/60">0{index + 1}</span>
              <Icon className="hidden h-3.5 w-3.5 text-primary sm:block" aria-hidden="true" />
              <div className="min-w-0">
                <div className="truncate text-[10px] font-semibold uppercase tracking-wider text-foreground">
                  {label}
                </div>
                <div className="truncate font-mono text-[9px] text-muted-foreground">{detail}</div>
              </div>
            </div>
          ))}
        </div>

        <Button
          type="button"
          onClick={onAnalyze}
          disabled={!mapReady}
          className="group h-12 w-full justify-between rounded-none px-4 text-xs font-semibold uppercase tracking-[0.14em]"
        >
          <span className="flex items-center gap-2">
            {!mapReady ? <Loader2 className="h-4 w-4 animate-spin" /> : <Layers3 className="h-4 w-4" />}
            {mapReady ? "Initialize terrain scan" : "Acquiring satellite feed"}
          </span>
          {mapReady && (
            <span className="hidden items-center gap-1 font-mono text-[9px] opacity-60 sm:flex">
              Ctrl ↵
            </span>
          )}
        </Button>

        <div className="mt-3 flex items-center justify-between gap-3 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
          <span>Vision + hydrology model</span>
          <span className="flex items-center gap-1.5 text-emerald-400/80">
            <span className="h-1 w-1 bg-emerald-400" aria-hidden="true" />
            Export-ready output
          </span>
        </div>
      </div>
    </section>
  );
}
