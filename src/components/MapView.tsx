import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import maplibregl, { Map as MLMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, SatelliteDish } from "lucide-react";

export interface MapViewHandle {
  captureImage: () => Promise<string | null>;
  getBounds: () => [[number, number], [number, number]] | null;
  getCenter: () => { lat: number; lng: number };
  getZoom: () => number;
  flyTo: (lat: number, lng: number, zoom?: number) => void;
  /** The live MapLibre instance, for overlay layers (flow paths, risk zones). */
  getMap: () => MLMap | null;
}

interface Props {
  initialCenter?: [number, number]; // [lng, lat]
  initialZoom?: number;
  onReady?: () => void;
  onViewChange?: (v: { lat: number; lng: number; zoom: number }) => void;
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

export const MapView = forwardRef<MapViewHandle, Props>(function MapView(
  { initialCenter = [-73.985, 40.758], initialZoom = 15, onReady, onViewChange },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "connecting", provider: 0 });
  const [attempt, setAttempt] = useState(0);

  // Kept in refs so the map effect never re-runs for a new callback identity,
  // and so a Retry recreates the map at the view the user was last on.
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const onViewChangeRef = useRef(onViewChange);
  onViewChangeRef.current = onViewChange;
  const viewRef = useRef<{ center: [number, number]; zoom: number }>({
    center: initialCenter,
    zoom: initialZoom,
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
        minZoom: 2,
        maxZoom: 19,
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
      onReadyRef.current?.();
    });

    map.on("error", (e) => {
      if (connected || disposed) return;
      console.error("Map error before imagery connected:", e.error ?? e);
      tileErrors += 1;
      if (tileErrors >= MAX_TILE_ERRORS) nextProvider("tile errors");
    });

    map.on("moveend", () => {
      const c = map.getCenter();
      viewRef.current = { center: [c.lng, c.lat], zoom: map.getZoom() };
      onViewChangeRef.current?.({ lat: c.lat, lng: c.lng, zoom: map.getZoom() });
    });

    mapRef.current = map;
    return () => {
      disposed = true;
      window.clearTimeout(watchdog);
      map.remove();
      mapRef.current = null;
    };
  }, [attempt]);

  const retry = () => {
    setStatus({ kind: "connecting", provider: 0 });
    setAttempt((a) => a + 1);
  };

  useImperativeHandle(
    ref,
    () => ({
      async captureImage() {
        const map = mapRef.current;
        if (!map) return null;

        // Hide the place labels before capturing. The tile goes to a vision
        // model for land-cover classification, and burnt-in street names and
        // city labels are text the model would try to read as terrain. The
        // user sees labels; the classifier must not.
        const hadLabels = Boolean(map.getLayer(LABELS_LAYER_ID));
        if (hadLabels) {
          map.setLayoutProperty(LABELS_LAYER_ID, "visibility", "none");
        }

        const repaint = () =>
          new Promise<void>((resolve) => {
            map.once("render", () => resolve());
            map.triggerRepaint();
          });

        try {
          // Force a repaint so the drawing buffer reflects the hidden labels.
          await repaint();
          return map.getCanvas().toDataURL("image/jpeg", 0.82);
        } catch (e) {
          console.error("captureImage failed", e);
          return null;
        } finally {
          if (hadLabels) {
            map.setLayoutProperty(LABELS_LAYER_ID, "visibility", "visible");
            await repaint();
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
        const c = mapRef.current!.getCenter();
        return { lat: c.lat, lng: c.lng };
      },
      getZoom() {
        return mapRef.current!.getZoom();
      },
      flyTo(lat, lng, zoom) {
        mapRef.current?.flyTo({
          center: [lng, lat],
          zoom: zoom ?? mapRef.current!.getZoom(),
          essential: true,
        });
      },
      getMap() {
        return mapRef.current;
      },
    }),
    []
  );

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
