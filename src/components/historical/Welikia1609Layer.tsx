import { useEffect, useRef } from "react";
import maplibregl, { type GeoJSONSource, type Map as MLMap } from "maplibre-gl";
import {
  loadWelikia1609Features,
  type Welikia1609BlockProperties,
} from "@/lib/historical/welikia1609";
import {
  eraLayerAnchor,
  hasLayer,
  hasSource,
  removeLayers,
  removeSource,
  styleReady,
} from "@/lib/map-layers";

const WELIKIA_BLOCK_SOURCE = "welikia-1609-blocks";
const WELIKIA_BLOCK_FILL = "welikia-1609-blocks-fill";
const WELIKIA_BLOCK_LINE = "welikia-1609-blocks-line";

const EMPTY: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

interface Welikia1609LayerProps {
  map: MLMap | null;
}

/**
 * The 1609 reconstruction's blocks, drawn as clickable shapes over the
 * reconstruction raster (which `EraRasterLayer` draws and tracks like every
 * other era). Blocks are reloaded for the visible area as the map moves, so
 * the whole city index never has to be drawn at once.
 */
export function Welikia1609Layer({ map }: Welikia1609LayerProps) {
  const popupRef = useRef<maplibregl.Popup | null>(null);

  useEffect(() => {
    if (!map) return;
    let removed = false;
    // Only the newest request may write: a slow response for a view the user
    // has already left must not replace the blocks for where they are now.
    let generation = 0;

    const install = () => {
      if (removed || !styleReady(map)) return;
      try {
        let added = false;
        if (!hasSource(map, WELIKIA_BLOCK_SOURCE)) {
          map.addSource(WELIKIA_BLOCK_SOURCE, { type: "geojson", data: EMPTY });
          added = true;
        }
        const anchor = eraLayerAnchor(map, "overlay");
        if (!hasLayer(map, WELIKIA_BLOCK_FILL)) {
          map.addLayer(
            {
              id: WELIKIA_BLOCK_FILL,
              type: "fill",
              source: WELIKIA_BLOCK_SOURCE,
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
            },
            anchor
          );
        }
        if (!hasLayer(map, WELIKIA_BLOCK_LINE)) {
          map.addLayer(
            {
              id: WELIKIA_BLOCK_LINE,
              type: "line",
              source: WELIKIA_BLOCK_SOURCE,
              paint: {
                "line-color": "rgba(255,255,255,0.35)",
                "line-width": 0.6,
              },
            },
            anchor
          );
        }
        if (added) void refresh();
      } catch (error) {
        console.warn("1609 blocks not installed yet", error);
      }
    };

    const refresh = async () => {
      if (removed || !styleReady(map)) return;
      const request = ++generation;
      const b = map.getBounds();
      try {
        const data = await loadWelikia1609Features({
          west: b.getWest(),
          south: b.getSouth(),
          east: b.getEast(),
          north: b.getNorth(),
        });
        if (removed || request !== generation) return;
        const source = map.getSource(WELIKIA_BLOCK_SOURCE) as GeoJSONSource | undefined;
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
    map.on("style.load", install);

    on("click", WELIKIA_BLOCK_FILL, handleClick as unknown as (e: never) => void);
    on("mouseenter", WELIKIA_BLOCK_FILL, onEnter as unknown as (e: never) => void);
    on("mouseleave", WELIKIA_BLOCK_FILL, onLeave as unknown as (e: never) => void);
    map.on("moveend", refresh);

    return () => {
      removed = true;
      map.off("styledata", install);
      map.off("style.load", install);
      popupRef.current?.remove();
      off("click", WELIKIA_BLOCK_FILL, handleClick as unknown as (e: never) => void);
      off("mouseenter", WELIKIA_BLOCK_FILL, onEnter as unknown as (e: never) => void);
      off("mouseleave", WELIKIA_BLOCK_FILL, onLeave as unknown as (e: never) => void);
      map.off("moveend", refresh);
      removeLayers(map, [WELIKIA_BLOCK_LINE, WELIKIA_BLOCK_FILL]);
      removeSource(map, WELIKIA_BLOCK_SOURCE);
    };
  }, [map]);

  return null;
}
