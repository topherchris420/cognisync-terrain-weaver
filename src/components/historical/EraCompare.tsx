import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { Map as MLMap } from "maplibre-gl";
import { MapView } from "@/components/MapView";
import { EraRasterLayer } from "@/components/historical/EraRasterLayer";
import {
  ERAS,
  PROVENANCE_LABEL,
  eraCoversPoint,
  getEra,
} from "@/lib/historical/eras";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  center: { lat: number; lng: number };
  zoom: number;
  /** Eras shown left to right. */
  initialEraIds?: [string, string, string];
}

/**
 * Past, present and future in three synchronised panes.
 *
 * Panning or zooming any pane moves the others, so the same rooftops line up
 * across four centuries. Each pane names its own layer and whether it is an
 * observation, a reconstruction or a projection.
 */
export function EraCompare({
  open,
  onClose,
  center,
  zoom,
  initialEraIds = ["1609", "today", "slr-3ft"],
}: Props) {
  const [eraIds, setEraIds] = useState<string[]>(initialEraIds);
  const maps = useRef<(MLMap | null)[]>([null, null, null]);
  const syncing = useRef(false);

  const register = useCallback((index: number, map: MLMap) => {
    maps.current[index] = map;

    const onMove = () => {
      if (syncing.current) return;
      syncing.current = true;
      for (let i = 0; i < maps.current.length; i += 1) {
        const other = maps.current[i];
        if (!other || i === index) continue;
        other.jumpTo({
          center: map.getCenter(),
          zoom: map.getZoom(),
          bearing: map.getBearing(),
          pitch: map.getPitch(),
        });
      }
      syncing.current = false;
    };

    map.on("move", onMove);
  }, []);

  useEffect(() => {
    if (open) return;
    maps.current = [null, null, null];
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="absolute inset-0 z-50 flex flex-col bg-background"
      data-testid="era-compare"
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Same place · four centuries
        </p>
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
          Close
        </button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {eraIds.map((id, index) => {
          const era = getEra(id);
          const covered = eraCoversPoint(era, center.lng, center.lat);
          return (
            <div key={index} className="relative min-h-0">
              <MapView
                initialCenter={[center.lng, center.lat]}
                initialZoom={zoom}
                onReady={({ map }) => register(index, map)}
              />
              <EraRasterLayer map={maps.current[index]} era={era} />

              <div className="panel pointer-events-auto absolute left-2 top-2 z-20 max-w-[15rem] rounded-lg border border-border bg-card/90 p-2 backdrop-blur-md">
                <div className="flex items-center gap-2">
                  <select
                    aria-label={`Era for pane ${index + 1}`}
                    value={id}
                    onChange={(e) => {
                      const next = [...eraIds];
                      next[index] = e.target.value;
                      setEraIds(next);
                    }}
                    className="rounded border border-border bg-background px-1.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-widest text-foreground"
                  >
                    {ERAS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <span
                    className={cn(
                      "rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest",
                      era.provenance === "observed"
                        ? "border-border text-muted-foreground"
                        : era.provenance === "projection"
                          ? "border-accent/40 text-accent"
                          : "border-primary/40 text-primary"
                    )}
                  >
                    {PROVENANCE_LABEL[era.provenance]}
                  </span>
                </div>
                <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground">
                  {covered
                    ? era.caption
                    : `${era.label} covers New York City only — nothing is drawn here.`}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
