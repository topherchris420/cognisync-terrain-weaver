import { useEffect, useRef } from "react";
import type { Map as MLMap } from "maplibre-gl";
import { Welikia1609Layer } from "@/components/historical/Welikia1609Layer";
import { FloodplainLayer } from "@/components/historical/FloodplainLayer";
import { isPastEra, type MapEra } from "@/lib/historical/eras";
import {
  FIRST_TILE_TIMEOUT_MS,
  INITIAL_TRACKER,
  LOADING,
  READY,
  eraLayerId,
  eraSourceId,
  probeEraImageryCached,
  reduceImagery,
  type ImageryEvent,
  type ImageryStatus,
} from "@/lib/historical/era-imagery";
import {
  baseImageryRole,
  eraLayerAnchor,
  hasLayer,
  hasSource,
  removeLayers,
  removeSource,
  setBaseImageryRole,
  styleReady,
} from "@/lib/map-layers";

interface Props {
  map: MLMap | null;
  era: MapEra;
  /** Loading → Ready / Empty / Unavailable / Error, for the era's own layer. */
  onStatusChange?: (status: ImageryStatus) => void;
  /** Bump to retry an era whose imagery errored. */
  retryToken?: number;
}

function errorSourceId(event: unknown): string | undefined {
  if (!event || typeof event !== "object" || !("sourceId" in event)) return undefined;
  const id = (event as { sourceId?: unknown }).sourceId;
  return typeof id === "string" ? id : undefined;
}

/**
 * Draws one era's published raster on the live map.
 *
 * Before anything is drawn the service is probed (see `era-imagery.ts`), so a
 * retired or placeholder service is reported as unavailable instead of being
 * painted over the city. Once drawn, tile loads and failures drive the
 * Loading → Ready / Empty / Error states. Everything the layer adds — source,
 * layer, listeners, timers, and the greyed base imagery — is removed when the
 * era changes or the map goes away, so rapid switching never leaves a
 * previous year behind.
 *
 * The 1609 era also carries clickable reconstructed blocks, and the future
 * floodplains are polygons rather than tiles; both have their own layers.
 */
export function EraRasterLayer({ map, era, onStatusChange, retryToken = 0 }: Props) {
  const onStatusRef = useRef(onStatusChange);
  onStatusRef.current = onStatusChange;

  const sourceId = eraSourceId(era);
  const layerId = eraLayerId(era);

  useEffect(() => {
    if (!map) return;
    const report = (status: ImageryStatus) => onStatusRef.current?.(status);
    const tiles = era.tiles;
    if (!tiles) {
      if (era.kind === "live") report(READY);
      return;
    }

    let cancelled = false;
    let probeOk = false;
    let tracker = INITIAL_TRACKER;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // The past never shows today's imagery at full strength, even before the
    // probe answers or when it says the year is unavailable.
    const past = isPastEra(era);

    const holdBaseAsContext = () => {
      if (past && styleReady(map) && baseImageryRole(map) !== "context") {
        setBaseImageryRole(map, "context");
      }
    };

    const armTimeout = () => {
      clearTimeout(timer);
      timer = setTimeout(() => dispatch({ type: "timeout" }), FIRST_TILE_TIMEOUT_MS);
    };

    const dispatch = (event: ImageryEvent) => {
      if (cancelled) return;
      const { state, reload } = reduceImagery(tracker, event, era.label);
      const changed = state.status !== tracker.status;
      tracker = state;
      if (tracker.status.phase !== "loading") clearTimeout(timer);
      if (changed) report(tracker.status);
      if (reload) {
        removeLayers(map, [layerId]);
        removeSource(map, sourceId);
        install();
      }
    };

    const install = () => {
      if (cancelled || !styleReady(map)) return;
      holdBaseAsContext();
      if (!probeOk) return;
      const phase = tracker.status.phase;
      if (phase === "unavailable" || phase === "error") return;
      try {
        let added = false;
        if (!hasSource(map, sourceId)) {
          map.addSource(sourceId, {
            type: "raster",
            tiles: [tiles],
            tileSize: 256,
            ...(era.minzoom !== undefined ? { minzoom: era.minzoom } : {}),
            maxzoom: era.maxzoom ?? 19,
            ...(era.bounds ? { bounds: era.bounds } : {}),
            attribution: era.attribution ?? era.agency,
          });
          added = true;
        }
        if (!hasLayer(map, layerId)) {
          map.addLayer(
            {
              id: layerId,
              type: "raster",
              source: sourceId,
              paint: {
                "raster-opacity": era.opacity ?? 1,
                // Cross-fading two different years reads as a third, fictional one.
                "raster-fade-duration": 0,
              },
            },
            eraLayerAnchor(map, "raster")
          );
        }
        if (added) {
          dispatch({ type: "install" });
          armTimeout();
        }
      } catch (error) {
        // The style is mid-swap; the next styledata event installs it.
        console.warn(`Era layer ${era.id} not installed yet`, error);
      }
    };

    const onSourceData = (event: { sourceId?: string; tile?: unknown }) => {
      if (event.sourceId === sourceId && event.tile) dispatch({ type: "tile-loaded" });
    };
    const onError = (event: unknown) => {
      if (errorSourceId(event) === sourceId) dispatch({ type: "tile-failed" });
    };
    const onIdle = () => {
      if (hasSource(map, sourceId)) dispatch({ type: "idle" });
    };

    report(LOADING);
    holdBaseAsContext();
    map.on("styledata", install);
    map.on("style.load", install);
    map.on("sourcedata", onSourceData);
    map.on("error", onError);
    map.on("idle", onIdle);

    void probeEraImageryCached(era).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        dispatch({ type: "probe", result });
        return;
      }
      probeOk = true;
      install();
    });

    return () => {
      cancelled = true;
      clearTimeout(timer);
      map.off("styledata", install);
      map.off("style.load", install);
      map.off("sourcedata", onSourceData);
      map.off("error", onError);
      map.off("idle", onIdle);
      removeLayers(map, [layerId]);
      removeSource(map, sourceId);
      if (past) setBaseImageryRole(map, "present");
    };
  }, [map, era, sourceId, layerId, retryToken]);

  if (era.kind === "reconstruction") {
    return <Welikia1609Layer map={map} />;
  }
  if (era.kind === "floodplain") {
    return (
      <FloodplainLayer
        map={map}
        scenarioId={era.id}
        label={era.label}
        opacity={era.opacity ?? 0.45}
        onStatusChange={onStatusChange}
        retryToken={retryToken}
      />
    );
  }
  return null;
}
