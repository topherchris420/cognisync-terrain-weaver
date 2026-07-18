import { useEffect, useState } from "react";
import { Check, Loader2, Camera, Layers, Gauge, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  /** The exact tile being classified, so the wait shows real work, not a spinner. */
  tile: string | null;
}

const STAGES = [
  { icon: Camera, label: "Capturing satellite tile" },
  { icon: Layers, label: "Classifying land cover" },
  { icon: Gauge, label: "Computing absorption score" },
  { icon: Lightbulb, label: "Drafting adaptation strategies" },
] as const;

// Estimated dwell for each visible stage (ms). The vision model dominates the
// middle two; capture is near-instant. There is no timer for the last stage —
// it stays in progress until the real result arrives and unmounts this
// component, so the UI never claims to have finished before it has.
const STAGE_DWELL_MS = [600, 3600, 1600];

/**
 * Shown in the results panel while an analysis is in flight. Replaces the
 * blank gap between "no results" and "results" with the tile under analysis
 * and a pipeline that reflects the edge function's actual stages.
 */
export function AnalyzingState({ tile }: Props) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const timers: number[] = [];
    let elapsed = 0;
    STAGE_DWELL_MS.forEach((dwell, i) => {
      elapsed += dwell;
      timers.push(window.setTimeout(() => setStage(i + 1), elapsed));
    });
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);

  return (
    <div className="space-y-5">
      {/* The tile actually being classified, under a scanning sweep. */}
      <div className="relative overflow-hidden rounded-lg border border-border bg-muted/40">
        {tile ? (
          <img
            src={tile}
            alt="Satellite tile under analysis"
            className="block aspect-video w-full object-cover"
          />
        ) : (
          <div className="aspect-video w-full animate-pulse bg-muted/50" />
        )}
        <div className="scanline pointer-events-none absolute inset-x-0" aria-hidden />
        <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-md border border-border bg-background/80 px-2 py-1 text-[11px] font-medium text-muted-foreground backdrop-blur">
          <Loader2 className="h-3 w-3 animate-spin text-primary" aria-hidden />
          Analyzing tile…
        </div>
      </div>

      {/* Pipeline — the edge function's real stages, advancing as it works. */}
      <ol className="space-y-2.5">
        {STAGES.map(({ icon: Icon, label }, i) => {
          const done = i < stage;
          const active = i === stage;
          return (
            <li
              key={label}
              className={cn(
                "flex items-center gap-2.5 text-sm transition-colors",
                active
                  ? "font-medium text-foreground"
                  : done
                  ? "text-muted-foreground"
                  : "text-muted-foreground/45"
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                  done
                    ? "border-primary/40 bg-primary/15 text-primary"
                    : active
                    ? "border-primary/50 text-primary"
                    : "border-border text-muted-foreground/45"
                )}
              >
                {done ? (
                  <Check className="h-3 w-3" aria-hidden />
                ) : active ? (
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                ) : (
                  <Icon className="h-3 w-3" aria-hidden />
                )}
              </span>
              {label}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
