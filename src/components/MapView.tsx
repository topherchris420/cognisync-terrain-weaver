import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import maplibregl, { Map as MLMap, LngLatBoundsLike } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export interface MapViewHandle {
  captureImage: () => Promise<string | null>;
  getBounds: () => [[number, number], [number, number]] | null;
  getCenter: () => { lat: number; lng: number };
  getZoom: () => number;
  flyTo: (lat: number, lng: number, zoom?: number) => void;
}

interface Props {
  initialCenter?: [number, number]; // [lng, lat]
  initialZoom?: number;
  onReady?: () => void;
  onViewChange?: (v: { lat: number; lng: number; zoom: number }) => void;
}

// Free ESRI World Imagery satellite tiles (no key required).
const SATELLITE_TILES =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

const STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    "esri-satellite": {
      type: "raster",
      tiles: [SATELLITE_TILES],
      tileSize: 256,
      attribution:
        "Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    },
  },
  layers: [
    {
      id: "satellite",
      type: "raster",
      source: "esri-satellite",
      minzoom: 0,
      maxzoom: 22,
    },
  ],
};

export const MapView = forwardRef<MapViewHandle, Props>(function MapView(
  { initialCenter = [-73.985, 40.758], initialZoom = 15, onReady, onViewChange },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE,
      center: initialCenter,
      zoom: initialZoom,
      minZoom: 2,
      maxZoom: 19,
      // Required so we can read pixels off the canvas for AI analysis.
      canvasContextAttributes: { preserveDrawingBuffer: true },
      attributionControl: { compact: true },
    });

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

    map.on("load", () => {
      setReady(true);
      onReady?.();
    });
    map.on("moveend", () => {
      const c = map.getCenter();
      onViewChange?.({ lat: c.lat, lng: c.lng, zoom: map.getZoom() });
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      async captureImage() {
        const map = mapRef.current;
        if (!map) return null;
        // Force a repaint so the drawing buffer is fresh.
        await new Promise<void>((resolve) => {
          map.once("render", () => resolve());
          map.triggerRepaint();
        });
        try {
          return map.getCanvas().toDataURL("image/jpeg", 0.82);
        } catch (e) {
          console.error("captureImage failed", e);
          return null;
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
    }),
    []
  );

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="absolute inset-0" />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/70 text-sm text-muted-foreground">
          Loading satellite imagery…
        </div>
      )}
    </div>
  );
});
