import { Columns3, History } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ERAS,
  PROVENANCE_LABEL,
  eraCoversPoint,
  getEra,
  type MapEra,
} from "@/lib/historical/eras";

interface Props {
  eraId: string;
  onChange: (id: string) => void;
  onCompare: () => void;
  /** Map centre, used to warn when a city-only layer has nothing here. */
  center: { lat: number; lng: number };
  className?: string;
}

/**
 * The era timeline: 1609 on the left, today in the middle, a projected future
 * on the right. It sits on the map rather than replacing it, so moving through
 * time never means leaving the place you were looking at.
 */
export function EraTimeline({ eraId, onChange, onCompare, center, className }: Props) {
  const active: MapEra = getEra(eraId);
  const covered = eraCoversPoint(active, center.lng, center.lat);

  const step = (delta: number) => {
    const i = ERAS.findIndex((e) => e.id === active.id);
    const next = ERAS[Math.min(ERAS.length - 1, Math.max(0, i + delta))];
    if (next) onChange(next.id);
  };

  return (
    <div
      className={cn(
        "panel w-[min(92vw,44rem)] rounded-lg border border-border bg-card/90 p-2 backdrop-blur-md",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <History className="ml-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <div
          role="radiogroup"
          aria-label="Historical timeline"
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") {
              e.preventDefault();
              step(1);
            } else if (e.key === "ArrowLeft") {
              e.preventDefault();
              step(-1);
            }
          }}
          className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto"
        >
          {ERAS.map((era, i) => {
            const isActive = era.id === active.id;
            return (
              <div key={era.id} className="flex shrink-0 items-center">
                {i > 0 && (
                  <span aria-hidden="true" className="mx-1 h-px w-3 bg-border sm:w-4" />
                )}
                <button
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => onChange(era.id)}
                  className={cn(
                    "rounded-md px-2.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-widest transition-colors",
                    isActive
                      ? era.provenance === "projection"
                        ? "bg-accent/20 text-accent"
                        : "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {era.label}
                </button>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={onCompare}
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
        >
          <Columns3 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Compare</span>
        </button>
      </div>

      <div className="mt-1.5 flex items-start gap-2 px-1">
        <span
          className={cn(
            "mt-px shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest",
            active.provenance === "observed"
              ? "border-border text-muted-foreground"
              : active.provenance === "projection"
                ? "border-accent/40 text-accent"
                : "border-primary/40 text-primary"
          )}
        >
          {PROVENANCE_LABEL[active.provenance]}
        </span>
        <p className="text-[11px] leading-snug text-muted-foreground">
          {covered
            ? `${active.caption} ${active.agency}.`
            : `${active.label} is published for New York City only, so there is nothing to draw here. Move the map to the city to see it.`}
        </p>
      </div>
    </div>
  );
}
