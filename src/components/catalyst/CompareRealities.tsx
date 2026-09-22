import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeftRight, X } from "lucide-react";
import type { Map as MLMap } from "maplibre-gl";
import { MapView } from "@/components/MapView";
import { FlowLayer } from "@/components/FlowLayer";
import { RiskHeatmap } from "@/components/RiskHeatmap";
import type { SimulationResponse } from "@/lib/simulation-types";
import "@/styles/comparison.css";

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

const validVolume = (value: number | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;
const numberLabel = (value: number | undefined) =>
  validVolume(value) ? Math.round(value).toLocaleString() : "—";

export function CompareRealities({ open, onClose, baseMap, currentScore, futureScore, currentRisk, futureRisk, futureSimResult, baseSimResult }: Props) {
  const [pct, setPct] = useState(50);
  const [futureMap, setFutureMap] = useState<MLMap | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const moveTo = useCallback((clientX: number) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    setPct(Math.min(96, Math.max(4, (clientX - rect.left) / rect.width * 100)));
  }, []);

  useEffect(() => {
    if (!open) { setFutureMap(null); return; }
    const previousFocus = document.activeElement;
    handleRef.current?.focus({ preventScroll: true });
    const onMove = (event: PointerEvent) => { if (dragging.current) moveTo(event.clientX); };
    const stop = () => { dragging.current = false; };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); onClose(); } };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    window.addEventListener("keydown", onKey);
    return () => {
      stop();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      window.removeEventListener("keydown", onKey);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [open, moveTo, onClose]);

  useEffect(() => {
    if (!baseMap || !futureMap || !open) return;
    let syncing = false;
    const sync = (from: MLMap, to: MLMap) => {
      if (syncing) return;
      syncing = true;
      try {
        to.jumpTo({ center: from.getCenter(), zoom: from.getZoom(), bearing: from.getBearing(), pitch: from.getPitch() });
      } finally { syncing = false; }
    };
    const onBaseMove = () => sync(baseMap, futureMap);
    const onFutureMove = () => sync(futureMap, baseMap);
    const resize = () => {
      // Both maps retain the full container size; only clipping moves.
      baseMap.resize();
      futureMap.resize();
      onBaseMove();
    };
    baseMap.on("move", onBaseMove);
    futureMap.on("move", onFutureMove);
    resize();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    if (wrapRef.current) observer?.observe(wrapRef.current);
    window.addEventListener("resize", resize);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", resize);
      baseMap.off("move", onBaseMove);
      futureMap.off("move", onFutureMove);
    };
  }, [baseMap, futureMap, open]);

  if (!open) return null;
  const runoffBase = baseSimResult?.metadata?.runoff_volume_m3;
  const runoffFuture = futureSimResult?.metadata?.runoff_volume_m3;
  const reduction = validVolume(runoffBase) && runoffBase > 0 && validVolume(runoffFuture)
    ? (runoffBase - runoffFuture) / runoffBase * 100 : null;
  const headline = reduction === null || !Number.isFinite(reduction) ? "Runoff comparison unavailable"
    : reduction === 0 ? "No change in runoff" : `${Math.abs(Math.round(reduction))}% ${reduction > 0 ? "less" : "more"} runoff`;
  const illustrative = baseSimResult?.metadata?.elevation_status === "illustrative" || futureSimResult?.metadata?.elevation_status === "illustrative";

  return (
    <div ref={wrapRef} className="comparison-workbench pointer-events-none absolute inset-0 z-50" data-testid="compare-realities">
      <div className="comparison-future pointer-events-auto absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 0 0 ${pct}%)` }}>
        <div className="absolute inset-0">
          {baseMap && <MapView initialCenter={[baseMap.getCenter().lng, baseMap.getCenter().lat]} initialZoom={baseMap.getZoom()} terrainEnabled={Boolean(baseMap.getTerrain?.())} onReady={(payload) => setFutureMap(payload.map)} />}
          <RiskHeatmap map={futureMap} riskZones={futureSimResult?.risk_zones ?? []} />
          <FlowLayer map={futureMap} flowPaths={futureSimResult?.flow_paths ?? []} />
        </div>
      </div>
      <div className="comparison-epoch comparison-epoch-now"><span>NOW</span><strong>Current surface</strong></div>
      <div className="comparison-epoch comparison-epoch-future"><span>POSSIBLE</span><strong>Proposed surface</strong></div>
      <div className="comparison-divider" style={{ left: `${pct}%` }} aria-hidden="true" />
      <div ref={handleRef} role="slider" tabIndex={0} aria-label="Reveal the proposed surface" aria-valuemin={4} aria-valuemax={96} aria-valuenow={Math.round(pct)} aria-valuetext={`${Math.round(pct)}% current, ${100 - Math.round(pct)}% proposed`} aria-orientation="horizontal"
        onPointerDown={(event) => { event.preventDefault(); event.currentTarget.focus(); dragging.current = true; moveTo(event.clientX); }}
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          if (event.key === "Home") setPct(4);
          else if (event.key === "End") setPct(96);
          else setPct((value) => Math.min(96, Math.max(4, value + (event.key === "ArrowLeft" ? -4 : 4))));
        }} className="comparison-handle pointer-events-auto" style={{ left: `${pct}%` }}>
        <ArrowLeftRight size={20} aria-hidden="true" />
      </div>
      <div className="comparison-summary">
        <div className="comparison-summary-heading"><div><p>Same storm / paired comparison</p><h2>{headline}</h2></div><span className="comparison-drag-hint">Drag to compare</span></div>
        <dl className="comparison-metrics">
          <div><dt>Runoff · m³</dt><dd><span>{numberLabel(runoffBase)}</span><span aria-hidden="true">→</span><strong>{numberLabel(runoffFuture)}</strong></dd></div>
          <div><dt>Absorption score / 100</dt><dd><span>{numberLabel(currentScore)}</span><span aria-hidden="true">→</span><strong>{numberLabel(futureScore)}</strong></dd></div>
          <div><dt>Score-based risk band</dt><dd><span>{currentRisk}</span><span aria-hidden="true">→</span><strong>{futureRisk}</strong></dd></div>
        </dl>
        {illustrative && <p className="comparison-caveat">Illustrative terrain · exploratory comparison, not a surveyed flood prediction.</p>}
        {!illustrative && <p className="comparison-caveat">Terrain-routed screening estimate. Sewer capacity and drainage are not modeled.</p>}
      </div>
      <button type="button" onClick={onClose} className="comparison-close pointer-events-auto" aria-label="Exit comparison"><X size={16} aria-hidden="true" /><span>Exit comparison</span><kbd>Esc</kbd></button>
    </div>
  );
}
