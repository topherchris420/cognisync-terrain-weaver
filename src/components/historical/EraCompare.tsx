import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import type { Map as MLMap } from "maplibre-gl";
import { MapView } from "@/components/MapView";
import { EraRasterLayer } from "@/components/historical/EraRasterLayer";
import { EraStatusLine } from "@/components/historical/EraTimeline";
import {
  ERAS,
  PROVENANCE_LABEL,
  eraCoversPoint,
  getEra,
} from "@/lib/historical/eras";
import type { ImageryStatus } from "@/lib/historical/era-imagery";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  center: { lat: number; lng: number };
  zoom: number;
  /** Mirror the main view's 3D terrain in every pane. */
  terrainEnabled?: boolean;
  terrainExaggeration?: number;
  /** Eras shown left to right. */
  initialEraIds?: [string, string, string];
}

type PaneStatus = { eraId: string; status: ImageryStatus } | null;

/** Three terrain meshes at once is too much for a phone's GPU memory. */
const NARROW_QUERY = "(max-width: 639px)";

function isNarrow(): boolean {
  try {
    return typeof window !== "undefined" && window.matchMedia(NARROW_QUERY).matches;
  } catch {
    return false;
  }
}

/**
 * Past, present and future in three synchronised panes.
 *
 * Panning or zooming any pane moves the others, so the same rooftops line up
 * across four centuries. Each pane names its own layer, its state, and
 * whether it is an observation, a reconstruction or a projection.
 */
export function EraCompare({
  open,
  onClose,
  center,
  zoom,
  terrainEnabled = false,
  terrainExaggeration,
  initialEraIds = ["1609", "today", "slr-3ft"],
}: Props) {
  const [eraIds, setEraIds] = useState<string[]>(initialEraIds);
  const [mapList, setMapList] = useState<(MLMap | null)[]>([null, null, null]);
  const [statuses, setStatuses] = useState<PaneStatus[]>([null, null, null]);
  const [retries, setRetries] = useState<number[]>([0, 0, 0]);
  const [narrow, setNarrow] = useState(isNarrow);
  const [viewCenter, setViewCenter] = useState(center);
  const lastCamera = useRef<{ center: { lat: number; lng: number }; zoom: number; bearing: number; pitch: number } | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const syncing = useRef(false);

  const register = useCallback((index: number, map: MLMap) => {
    // A slow pane must join the place already being explored, not its original camera.
    if (lastCamera.current) map.jumpTo(lastCamera.current);
    setMapList((prev) => {
      if (prev[index] === map) return prev;
      const next = [...prev];
      next[index] = map;
      return next;
    });
  }, []);

  useEffect(() => {
    const query = window.matchMedia(NARROW_QUERY);
    const update = () => setNarrow(query.matches);
    query.addEventListener("change", update);
    update();
    return () => query.removeEventListener("change", update);
  }, []);

  // One camera for all three panes. Listeners are owned here and removed when
  // a pane's map changes or the comparison closes.
  useEffect(() => {
    const live = mapList.filter((map): map is MLMap => Boolean(map));
    const handlers = live.map((source) => {
      const onMove = () => {
        if (syncing.current) return;
        syncing.current = true;
        try {
          const nextCenter = source.getCenter();
          lastCamera.current = {
            center: { lat: nextCenter.lat, lng: nextCenter.lng },
            zoom: source.getZoom(), bearing: source.getBearing(), pitch: source.getPitch(),
          };
          for (const other of live) {
            if (other === source) continue;
            other.jumpTo(lastCamera.current);
          }
        } finally {
          syncing.current = false;
        }
      };
      const onMoveEnd = () => {
        const next = source.getCenter();
        setViewCenter((previous) => previous.lat === next.lat && previous.lng === next.lng
          ? previous : { lat: next.lat, lng: next.lng });
      };
      source.on("move", onMove);
      source.on("moveend", onMoveEnd);
      return { source, onMove, onMoveEnd };
    });
    return () => {
      for (const { source, onMove, onMoveEnd } of handlers) {
        source.off("move", onMove);
        source.off("moveend", onMoveEnd);
      }
    };
  }, [mapList]);

  useEffect(() => {
    if (open) return;
    setMapList([null, null, null]);
    setStatuses([null, null, null]);
    lastCamera.current = null;
  }, [open]);

  // Each pane changes size when the responsive grid changes orientation.
  useEffect(() => {
    const observer = new ResizeObserver(() => mapList.forEach((map) => map?.resize()));
    for (const map of mapList) if (map) observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [mapList]);

  if (!open) return null;

  const paneTerrain = terrainEnabled && !narrow;

  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/80" />
        <Dialog.Content
          onOpenAutoFocus={() => {
            returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (returnFocus.current?.isConnected) returnFocus.current.focus({ preventScroll: true });
          }}
          className="atlas-app fixed inset-0 z-50 flex flex-col bg-background text-foreground"
          data-testid="era-compare"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <Dialog.Title className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Same place · four centuries
              {terrainEnabled && narrow && (
                <span className="ml-2 normal-case tracking-normal">· flat on small screens</span>
              )}
            </Dialog.Title>
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
              Close
            </button>
          </div>
          <Dialog.Description className="border-b border-border px-4 py-2 text-xs text-muted-foreground">
            Choose a year in each view. Pan or zoom any map to move all three together. Historical imagery uses present-day ground elevation.
          </Dialog.Description>

          <div className="grid min-h-0 flex-1 grid-cols-1 divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {eraIds.map((id, index) => {
              const era = getEra(id);
              const covered = eraCoversPoint(era, viewCenter.lng, viewCenter.lat);
              const paneStatus = statuses[index];
              const status = paneStatus?.eraId === era.id ? paneStatus.status : undefined;
              return (
                <div key={index} className="relative min-h-0" data-testid={`era-pane-${index}`}>
                  <MapView
                    initialCenter={[center.lng, center.lat]}
                    initialZoom={zoom}
                    terrainEnabled={paneTerrain}
                    terrainExaggeration={terrainExaggeration}
                    presentDayBuildings={era.presentDayBuildings}
                    onReady={({ map }) => register(index, map)}
                  />
                  <EraRasterLayer
                    map={mapList[index]}
                    era={era}
                    retryToken={retries[index]}
                    onStatusChange={(next) =>
                      setStatuses((prev) => {
                        const copy = [...prev];
                        copy[index] = { eraId: era.id, status: next };
                        return copy;
                      })
                    }
                  />

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
                        : `New York City (${era.label}) covers the city only — nothing is drawn here.`}
                    </p>
                    {covered && status && (
                      <EraStatusLine
                        era={era}
                        status={status}
                        compact
                        onRetry={() =>
                          setRetries((prev) => prev.map((n, i) => (i === index ? n + 1 : n)))
                        }
                      />
                    )}
                    <p className="mt-1 text-[9px] leading-snug text-muted-foreground/80">
                      {era.attribution ?? era.agency}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
