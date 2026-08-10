import { Loader2, CloudRain, Crosshair, PanelRight, Github } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LocationSearch } from "@/components/LocationSearch";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";
import type { GeocodeResult } from "@/lib/geocode";

interface Props {
  onGoTo: (r: GeocodeResult & { zoom?: number }) => void;
  onAnalyze: () => void;
  onStorm: () => void;
  onOpenDossier: () => void;
  analyzing: boolean;
  mapReady: boolean;
  hasResult: boolean;
  storming: boolean;
  hidden?: boolean;
}

/**
 * The only chrome above the map: find a place, read it, storm it.
 * Everything else lives in the dossier, out of the way until asked for.
 */
export function CommandBar({
  onGoTo,
  onAnalyze,
  onStorm,
  onOpenDossier,
  analyzing,
  mapReady,
  hasResult,
  storming,
  hidden,
}: Props) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center p-3 transition-all duration-700",
        hidden ? "-translate-y-24 opacity-0" : "translate-y-0 opacity-100"
      )}
    >
      <div className="pointer-events-auto flex w-full max-w-4xl items-center gap-2 rounded-xl border border-border/70 bg-background/80 p-2 shadow-2xl backdrop-blur-xl">
        <Link to="/" className="hidden shrink-0 pl-1 pr-1 sm:block" aria-label="Mannahatta home">
          <Logo size="sm" />
        </Link>

        <div className="min-w-0 flex-1">
          <LocationSearch onSelect={onGoTo} />
        </div>

        <Button
          size="sm"
          variant={hasResult ? "outline" : "default"}
          className="shrink-0 gap-1.5"
          disabled={analyzing || !mapReady}
          onClick={onAnalyze}
        >
          {analyzing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Crosshair className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">
            {analyzing ? "Reading ground…" : hasResult ? "Re-read view" : "Read this ground"}
          </span>
        </Button>

        <Button
          size="sm"
          className="shrink-0 gap-1.5"
          disabled={!hasResult || storming}
          onClick={onStorm}
        >
          {storming ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CloudRain className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">Run storm</span>
        </Button>

        <button
          type="button"
          onClick={onOpenDossier}
          disabled={!hasResult}
          aria-label="Open site dossier"
          className="shrink-0 rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
        >
          <PanelRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}