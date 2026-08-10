import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

import type { Map as MLMap } from "maplibre-gl";
import { MapView } from "@/components/MapView";
import { FlowLayer } from "@/components/FlowLayer";
import type { SimulationResponse } from "@/lib/simulation-types";

interface Props {
  open: boolean;
  onClose: () => void;
  baseMap: MLMap | null;
  currentScore: number;
  futureScore: number;
  currentRisk: string;
  futureRisk: string;
  futureSimResult?: SimulationResponse | null;
}

/**
 * Compare realities — one map, two presents.
 *
 * A divider rather than a second MapLibre instance: a live map is expensive,
 * and cloning it would double every tile request and desynchronise on the
 * first pan. Instead the future's veil is clipped to the right of the handle,
 * so dragging genuinely wipes one reality over the other on the imagery the
 * user already framed. Arrow keys move it too.
 */
export function CompareRealities({
  open,
  onClose,
  baseMap,
  currentScore,
  futureScore,
  currentRisk,
  futureRisk,
  futureSimResult,
}: Props) {
  const [pct, setPct] = useState(50);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [futureMap, setFutureMap] = useState<MLMap | null>(null);

  const moveTo = useCallback((clientX: number) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const next = ((clientX - rect.left) / rect.width) * 100;
    setPct(Math.min(96, Math.max(4, next)));
  }, []);

  useEffect(() => {
    if (!open) return;
    const onMove = (e: PointerEvent) => {
      if (dragging.current) moveTo(e.clientX);
    };
    const stop = () => {
      dragging.current = false;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, [open, moveTo]);

  // Sync maps
  useEffect(() => {
    if (!baseMap || !futureMap || !open) return;

    let isSyncingLeft = false;
    let isSyncingRight = false;

    const onLeftMove = () => {
      if (isSyncingRight) return;
      isSyncingLeft = true;
      futureMap.jumpTo({
        center: baseMap.getCenter(),
        zoom: baseMap.getZoom(),
        bearing: baseMap.getBearing(),
        pitch: baseMap.getPitch(),
      });
      isSyncingLeft = false;
    };

    const onRightMove = () => {
      if (isSyncingLeft) return;
      isSyncingRight = true;
      baseMap.jumpTo({
        center: futureMap.getCenter(),
        zoom: futureMap.getZoom(),
        bearing: futureMap.getBearing(),
        pitch: futureMap.getPitch(),
      });
      isSyncingRight = false;
    };

    baseMap.on("move", onLeftMove);
    futureMap.on("move", onRightMove);

    // Initial sync
    futureMap.jumpTo({
      center: baseMap.getCenter(),
      zoom: baseMap.getZoom(),
      bearing: baseMap.getBearing(),
      pitch: baseMap.getPitch(),
    });

    return () => {
      baseMap.off("move", onLeftMove);
      futureMap.off("move", onRightMove);
    };
  }, [baseMap, futureMap, open]);

  if (!open) return null;

  return (
    <div ref={wrapRef} className="absolute inset-0 z-20" data-testid="compare-realities">
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 0 0 ${pct}%)` }}
      >
        <div className="absolute inset-0" style={{ width: "100vw", transform: `translateX(-${pct}vw)` }}>
          <div className="absolute inset-0" style={{ width: "100vw", transform: `translateX(${pct}vw)` }}>
            {baseMap && (
               <MapView
                 initialCenter={[baseMap.getCenter().lng, baseMap.getCenter().lat]}
                 initialZoom={baseMap.getZoom()}
                 onReady={(m) => setFutureMap(m)}
               />
            )}
            <FlowLayer map={futureMap} flowPaths={futureSimResult?.flow_paths ?? []} />
            <div
              className="epoch-veil epoch-veil-future"
              aria-hidden="true"
            />
          </div>
        </div>
      </div>

      {/* Side plates */}
      <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-border bg-background/85 px-2.5 py-1.5 backdrop-blur">
        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          2026 — current
        </div>
        <div className="mt-0.5 font-mono text-sm font-semibold">
          {currentScore.toFixed(1)}
          <span className="ml-2 text-[10px] font-normal uppercase tracking-wider text-muted-foreground">
            {currentRisk} risk
          </span>
        </div>
      </div>
      <div className="catalyst-plate pointer-events-none absolute right-3 top-3 rounded-md px-2.5 py-1.5 backdrop-blur">
        <div className="text-[10px] uppercase tracking-[0.25em] text-catalyst-muted">
          Catalyst — possible future
        </div>
        <div className="mt-0.5 font-mono text-sm font-semibold text-catalyst">
          {futureScore.toFixed(1)}
          <span className="ml-2 text-[10px] font-normal uppercase tracking-wider text-catalyst-muted">
            {futureRisk} risk
          </span>
        </div>
      </div>

      {/* Handle */}
      <div
        className="absolute inset-y-0 w-px bg-catalyst/70"
        style={{ left: `${pct}%` }}
        aria-hidden="true"
      />
      <div
        role="slider"
        tabIndex={0}
        aria-label="Reveal the Catalyst future — drag or use the arrow keys"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-valuetext={`${Math.round(pct)}% current, ${100 - Math.round(pct)}% possible future`}
        onPointerDown={(e) => {
          dragging.current = true;
          moveTo(e.clientX);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            setPct((p) => Math.max(4, p - 4));
          } else if (e.key === "ArrowRight") {
            e.preventDefault();
            setPct((p) => Math.min(96, p + 4));
          }
        }}
        className={cn(
          "absolute top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize",
          "items-center justify-center rounded-full border border-catalyst/60 bg-background/90",
          "text-catalyst backdrop-blur transition-colors hover:bg-background"
        )}
        style={{ left: `${pct}%`, touchAction: "none" }}
      >
        <span className="text-xs tracking-[-0.1em]" aria-hidden="true">
          ◀▶
        </span>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-md border border-catalyst/40 bg-background/85 px-2.5 py-1.5 text-xs text-catalyst backdrop-blur transition-colors hover:bg-background"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
        Exit compare
      </button>
    </div>
  );
}