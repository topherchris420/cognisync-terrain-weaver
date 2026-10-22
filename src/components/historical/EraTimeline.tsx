import { AlertTriangle, Columns3, History, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ERAS,
  PROVENANCE_LABEL,
  eraCoversPoint,
  getEra,
  type MapEra,
} from "@/lib/historical/eras";
import type { ImageryStatus } from "@/lib/historical/era-imagery";

interface Props {
  eraId: string;
  onChange: (id: string) => void;
  onCompare: () => void;
  /** Map centre, used to warn when a city-only layer has nothing here. */
  center: { lat: number; lng: number };
  /** State of the active era's layer; omitted for eras with nothing to load. */
  status?: ImageryStatus;
  /** Offered when the active era's imagery failed transiently. */
  onRetry?: () => void;
  className?: string;
}

/**
 * The era timeline: 1609 on the left, today in the middle, a projected future
 * on the right. It sits on the map rather than replacing it, so moving through
 * time never means leaving the place you were looking at.
 */
export function EraTimeline({
  eraId,
  onChange,
  onCompare,
  center,
  status,
  onRetry,
  className,
}: Props) {
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

      <div className="atlas-era-caption mt-1.5 flex items-start gap-2 px-1">
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
            : `New York City (${active.label}) is published only for the city, so there is nothing to draw here. Move the map to the city to see it.`}
        </p>
      </div>

      {covered && status && <EraStatusLine era={active} status={status} onRetry={onRetry} />}
      <EraSourceDetails era={active} />
    </div>
  );
}

/** What the active layer is doing, in words. Silent once it is drawn. */
export function EraStatusLine({
  era,
  status,
  onRetry,
  compact = false,
}: {
  era: MapEra;
  status: ImageryStatus;
  onRetry?: () => void;
  compact?: boolean;
}) {
  if (status.phase === "ready") return null;
  const text = compact ? "text-[10px]" : "text-[11px]";
  if (status.phase === "loading") {
    return (
      <p
        role="status"
        className={cn("mt-1 flex items-center gap-1.5 px-1 text-muted-foreground", text)}
      >
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        Loading {era.label} imagery…
      </p>
    );
  }
  const alarming = status.phase === "error" || status.phase === "unavailable";
  return (
    <div
      role={alarming ? "alert" : "status"}
      data-era-status={status.phase}
      className={cn(
        "mt-1 flex items-start gap-1.5 rounded-md px-1 py-0.5 leading-snug",
        alarming ? "text-destructive" : "text-muted-foreground",
        text
      )}
    >
      {alarming && <AlertTriangle className="mt-px h-3 w-3 shrink-0" aria-hidden="true" />}
      <span className="min-w-0 flex-1">
        {status.phase === "unavailable" && (
          <span className="font-semibold uppercase tracking-widest">Unavailable · </span>
        )}
        {status.message}
      </span>
      {status.retriable && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="flex shrink-0 items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-foreground hover:bg-muted"
        >
          <RefreshCw className="h-3 w-3" aria-hidden="true" />
          Retry
        </button>
      )}
    </div>
  );
}

/** Where the layer comes from and what it cannot show, one tap away. */
function EraSourceDetails({ era }: { era: MapEra }) {
  return (
    <details className="group mt-1 px-1 text-[10px] leading-snug text-muted-foreground">
      <summary className="cursor-pointer select-none font-semibold uppercase tracking-widest hover:text-foreground">
        Source &amp; limits
      </summary>
      <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
        <dt className="font-semibold">Source</dt>
        <dd>{era.attribution ?? era.agency}</dd>
        {era.captured && (
          <>
            <dt className="font-semibold">Captured</dt>
            <dd>{era.captured}</dd>
          </>
        )}
        {era.sourceUrl && (
          <>
            <dt className="font-semibold">Service</dt>
            <dd className="break-all">
              <a
                href={era.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="underline decoration-dotted hover:text-foreground"
              >
                {era.sourceUrl.replace(/^https?:\/\//, "")}
              </a>
            </dd>
          </>
        )}
      </dl>
      {era.limitations.length > 0 && (
        <ul className="mt-1 list-disc space-y-0.5 pl-4">
          {era.limitations.map((limit) => (
            <li key={limit}>{limit}</li>
          ))}
        </ul>
      )}
    </details>
  );
}
