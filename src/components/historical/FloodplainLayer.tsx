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
export function FloodplainLayer({ map, scenarioId, opacity = 0.45 }: Props) {
  const sourceId = `floodplain-${scenarioId}-src`;
  const fillId = `floodplain-${scenarioId}-fill`;
  const lineId = `floodplain-${scenarioId}-line`;

  useEffect(() => {
    if (!map) return;
    let removed = false;

    const install = () => {
      if (removed || !map.isStyleLoaded()) return;
      if (!map.getSource(sourceId)) {
        map.addSource(sourceId, { type: "geojson", data: EMPTY });
      }
      if (!map.getLayer(fillId)) {
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
      if (!map.getLayer(lineId)) {
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
      if (removed) return;
      const b = map.getBounds();
      try {
        const data = await loadFloodplain(scenarioId, {
          west: b.getWest(),
          south: b.getSouth(),
          east: b.getEast(),
          north: b.getNorth(),
        });
        if (removed) return;
        const source = map.getSource(sourceId) as GeoJSONSource | undefined;
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
        if (map.getLayer(id)) map.removeLayer(id);
      }
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    };
  }, [map, scenarioId, sourceId, fillId, lineId, opacity]);

  return null;
}
