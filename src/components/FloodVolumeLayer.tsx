import { useEffect } from "react";
import maplibregl, { type GeoJSONSource, type Map as MLMap } from "maplibre-gl";
import type { RiskZone } from "@/lib/simulation-types";
import {
  FLOOD_VOLUME_LAYER_ID,
  FLOOD_VOLUME_SOURCE_ID,
  floodExtrusionHeightExpression,
  floodVolumeGeoJSON,
  terrainExaggerationForZoom,
} from "@/lib/terrain-scene";

interface FloodVolumeLayerProps {
  map?: MLMap | null;
  riskZones?: RiskZone[];
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

function styleReady(map: MLMap): boolean {
  try {
    return Boolean(!map.isStyleLoaded || map.isStyleLoaded());
  } catch {
    return false;
  }
}

function layerExists(map: MLMap, id: string): boolean {
  try {
    if (map.getStyle && !map.getStyle()) return false;
    return Boolean(map.getLayer(id));
  } catch {
    return false;
  }
}

/**
 * Standing water for the pitched view. Columns use the modeled depth,
 * scaled with the terrain exaggeration so they stay readable on the mesh.
 * The flat risk heatmap remains the 2D reading of the same cells.
 */
export function FloodVolumeLayer({
  map,
  riskZones = [],
}: FloodVolumeLayerProps) {
  useEffect(() => {
    if (!map) return;

    const sync = () => {
      if (!styleReady(map)) return;
      const data = floodVolumeGeoJSON(riskZones);
      const exaggeration = terrainExaggerationForZoom(
        typeof map.getZoom === "function" ? map.getZoom() : 15
      );
      const height = floodExtrusionHeightExpression(exaggeration);

      try {
        if (map.getStyle && !map.getStyle()) return;
        const existing = map.getSource(FLOOD_VOLUME_SOURCE_ID) as
          | GeoJSONSource
          | undefined;
        if (existing) {
          existing.setData(data);
        } else if (data.features.length > 0) {
          map.addSource(FLOOD_VOLUME_SOURCE_ID, {
            type: "geojson",
            data,
          });
        }
        if (data.features.length === 0) {
          if (layerExists(map, FLOOD_VOLUME_LAYER_ID)) {
            map.removeLayer(FLOOD_VOLUME_LAYER_ID);
          }
          if (map.getSource(FLOOD_VOLUME_SOURCE_ID)) {
            map.removeSource(FLOOD_VOLUME_SOURCE_ID);
          }
          return;
        }
        if (!layerExists(map, FLOOD_VOLUME_LAYER_ID)) {
          map.addLayer({
            id: FLOOD_VOLUME_LAYER_ID,
            type: "fill-extrusion",
            source: FLOOD_VOLUME_SOURCE_ID,
            paint: {
              "fill-extrusion-color": [
                "interpolate",
                ["linear"],
                ["get", "depth_m"],
                0.1,
                "#a5f3fc",
                0.5,
                "#38bdf8",
                1.5,
                "#0284c7",
                3.0,
                "#0f4c81",
              ],
              "fill-extrusion-height": height,
              "fill-extrusion-base": 0.1,
              "fill-extrusion-opacity": 0.72,
              "fill-extrusion-vertical-gradient": true,
            },
          });
        } else {
          map.setPaintProperty(
            FLOOD_VOLUME_LAYER_ID,
            "fill-extrusion-height",
            height
          );
        }
      } catch (error) {
        console.warn("Flood volume overlay unavailable", error);
      }
    };

    const onClick = (
      event: maplibregl.MapMouseEvent & {
        features?: maplibregl.MapGeoJSONFeature[];
      }
    ) => {
      const depth = Number(event.features?.[0]?.properties?.depth_m);
      if (!Number.isFinite(depth)) return;
      const level = escapeHtml(
        String(event.features?.[0]?.properties?.level ?? "flood")
      );
      new maplibregl.Popup({ closeButton: true, className: "hydro-vector-popup" })
        .setLngLat(event.lngLat)
        .setHTML(
          `<div class="p-2 text-xs font-mono bg-card text-foreground rounded shadow-md border border-border min-w-[180px]">
            <div class="font-bold text-primary mb-1 border-b border-border pb-1 uppercase tracking-wider">Standing water</div>
            <div class="flex justify-between"><span class="text-muted-foreground">Modeled depth</span><span class="font-bold">${depth.toFixed(2)} m</span></div>
            <div class="flex justify-between"><span class="text-muted-foreground">Risk band</span><span class="font-bold">${level}</span></div>
          </div>`
        )
        .addTo(map);
    };

    const bindClick = () => {
      if (!layerExists(map, FLOOD_VOLUME_LAYER_ID)) return;
      map.on("click", FLOOD_VOLUME_LAYER_ID, onClick);
    };
    const onIdle = () => {
      sync();
      bindClick();
    };

    sync();
    bindClick();
    map.on("zoomend", sync);
    if (!styleReady(map) || !layerExists(map, FLOOD_VOLUME_LAYER_ID)) {
      map.once("idle", onIdle);
    }

    return () => {
      map.off("zoomend", sync);
      map.off("idle", onIdle);
      if (layerExists(map, FLOOD_VOLUME_LAYER_ID)) {
        map.off("click", FLOOD_VOLUME_LAYER_ID, onClick);
      }
      try {
        if (layerExists(map, FLOOD_VOLUME_LAYER_ID)) {
          map.removeLayer(FLOOD_VOLUME_LAYER_ID);
        }
        if (map.getStyle && !map.getStyle()) return;
        if (map.getSource(FLOOD_VOLUME_SOURCE_ID)) {
          map.removeSource(FLOOD_VOLUME_SOURCE_ID);
        }
      } catch {
        // Map style may already be gone.
      }
    };
  }, [map, riskZones]);

  return null;
}
