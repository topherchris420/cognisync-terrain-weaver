import { useEffect } from "react";
import type { GeoJSONSource, Map as MLMap } from "maplibre-gl";
import { loadFloodplain } from "@/lib/historical/futureFloodplains";

interface Props {
  map: MLMap | null;
  /** Era id, e.g. `fp-2050`. */
  scenarioId: string;
  opacity?: number;
}

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

/**
 * Draws one of the city's published future floodplains as real polygons.
 *
 * Polygons for the visible area are fetched from the city's open data service
 * and refreshed as the map moves, so a whole borough can be inspected without
 * loading the entire city at once.
 */
function safeHasStyle(map: MLMap | null | undefined): boolean {
  if (!map) return false;
  try {
    return Boolean(!map.getStyle || map.getStyle());
  } catch {
    return false;
  }
}

function safeGetLayer(map: MLMap | null | undefined, id: string) {
  if (!map) return undefined;
  try {
    if (map.getStyle && !map.getStyle()) return undefined;
    return map.getLayer(id);
  } catch {
    return undefined;
  }
}

function safeGetSource(map: MLMap | null | undefined, id: string) {
  if (!map) return undefined;
  try {
    if (map.getStyle && !map.getStyle()) return undefined;
    return map.getSource(id);
  } catch {
    return undefined;
  }
}

function safeRemoveLayer(map: MLMap | null | undefined, id: string) {
  if (!map) return;
  try {
    if (map.getStyle && !map.getStyle()) return;
    if (map.getLayer(id)) map.removeLayer(id);
  } catch {
    // Ignore if map or style was already destroyed
  }
}

function safeRemoveSource(map: MLMap | null | undefined, id: string) {
  if (!map) return;
  try {
    if (map.getStyle && !map.getStyle()) return;
    if (map.getSource(id)) map.removeSource(id);
  } catch {
    // Ignore if map or style was already destroyed
  }
}

export function FloodplainLayer({ map, scenarioId, opacity = 0.45 }: Props) {
  const sourceId = `floodplain-${scenarioId}-src`;
  const fillId = `floodplain-${scenarioId}-fill`;
  const lineId = `floodplain-${scenarioId}-line`;

  useEffect(() => {
    if (!map) return;
    let removed = false;

    const install = () => {
      if (removed || !safeHasStyle(map) || !map.isStyleLoaded()) return;
      if (!safeGetSource(map, sourceId)) {
        map.addSource(sourceId, { type: "geojson", data: EMPTY });
      }
      if (!safeGetLayer(map, fillId)) {
        map.addLayer({
          id: fillId,
          type: "fill",
          source: sourceId,
          paint: {
            "fill-color": "hsl(205, 85%, 55%)",
            "fill-opacity": opacity,
          },
        });
      }
      if (!safeGetLayer(map, lineId)) {
        map.addLayer({
          id: lineId,
          type: "line",
          source: sourceId,
          paint: {
            "line-color": "hsl(195, 95%, 70%)",
            "line-width": 0.8,
          },
        });
      }
      void refresh();
    };

    const refresh = async () => {
      if (removed || !safeHasStyle(map)) return;
      const b = map.getBounds();
      try {
        const data = await loadFloodplain(scenarioId, {
          west: b.getWest(),
          south: b.getSouth(),
          east: b.getEast(),
          north: b.getNorth(),
        });
        if (removed || !safeHasStyle(map)) return;
        const source = safeGetSource(map, sourceId) as GeoJSONSource | undefined;
        source?.setData(data);
      } catch {
        // The timeline caption already names the source; the map stays bare.
      }
    };

    install();
    map.on("styledata", install);
    map.on("load", install);
    map.on("idle", install);
    map.on("moveend", refresh);

    return () => {
      removed = true;
      map.off("styledata", install);
      map.off("load", install);
      map.off("idle", install);
      map.off("moveend", refresh);
      for (const id of [lineId, fillId]) {
        safeRemoveLayer(map, id);
      }
      safeRemoveSource(map, sourceId);
    };
  }, [map, scenarioId, sourceId, fillId, lineId, opacity]);

  return null;
}
