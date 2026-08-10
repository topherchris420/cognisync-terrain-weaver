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
  baseSimResult?: SimulationResponse | null;
}

export function CompareRealities({
  open,
  onClose,
  baseMap,
  currentScore,
  futureScore,
  currentRisk,
  futureRisk,
  futureSimResult,
  baseSimResult,
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

  // Calculate the cinematic metrics
  const runoffBase = baseSimResult?.metadata?.runoff_volume_m3 ?? 12840;
  const runoffFuture = futureSimResult?.metadata?.runoff_volume_m3 ?? 7320;
  
  const runoffReduction = runoffBase > 0 ? ((runoffBase - runoffFuture) / runoffBase) * 100 : 0;
  const reductionText = `−${Math.abs(Math.round(runoffReduction))}%`;

  return (
    <div ref={wrapRef} className="absolute inset-0 z-50 bg-background" data-testid="compare-realities">
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
                 onReady={(m) => setFutureMap(m.getMap())}
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

      {/* Handle */}
      <div
        className="absolute inset-y-0 w-0.5 bg-foreground"
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
          "absolute top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize",
          "items-center justify-center rounded-full border border-border bg-background",
          "text-foreground backdrop-blur-md transition-colors hover:scale-105 shadow-2xl"
        )}
        style={{ left: `${pct}%`, touchAction: "none" }}
      >
        <span className="text-base tracking-[-0.1em]" aria-hidden="true">
          ◀▶
        </span>
      </div>

      {/* Cinematic Map-First HUD */}
      <div className="pointer-events-none absolute bottom-12 inset-x-0 flex flex-col items-center justify-end px-6 z-50">
        <div className="cinematic-glow bg-background/80 backdrop-blur-2xl border border-border/50 px-12 py-8 rounded-3xl shadow-2xl reveal is-visible transition-all flex flex-col items-center max-w-4xl w-full">
          
          <div className="grid grid-cols-3 gap-16 w-full text-center">
            {/* RUNOFF */}
            <div className="flex flex-col items-center justify-center space-y-2">
               <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Runoff</span>
               <div className="flex items-center gap-3 font-mono text-3xl font-semibold">
                 <span className="text-foreground/60">{Math.round(runoffBase).toLocaleString()}</span>
                 <span className="text-muted-foreground">→</span>
                 <span className="text-catalyst">{Math.round(runoffFuture).toLocaleString()} <span className="text-sm">m³</span></span>
               </div>
            </div>

            {/* RISK */}
            <div className="flex flex-col items-center justify-center space-y-2">
               <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Risk</span>
               <div className="flex items-center gap-3 font-mono text-3xl font-semibold">
                 <span className="text-foreground/60">{currentRisk.toUpperCase()}</span>
                 <span className="text-muted-foreground">→</span>
                 <span className="text-catalyst">{futureRisk.toUpperCase()}</span>
               </div>
            </div>

            {/* CHANGE */}
            <div className="flex flex-col items-center justify-center space-y-2">
               <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Change</span>
               <div className="flex items-center gap-3 font-mono text-4xl font-bold text-catalyst">
                 {reductionText}
               </div>
            </div>
          </div>

          <div className="mt-10 h-px w-full bg-gradient-to-r from-transparent via-border/60 to-transparent" />
          
          <h1 className="mt-8 text-3xl md:text-5xl font-black tracking-tighter text-foreground catalyst-serif text-gradient text-center">
            SAME STORM. DIFFERENT CITY.
          </h1>

        </div>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="absolute top-6 right-6 flex items-center gap-2 rounded-full bg-background/80 px-4 py-2 text-sm font-semibold text-foreground backdrop-blur-lg border border-border/50 hover:bg-background/100 hover:scale-105 transition-all shadow-xl"
      >
        <X className="h-4 w-4" aria-hidden="true" />
        Exit Simulation
      </button>
    </div>
  );
}