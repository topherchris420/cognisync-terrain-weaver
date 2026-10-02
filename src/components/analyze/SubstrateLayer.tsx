import { useEffect } from "react";
import type { Map as MLMap } from "maplibre-gl";
import { displayFeatures, type SubstrateView } from "@/lib/urban-substrate/loader";

const SOURCE = "urban-substrate-source";
const FILL = "urban-substrate-buildings";
const LINE = "urban-substrate-streets";

/**
 * Substrate footprints and street centrelines on the existing MapLibre map:
 * full detail where local tiles are loaded, faint simplified context beyond.
 * Display only; nothing drawn here enters any calculation.
 */
export function SubstrateLayer({ map, view }: { map: MLMap | null; view: SubstrateView | null }) {
  useEffect(() => {
    if (!map || !view) return;
    let cancelled = false;
    const hasStyle = () => {
      try {
        return Boolean(map.getStyle());
      } catch {
        return false;
      }
    };
    // Layers can only be added once the style is ready; until then, retry when the map goes idle.
    const attach = () => {
      if (cancelled) return;
      try {
        if (!map.getSource(SOURCE)) map.addSource(SOURCE, { type: "geojson", data: displayFeatures(view) });
        if (!map.getLayer(FILL)) {
          map.addLayer({
            id: FILL,
            type: "fill",
            source: SOURCE,
            filter: ["==", ["get", "kind"], "building"],
            paint: {
              "fill-color": "#c9b38a",
              "fill-opacity": ["case", ["==", ["get", "level"], "local"], 0.22, 0.08],
              "fill-outline-color": "#e7d7b4",
            },
          });
        }
        if (!map.getLayer(LINE)) {
          map.addLayer({
            id: LINE,
            type: "line",
            source: SOURCE,
            filter: ["==", ["get", "kind"], "street"],
            paint: { "line-color": "#e8e2d4", "line-width": 1, "line-opacity": 0.55 },
          });
        }
      } catch {
        map.once("idle", attach);
      }
    };
    attach();
    return () => {
      cancelled = true;
      map.off("idle", attach);
      if (!hasStyle()) return;
      try {
        if (map.getLayer(LINE)) map.removeLayer(LINE);
        if (map.getLayer(FILL)) map.removeLayer(FILL);
        if (map.getSource(SOURCE)) map.removeSource(SOURCE);
      } catch {
        // Style destroyed.
      }
    };
  }, [map, view]);
  return null;
}
