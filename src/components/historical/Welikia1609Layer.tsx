import { useEffect, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource, type Map as MLMap } from "maplibre-gl";
import {
  WELIKIA_TILE_URL,
  loadWelikia1609Features,
  type Welikia1609BlockProperties,
} from "@/lib/historical/welikia1609";

const RASTER_SOURCE = "welikia-1609-raster";
const RASTER_LAYER = "welikia-1609-raster-layer";
const BLOCK_SOURCE = "welikia-1609-blocks";
const BLOCK_FILL = "welikia-1609-blocks-fill";
const BLOCK_LINE = "welikia-1609-blocks-line";

const EMPTY: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

interface Welikia1609LayerProps {
  map: MLMap | null;
  /** Raster opacity, 0-1. */
  opacity?: number;
}

/**
 * The 1609 reconstruction drawn on the live map: the georeferenced historical
 * raster underneath, and the reconstructed blocks on top as clickable shapes.
 * Blocks are reloaded for the visible area as the map moves, so the whole city
 * index never has to be drawn at once.
 */
export function Welikia1609Layer({ map, opacity = 0.65 }: Welikia1609LayerProps) {
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const [, setReady] = useState(false);

  useEffect(() => {
    if (!map) return;
    let removed = false;

    const install = () => {
      if (removed) return;
      if (!map.isStyleLoaded()) return;
      if (!map.getSource(RASTER_SOURCE)) {
        map.addSource(RASTER_SOURCE, {
          type: "raster",
          tiles: [WELIKIA_TILE_URL],
          tileSize: 256,
          maxzoom: 16,
          attribution:
            "1609 reconstruction © Welikia Project, Wildlife Conservation Society",
        });
      }
      if (!map.getLayer(RASTER_LAYER)) {
        map.addLayer({
          id: RASTER_LAYER,
          type: "raster",
          source: RASTER_SOURCE,
          paint: { "raster-opacity": opacity },
        });
      }
      if (!map.getSource(BLOCK_SOURCE)) {
        map.addSource(BLOCK_SOURCE, { type: "geojson", data: EMPTY });
      }
      if (!map.getLayer(BLOCK_FILL)) {
        map.addLayer({
          id: BLOCK_FILL,
          type: "fill",
          source: BLOCK_SOURCE,
          paint: {
            "fill-color": [
              "match",
              ["get", "landCover"],
              "water",
              "hsl(200, 75%, 55%)",
              "soil",
              "hsl(35, 35%, 55%)",
              "hsl(130, 45%, 42%)",
            ],
            "fill-opacity": 0.28,
          },
        });
      }
      if (!map.getLayer(BLOCK_LINE)) {
        map.addLayer({
          id: BLOCK_LINE,
          type: "line",
          source: BLOCK_SOURCE,
          paint: {
            "line-color": "rgba(255,255,255,0.35)",
            "line-width": 0.6,
          },
        });
      }
      setReady(true);
      void refresh();
    };

    const refresh = async () => {
      if (removed) return;
      const b = map.getBounds();
      try {
        const data = await loadWelikia1609Features({
          west: b.getWest(),
          south: b.getSouth(),
          east: b.getEast(),
          north: b.getNorth(),
        });
        if (removed) return;
        const source = map.getSource(BLOCK_SOURCE) as GeoJSONSource | undefined;
        source?.setData(data);
      } catch {
        // The panel already reports a failed index load; the map just stays bare.
      }
    };

    const handleClick = (
      event: maplibregl.MapMouseEvent & {
        features?: GeoJSON.Feature<
          GeoJSON.Geometry,
          Welikia1609BlockProperties
        >[];
      }
    ) => {
      const props = event.features?.[0]?.properties;
      if (!props) return;
      popupRef.current?.remove();
      popupRef.current = new maplibregl.Popup({ closeButton: true, maxWidth: "260px" })
        .setLngLat(event.lngLat)
        .setHTML(
          `<div style="font-size:11px;line-height:1.5">
             <div style="text-transform:uppercase;letter-spacing:.08em;opacity:.65">1609 · Welikia reconstruction</div>
             <div style="font-weight:600;margin:2px 0 4px">${props.community}</div>
             <div>Vegetation ${props.vegetation}% · Soil ${props.soil}% · Water ${props.water}%</div>
             <div style="margin-top:2px;opacity:.75">Absorption score ${props.absorptionScore}</div>
           </div>`
        )
        .addTo(map);
    };

    const setCursor = (cursor: string) => () => {
      map.getCanvas().style.cursor = cursor;
    };
    const onEnter = setCursor("pointer");
    const onLeave = setCursor("");

    const on = map.on.bind(map) as unknown as (
      type: string,
      layer: string,
      listener: (e: never) => void
    ) => void;
    const off = map.off.bind(map) as unknown as (
      type: string,
      layer: string,
      listener: (e: never) => void
    ) => void;

    install();
    map.on("styledata", install);

    on("click", BLOCK_FILL, handleClick as unknown as (e: never) => void);
    on("mouseenter", BLOCK_FILL, onEnter as unknown as (e: never) => void);
    on("mouseleave", BLOCK_FILL, onLeave as unknown as (e: never) => void);
    map.on("moveend", refresh);

    return () => {
      removed = true;
      map.off("styledata", install);
      popupRef.current?.remove();
      off("click", BLOCK_FILL, handleClick as unknown as (e: never) => void);
      off("mouseenter", BLOCK_FILL, onEnter as unknown as (e: never) => void);
      off("mouseleave", BLOCK_FILL, onLeave as unknown as (e: never) => void);
      map.off("moveend", refresh);
      for (const id of [BLOCK_LINE, BLOCK_FILL, RASTER_LAYER]) {
        if (map.getLayer(id)) map.removeLayer(id);
      }
      for (const id of [BLOCK_SOURCE, RASTER_SOURCE]) {
        if (map.getSource(id)) map.removeSource(id);
      }
    };
  }, [map, opacity]);

  useEffect(() => {
    if (!map || !map.getLayer(RASTER_LAYER)) return;
    map.setPaintProperty(RASTER_LAYER, "raster-opacity", opacity);
  }, [map, opacity]);

  return null;
}
