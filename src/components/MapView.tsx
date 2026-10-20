import { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react";
import maplibregl, { Map as MLMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, SatelliteDish } from "lucide-react";
import type { MapCameraState } from "@/lib/counterfactual/types";
import {
  BUILDINGS_LAYER_ID,
  BUILDINGS_SOURCE_ID,
  FLOOD_VOLUME_LAYER_ID,
  HILLSHADE_EXAGGERATION_FLAT,
  HILLSHADE_EXAGGERATION_RELIEF,
  HILLSHADE_LAYER_ID,
  HILLSHADE_SOURCE_ID,
  TERRAIN_OVERLAY_SOURCE_IDS,
  TERRARIUM_SOURCE_ID,
  buildingsLayer,
  buildingsSource,
  flatMapLight,
  flatMapSky,
  hillshadeLayer,
  hillshadeLighting,
  hillshadeSource,
  terrainExaggerationForZoom,
  terrainLight,
  terrainPitchForZoom,
  terrainSky,
  terrariumSource,
} from "@/lib/terrain-scene";
import { RELIEF_RISE_FROM, TerrainRelief } from "@/lib/terrain-relief";
import { registerTerrariumProtocol } from "@/lib/terrarium-protocol";

registerTerrariumProtocol(maplibregl);

export interface MapViewHandle {
  captureImage: () => Promise<string | null>;
  getBounds: () => [[number, number], [number, number]] | null;
  getCenter: () => { lat: number; lng: number };
  getZoom: () => number;
  flyTo: (lat: number, lng: number, zoom?: number) => void;
  fitBounds: (
    bounds: [[number, number], [number, number]],
    padding?: number
  ) => void;
  /** The live MapLibre instance, for overlay layers (flow paths, risk zones). */
  getMap: () => MLMap | null;
}

export interface MapViewReadyPayload {
  handle: MapViewHandle;
  map: MLMap;
}

export interface MapViewProps {
  initialCenter?: [number, number]; // [lng, lat]
  initialZoom?: number;
  camera?: MapCameraState;
  onReady?: (payload: MapViewReadyPayload) => void;
  onCameraChange?: (camera: MapCameraState) => void;
  onViewChange?: (v: { lat: number; lng: number; zoom: number }) => void;
  /** Extra-dimensional terrain from Mapzen Terrarium tiles. */
  terrainEnabled?: boolean;
  /**
   * Vertical exaggeration for the terrain mesh. When omitted, the mesh
   * follows the local relief in view (Auto).
   */
  terrainExaggeration?: number;
  /** The mesh scale each time the relief settles, Auto included. */
  onReliefChange?: (exaggeration: number) => void;
}

function overlaySourceId(event: unknown): string | undefined {
  if (!event || typeof event !== "object" || !("sourceId" in event)) return undefined;
  const sourceId = (event as { sourceId?: unknown }).sourceId;
  return typeof sourceId === "string" ? sourceId : undefined;
}

function layerBefore(
  map: MLMap,
  candidates: string[]
): string | undefined {
  if (typeof map.getLayer !== "function") return undefined;
  return candidates.find((id) => map.getLayer(id));
}

function setLayerVisibility(map: MLMap, id: string, visibility: "visible" | "none") {
  if (typeof map.getLayer !== "function" || !map.getLayer(id)) return;
  if (typeof map.setLayoutProperty !== "function") return;
  map.setLayoutProperty(id, "visibility", visibility);
}

/** Atmosphere drawn behind a pitched camera. */
/** Camera pitch used when a caller sets an explicit relief factor. */
const EXPLICIT_RELIEF_PITCH = 74;

function explicitExaggeration(exaggeration?: number): number | undefined {
  return typeof exaggeration === "number" && Number.isFinite(exaggeration)
    ? exaggeration
    : undefined;
}

function styleParsed(map: MLMap): boolean {
  return Boolean(!map.getStyle || map.getStyle());
}

/**
 * Hillshade stays on in the flat view. Pitched mode adds a terrain mesh,
 * building mass, and a sky so the storm has a ground to sit on.
 *
 * The mesh scale is set when the mesh is first added, or when a caller
 * passes a different one. Otherwise it is left alone so an animation that
 * owns it (see TerrainRelief) is not snapped to its end value.
 */
export function applyElevationOverlays(
  map: MLMap,
  terrainEnabled: boolean,
  exaggeration?: number
) {
  try {
    if (typeof map.getSource !== "function" || typeof map.addSource !== "function") {
      return;
    }
    if (!styleParsed(map)) return;

    const zoom = typeof map.getZoom === "function" ? map.getZoom() : 15;
    const requested = explicitExaggeration(exaggeration);
    const currentTerrain =
      typeof map.getTerrain === "function" ? map.getTerrain() : null;
    const wasDimensional = Boolean(currentTerrain);

    if (!map.getSource(TERRARIUM_SOURCE_ID)) {
      map.addSource(TERRARIUM_SOURCE_ID, terrariumSource());
    }
    if (!map.getSource(HILLSHADE_SOURCE_ID)) {
      map.addSource(HILLSHADE_SOURCE_ID, hillshadeSource());
    }
    const hillshadeExaggeration = terrainEnabled
      ? HILLSHADE_EXAGGERATION_RELIEF
      : HILLSHADE_EXAGGERATION_FLAT;
    if (typeof map.getLayer === "function" && !map.getLayer(HILLSHADE_LAYER_ID)) {
      map.addLayer(
        hillshadeLayer(hillshadeExaggeration, terrainEnabled),
        layerBefore(map, [LABELS_LAYER_ID])
      );
    } else if (typeof map.setPaintProperty === "function") {
      map.setPaintProperty(
        HILLSHADE_LAYER_ID,
        "hillshade-exaggeration",
        hillshadeExaggeration
      );
    }

    if (!terrainEnabled) {
      if (typeof map.setTerrain === "function") map.setTerrain(null);
      setLayerVisibility(map, BUILDINGS_LAYER_ID, "none");
      setLayerVisibility(map, FLOOD_VOLUME_LAYER_ID, "none");
      if (wasDimensional) {
        if (typeof map.setSky === "function") map.setSky(flatMapSky());
        if (typeof map.setLight === "function") map.setLight(flatMapLight());
      }
      return;
    }

    if (
      typeof map.setTerrain === "function" &&
      (!currentTerrain ||
        (requested !== undefined && currentTerrain.exaggeration !== requested))
    ) {
      map.setTerrain({
        source: TERRARIUM_SOURCE_ID,
        exaggeration: requested ?? terrainExaggerationForZoom(zoom),
      });
    }
    if (!map.getSource(BUILDINGS_SOURCE_ID)) {
      map.addSource(BUILDINGS_SOURCE_ID, buildingsSource());
    }
    if (typeof map.getLayer === "function" && !map.getLayer(BUILDINGS_LAYER_ID)) {
      map.addLayer(
        buildingsLayer(),
        layerBefore(map, [
          FLOOD_VOLUME_LAYER_ID,
          "risk-zones-heat-layer",
          "risk-zones-layer",
          "flow-paths-glow-layer",
          LABELS_LAYER_ID,
        ])
      );
    }
    setLayerVisibility(map, BUILDINGS_LAYER_ID, "visible");
    setLayerVisibility(map, FLOOD_VOLUME_LAYER_ID, "visible");
    if (typeof map.setSky === "function") map.setSky(terrainSky());
    if (typeof map.setLight === "function") map.setLight(terrainLight());
  } catch (error) {
    console.warn("Terrain overlay unavailable", error);
  }
}

interface ImageryProvider {
  id: string;
  label: string;
  tiles: string;
  maxzoom: number;
  attribution: string;
}

// Keyless satellite imagery providers, tried in order. If the current one
// can't deliver a single tile the map hot-swaps to the next.
const PROVIDERS: ImageryProvider[] = [
  {
    id: "esri-world-imagery",
    label: "Esri World Imagery",
    tiles:
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    maxzoom: 19,
    attribution:
      "Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community",
  },
  {
    id: "eox-s2cloudless",
    label: "Sentinel-2 cloudless",
    tiles:
      "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg",
    maxzoom: 15,
    attribution: "Sentinel-2 cloudless (2020) by EOX IT Services GmbH",
  },
];

// How long a provider gets to deliver its first tile. Hung connections never
// fire an error event, so a watchdog is the only reliable failure signal.
const FIRST_TILE_TIMEOUT_MS = 10_000;
// Tile-fetch errors tolerated before giving up on a provider early.
const MAX_TILE_ERRORS = 3;

// Place and boundary labels drawn over the imagery. Bare satellite is beautiful
// and useless for orientation -- you cannot tell which city you are looking at.
const LABEL_TILES =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";

const LABELS_LAYER_ID = "place-labels";

// Labels are an orientation aid, not a map feature. Zoomed out they tell you
// which city you are looking at; zoomed in this reference layer stamps a label
// on every individual building and buries the imagery under red text. They cut
// out before analysis zoom (14-15), which is also exactly where the imagery has
// to be legible.
const LABELS_MAX_ZOOM = 13;

function styleFor(p: ImageryProvider): maplibregl.StyleSpecification {
  return {
    version: 8,
    sources: {
      satellite: {
        type: "raster",
        tiles: [p.tiles],
        tileSize: 256,
        // Source-level maxzoom lets MapLibre overzoom (scale) the deepest
        // tiles instead of requesting levels the provider doesn't serve.
        maxzoom: p.maxzoom,
        attribution: p.attribution,
      },
      labels: {
        type: "raster",
        tiles: [LABEL_TILES],
        tileSize: 256,
        maxzoom: 19,
      },
    },
    layers: [
      { id: "satellite", type: "raster", source: "satellite" },
      {
        id: LABELS_LAYER_ID,
        type: "raster",
        source: "labels",
        maxzoom: LABELS_MAX_ZOOM,
        paint: { "raster-opacity": 0.9 },
      },
    ],
  };
}

type Status =
  | { kind: "connecting"; provider: number }
  | { kind: "ready" }
  | { kind: "failed"; reason: "imagery" | "webgl" };

export const MapView = forwardRef<MapViewHandle, MapViewProps>(function MapView(
  {
    initialCenter = [-73.985, 40.758],
    initialZoom = 15,
    camera,
    onReady,
    onCameraChange,
    onViewChange,
    terrainEnabled = false,
    terrainExaggeration,
    onReliefChange,
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const reliefRef = useRef<TerrainRelief | null>(null);
  const readyHandleRef = useRef<MapViewHandle | null>(null);
  const applyingControlledCameraRef = useRef(false);
  const [status, setStatus] = useState<Status>({ kind: "connecting", provider: 0 });
  const [attempt, setAttempt] = useState(0);

  // Kept in refs so the map effect never re-runs for a new callback identity,
  // and so a Retry recreates the map at the view the user was last on.
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const onViewChangeRef = useRef(onViewChange);
  onViewChangeRef.current = onViewChange;
  const onCameraChangeRef = useRef(onCameraChange);
  onCameraChangeRef.current = onCameraChange;
  const terrainEnabledRef = useRef(terrainEnabled);
  terrainEnabledRef.current = terrainEnabled;
  const terrainExaggerationRef = useRef(terrainExaggeration);
  terrainExaggerationRef.current = terrainExaggeration;
  const onReliefChangeRef = useRef(onReliefChange);
  onReliefChangeRef.current = onReliefChange;
  const viewRef = useRef<MapCameraState>({
    center: initialCenter,
    zoom: initialZoom,
    bearing: 0,
    pitch: 0,
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let map: MLMap;
    try {
      map = new maplibregl.Map({
        container,
        style: styleFor(PROVIDERS[0]),
        center: viewRef.current.center,
        zoom: viewRef.current.zoom,
        bearing: viewRef.current.bearing,
        pitch: viewRef.current.pitch,
        minZoom: 2,
        maxZoom: 19,
        maxPitch: 85,
        // Required so we can read pixels off the canvas for AI analysis.
        canvasContextAttributes: { preserveDrawingBuffer: true },
        attributionControl: { compact: true },
      });
    } catch (e) {
      // Typically WebGL2 unavailable: disabled, blocked, or context lost.
      console.error("Map failed to initialize:", e);
      setStatus({ kind: "failed", reason: "webgl" });
      return;
    }

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right"
    );
    map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
      }),
      "top-right"
    );
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");

    let disposed = false;
    let provider = 0;
    let connected = false;
    let tileErrors = 0;
    let watchdog: number | undefined;

    const relief = new TerrainRelief(map, {
      onSettle: (exaggeration) => onReliefChangeRef.current?.(exaggeration),
    });
    reliefRef.current = relief;

    // A style swap drops the mesh; put it back at the scale it was heading to.
    const restoreOverlays = () => {
      const enabled = terrainEnabledRef.current;
      const explicit = explicitExaggeration(terrainExaggerationRef.current);
      const hadTerrain = Boolean(map.getTerrain?.());
      applyElevationOverlays(
        map,
        enabled,
        hadTerrain ? undefined : relief.settledValue ?? explicit
      );
      if (!enabled) {
        relief.dispose();
      } else if (map.getTerrain?.()) {
        relief.retarget(explicit);
      }
    };

    const nextProvider = (why: string) => {
      if (disposed || connected) return;
      window.clearTimeout(watchdog);
      if (provider + 1 >= PROVIDERS.length) {
        console.error(
          `Imagery provider ${PROVIDERS[provider].id} failed (${why}); no providers left.`
        );
        setStatus({ kind: "failed", reason: "imagery" });
        return;
      }
      console.warn(
        `Imagery provider ${PROVIDERS[provider].id} failed (${why}); switching to ${PROVIDERS[provider + 1].id}.`
      );
      provider += 1;
      tileErrors = 0;
      setStatus({ kind: "connecting", provider });
      map.setStyle(styleFor(PROVIDERS[provider]));
      watchdog = window.setTimeout(() => nextProvider("timeout"), FIRST_TILE_TIMEOUT_MS);
    };

    watchdog = window.setTimeout(() => nextProvider("timeout"), FIRST_TILE_TIMEOUT_MS);

    // A sourcedata event carrying a tile means real imagery arrived. The
    // "load" event alone can't be trusted: it never fires when the tile
    // server is unreachable, and hung requests produce no error either.
    map.on("sourcedata", (e) => {
      if (connected || disposed || !e.tile) return;
      connected = true;
      window.clearTimeout(watchdog);
      setStatus({ kind: "ready" });
      restoreOverlays();
      const handle = readyHandleRef.current;
      if (handle) onReadyRef.current?.({ handle, map });
    });

    map.on("style.load", () => {
      if (disposed) return;
      restoreOverlays();
    });

    map.on("error", (e) => {
      if (connected || disposed) return;
      const sourceId = overlaySourceId(e);
      if (
        sourceId &&
        (TERRAIN_OVERLAY_SOURCE_IDS as readonly string[]).includes(sourceId)
      ) {
        return;
      }
      console.error("Map error before imagery connected:", e.error ?? e);
      tileErrors += 1;
      if (tileErrors >= MAX_TILE_ERRORS) nextProvider("tile errors");
    });

    map.on("moveend", () => {
      const c = map.getCenter();
      const nextCamera: MapCameraState = {
        center: [c.lng, c.lat],
        zoom: map.getZoom(),
        bearing: map.getBearing(),
        pitch: map.getPitch(),
      };
      viewRef.current = nextCamera;
      if (applyingControlledCameraRef.current) {
        applyingControlledCameraRef.current = false;
        return;
      }
      onCameraChangeRef.current?.(nextCamera);
      onViewChangeRef.current?.({
        lat: c.lat,
        lng: c.lng,
        zoom: nextCamera.zoom,
      });
    });

    mapRef.current = map;
    return () => {
      disposed = true;
      window.clearTimeout(watchdog);
      relief.dispose();
      reliefRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [attempt]);

  useEffect(() => {
    const map = mapRef.current;
    const relief = reliefRef.current;
    if (!map || !relief) return;
    const explicit = explicitExaggeration(terrainExaggeration);
    const hadTerrain = Boolean(map.getTerrain?.());
    if (terrainEnabled && !hadTerrain) {
      // Lay the mesh down nearly flat, then let the ground rise into place.
      applyElevationOverlays(map, true, RELIEF_RISE_FROM);
      if (map.getTerrain?.()) relief.rise(explicit);
    } else if (terrainEnabled) {
      applyElevationOverlays(map, true);
      relief.retarget(explicit);
    } else if (hadTerrain) {
      relief.sink(() => {
        if (!terrainEnabledRef.current) applyElevationOverlays(map, false);
      });
    } else {
      applyElevationOverlays(map, false);
    }
    if (typeof map.easeTo !== "function") return;
    if (terrainEnabled) {
      const zoom = map.getZoom?.() ?? 15;
      const targetPitch =
        explicitExaggeration(terrainExaggeration) === undefined
          ? terrainPitchForZoom(zoom)
          : EXPLICIT_RELIEF_PITCH;
      map.easeTo({
        pitch: Math.max(map.getPitch?.() ?? 0, targetPitch),
        bearing: map.getBearing?.() || -24,
        duration: 1100,
        essential: true,
      });
    } else if ((map.getPitch?.() ?? 0) > 1) {
      map.easeTo({ pitch: 0, duration: 700 });
    }
  }, [terrainEnabled, terrainExaggeration]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !camera) return;
    const center = map.getCenter();
    const changed =
      Math.abs(center.lng - camera.center[0]) > 1e-7 ||
      Math.abs(center.lat - camera.center[1]) > 1e-7 ||
      Math.abs(map.getZoom() - camera.zoom) > 1e-7 ||
      Math.abs(map.getBearing() - camera.bearing) > 1e-7 ||
      Math.abs(map.getPitch() - camera.pitch) > 1e-7;
    if (!changed) return;
    applyingControlledCameraRef.current = true;
    viewRef.current = camera;
    map.jumpTo({
      center: camera.center,
      zoom: camera.zoom,
      bearing: camera.bearing,
      pitch: camera.pitch,
    });
  }, [camera]);

  const retry = () => {
    setStatus({ kind: "connecting", provider: 0 });
    setAttempt((a) => a + 1);
  };

  // Built unconditionally, not inside useImperativeHandle: React skips the
  // imperative-handle factory when no ref is passed, and panes that only use
  // onReady (the era comparison view) would then never receive the map.
  const handle: MapViewHandle = useMemo(() => {
    const value: MapViewHandle = {

      async captureImage() {
        const map = mapRef.current;
        if (!map) return null;

        // Hide the place labels before capturing. The tile goes to a vision
        // model for land-cover classification, and burnt-in street names and
        // city labels are text the model would try to read as terrain. The
        // user sees labels; the classifier must not.
        let hadLabels = false;
        const prevPitch = typeof map.getPitch === "function" ? map.getPitch() : 0;
        const prevBearing = typeof map.getBearing === "function" ? map.getBearing() : 0;
        const hadTerrain =
          typeof map.getTerrain === "function" && Boolean(map.getTerrain());
        try {
          if (!map.getStyle || map.getStyle()) {
            hadLabels =
              Boolean(map.getLayer(LABELS_LAYER_ID)) &&
              map.getLayoutProperty?.(LABELS_LAYER_ID, "visibility") !== "none";
          }
        } catch {
          hadLabels = false;
        }

        if (hadLabels) {
          try {
            map.setLayoutProperty(LABELS_LAYER_ID, "visibility", "none");
          } catch {
            // Ignore layer updates if map style was destroyed
          }
        }
        if (hadTerrain && typeof map.setTerrain === "function") {
          map.setTerrain(null);
        }
        // Shading tints the imagery the classifier reads as land cover.
        const hiddenReliefLayers: string[] = [];
        for (const layerId of [HILLSHADE_LAYER_ID, BUILDINGS_LAYER_ID, FLOOD_VOLUME_LAYER_ID]) {
          if (typeof map.getLayer !== "function" || !map.getLayer(layerId)) continue;
          let visibility: string | undefined;
          try {
            visibility =
              typeof map.getLayoutProperty === "function"
                ? map.getLayoutProperty(layerId, "visibility")
                : undefined;
          } catch {
            visibility = undefined;
          }
          if (visibility === "none") continue;
          setLayerVisibility(map, layerId, "none");
          hiddenReliefLayers.push(layerId);
        }
        if (
          (prevPitch > 0.4 || Math.abs(prevBearing) > 0.4) &&
          typeof map.jumpTo === "function"
        ) {
          map.jumpTo({ pitch: 0, bearing: 0 });
        }

        const repaint = () =>
          new Promise<void>((resolve) => {
            map.once("render", () => resolve());
            map.triggerRepaint();
          });

        try {
          // Force a repaint so the drawing buffer reflects the hidden labels
          // and a nadir view — pitched terrain would fool the land-cover model.
          await repaint();
          return map.getCanvas().toDataURL("image/jpeg", 0.82);
        } catch (e) {
          console.error("captureImage failed", e);
          return null;
        } finally {
          if (hadTerrain && typeof map.setTerrain === "function") {
            const zoom = typeof map.getZoom === "function" ? map.getZoom() : 15;
            map.setTerrain({
              source: TERRARIUM_SOURCE_ID,
              exaggeration:
                reliefRef.current?.settledValue ??
                explicitExaggeration(terrainExaggerationRef.current) ??
                terrainExaggerationForZoom(zoom),
            });
          }
          for (const layerId of hiddenReliefLayers) {
            setLayerVisibility(map, layerId, "visible");
          }
          if (
            (prevPitch > 0.4 || Math.abs(prevBearing) > 0.4) &&
            typeof map.jumpTo === "function"
          ) {
            map.jumpTo({ pitch: prevPitch, bearing: prevBearing });
          }
          if (hadLabels) {
            try {
              if (!map.getStyle || map.getStyle()) {
                map.setLayoutProperty(LABELS_LAYER_ID, "visibility", "visible");
                await repaint();
              }
            } catch {
              // Ignore layer updates if map style was destroyed
            }
          }
        }
      },
      getBounds() {
        const map = mapRef.current;
        if (!map) return null;
        const b = map.getBounds();
        return [
          [b.getWest(), b.getSouth()],
          [b.getEast(), b.getNorth()],
        ];
      },
      getCenter() {
        const c = mapRef.current?.getCenter();
        return c
          ? { lat: c.lat, lng: c.lng }
          : {
              lat: viewRef.current.center[1],
              lng: viewRef.current.center[0],
            };
      },
      getZoom() {
        return mapRef.current?.getZoom() ?? viewRef.current.zoom;
      },
      flyTo(lat, lng, zoom) {
        mapRef.current?.flyTo({
          center: [lng, lat],
          zoom: zoom ?? mapRef.current!.getZoom(),
          essential: true,
        });
      },
      fitBounds(bounds, padding = 48) {
        mapRef.current?.fitBounds(bounds, {
          padding,
          essential: true,
        });
      },
      getMap() {
        return mapRef.current;
      },
    };
    return value;
  }, []);

  readyHandleRef.current = handle;

  useImperativeHandle(ref, () => handle, [handle]);


  return (
    <div className="relative h-full w-full">
      {/*
        Inline styles, not Tailwind classes: maplibre-gl.css sets
        `.maplibregl-map { position: relative }` on this element and loads
        after the Tailwind bundle (route-split CSS), which overrides the
        `absolute` utility and collapses the map to 0 height.
      */}
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
      {status.kind === "connecting" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 bg-background/70 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          {status.provider === 0
            ? "Connecting to satellite imagery…"
            : `Primary imagery unreachable — trying ${PROVIDERS[status.provider].label}…`}
        </div>
      )}
      {status.kind === "failed" && (
        <div
          role="alert"
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/85 p-6 text-center"
        >
          <SatelliteDish className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          <div className="text-sm font-medium">
            {status.reason === "webgl"
              ? "The map renderer couldn't start"
              : "Satellite imagery is unreachable"}
          </div>
          <p className="max-w-sm text-xs text-muted-foreground">
            {status.reason === "webgl"
              ? "Your browser blocked WebGL, which the map needs to draw imagery. Enable hardware acceleration or try another browser, then retry."
              : "None of the imagery providers responded. Check your connection, then retry."}
          </p>
          <Button variant="outline" size="sm" onClick={retry} className="gap-2">
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Reconnect map
          </Button>
        </div>
      )}
    </div>
  );
});
