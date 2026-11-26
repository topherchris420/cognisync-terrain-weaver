import { useEffect, useRef } from "react";
import type { GeoJSONSource, Map as MLMap } from "maplibre-gl";
import { loadFloodplain } from "@/lib/historical/futureFloodplains";
import type { ImageryStatus } from "@/lib/historical/era-imagery";
import {
  eraLayerAnchor,
  hasLayer,
  hasSource,
  removeLayers,
  removeSource,
  styleReady,
} from "@/lib/map-layers";

interface Props {
  map: MLMap | null;
  /** Era id, e.g. `fp-2050`. */
  scenarioId: string;
  /** Timeline label, for status messages. */
  label?: string;
  opacity?: number;
  onStatusChange?: (status: ImageryStatus) => void;
  /** Bump to refetch after an error. */
  retryToken?: number;
}

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

/**
 * Draws one of the city's published future floodplains as real polygons.
 *
 * Polygons for the visible area are fetched from the city's open data service
 * and refreshed as the map moves, so a whole borough can be inspected without
 * loading the entire city at once.
 */
export function FloodplainLayer({
  map,
  scenarioId,
  label = scenarioId,
  opacity = 0.45,
  onStatusChange,
  retryToken = 0,
}: Props) {
  const sourceId = `floodplain-${scenarioId}-src`;
  const fillId = `floodplain-${scenarioId}-fill`;
  const lineId = `floodplain-${scenarioId}-line`;
  const onStatusRef = useRef(onStatusChange);
  onStatusRef.current = onStatusChange;

  useEffect(() => {
    if (!map) return;
    let removed = false;
    // A slow response for a view the user has left must not overwrite the
    // polygons for where they are now.
    let generation = 0;
    const report = (status: ImageryStatus) => {
      if (!removed) onStatusRef.current?.(status);
    };

    const install = () => {
      if (removed || !styleReady(map)) return;
      try {
        let added = false;
        if (!hasSource(map, sourceId)) {
          map.addSource(sourceId, { type: "geojson", data: EMPTY });
          added = true;
        }
        const anchor = eraLayerAnchor(map, "overlay");
        if (!hasLayer(map, fillId)) {
          map.addLayer(
            {
              id: fillId,
              type: "fill",
              source: sourceId,
              paint: {
                "fill-color": "hsl(205, 85%, 55%)",
                "fill-opacity": opacity,
              },
            },
            anchor
          );
        }
        if (!hasLayer(map, lineId)) {
          map.addLayer(
            {
              id: lineId,
              type: "line",
              source: sourceId,
              paint: {
                "line-color": "hsl(195, 95%, 70%)",
                "line-width": 0.8,
              },
            },
            anchor
          );
        }
        if (added) void refresh();
      } catch (error) {
        console.warn(`Floodplain ${scenarioId} not installed yet`, error);
      }
    };

    const refresh = async () => {
      if (removed || !styleReady(map)) return;
      const request = ++generation;
      const b = map.getBounds();
      try {
        const data = await loadFloodplain(scenarioId, {
          west: b.getWest(),
          south: b.getSouth(),
          east: b.getEast(),
          north: b.getNorth(),
        });
        if (removed || request !== generation) return;
        const source = map.getSource(sourceId) as GeoJSONSource | undefined;
        source?.setData(data);
        report(
          data.features.length > 0
            ? { phase: "ready" }
            : {
                phase: "empty",
                message: `The ${label} floodplain does not reach this view.`,
              }
        );
      } catch {
        if (removed || request !== generation) return;
        report({
          phase: "error",
          message: `The ${label} floodplain could not be loaded from NYC Open Data. Check the connection and retry.`,
          retriable: true,
        });
      }
    };

    report({ phase: "loading" });
    install();
    map.on("styledata", install);
    map.on("style.load", install);
    map.on("moveend", refresh);

    return () => {
      removed = true;
      map.off("styledata", install);
      map.off("style.load", install);
      map.off("moveend", refresh);
      removeLayers(map, [lineId, fillId]);
      removeSource(map, sourceId);
    };
  }, [map, scenarioId, label, sourceId, fillId, lineId, opacity, retryToken]);

  return null;
}
