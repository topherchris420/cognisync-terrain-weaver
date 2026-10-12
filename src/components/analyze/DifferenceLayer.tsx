import { useEffect } from "react";
import maplibregl, { type GeoJSONSource, type Map as MLMap, type MapGeoJSONFeature, type MapMouseEvent } from "maplibre-gl";
import { differenceGeoJSON, SPATIAL_DIFFERENCE_CAVEAT, type DifferenceFeatureProperties, type SpatialDifference } from "@/lib/counterfactual/difference";
import type { SimExtent } from "@/lib/hydrology/types";
import { isMapDrawing } from "@/lib/map-drawing";
import { DIFFERENCE_LESS, DIFFERENCE_MORE } from "@/lib/water-palette";

export const DIFFERENCE_SOURCE_ID = "mannahatta-difference-source";
export const DIFFERENCE_FILL_ID = "mannahatta-difference-fill";
export const DIFFERENCE_OUTLINE_ID = "mannahatta-difference-outline";

/** Drawn beneath the flow paths so their glow stays legible; above everything else. */
const ABOVE_OF = "flow-paths-glow-layer";

interface Props {
  map: MLMap | null;
  difference: SpatialDifference | null;
  /** The extent the pair was routed on; cells are placed on its grid. */
  extent: SimExtent | null;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

function hasStyle(map: MLMap): boolean {
  try {
    return Boolean(!map.getStyle || map.getStyle());
  } catch {
    return false;
  }
}

function layerExists(map: MLMap, id: string): boolean {
  try {
    return hasStyle(map) && Boolean(map.getLayer(id));
  } catch {
    return false;
  }
}

const volume = (value: number) => `${Math.abs(value) < 10 ? Math.abs(value).toFixed(2) : Math.round(Math.abs(value)).toLocaleString("en-US")} m³`;

function popupHtml(properties: DifferenceFeatureProperties): string {
  const less = properties.delta_m3 < 0;
  const where = properties.kind === "source" ? "Under the drawing: this cell's own runoff changed." : `${Math.round(properties.reach_m).toLocaleString("en-US")} m downstream of the drawing: only what arrives here changed.`;
  return `
    <div class="atlas-popup">
      <div class="atlas-popup-title"><span class="atlas-popup-swatch" style="background:${less ? DIFFERENCE_LESS : DIFFERENCE_MORE}"></span>${less ? "Less water passes here" : "More water passes here"}</div>
      <dl>
        <div><dt>NOW → POSSIBLE</dt><dd>${volume(properties.now_m3)} → ${volume(properties.possible_m3)}</dd></div>
        <div><dt>Change</dt><dd>${less ? "−" : "+"}${volume(properties.delta_m3)}</dd></div>
      </dl>
      <p>${escapeHtml(where)} ${escapeHtml(SPATIAL_DIFFERENCE_CAVEAT)}</p>
    </div>`;
}

/**
 * The spatial difference of a controlled pair, cell by cell: green where the
 * redesigned surface sends less water through a cell, amber where it sends
 * more, the strongest changes most opaque, the drawing's own cells outlined.
 * Nothing is drawn for a pair that is not a controlled comparison.
 */
export function DifferenceLayer({ map, difference, extent }: Props) {
  useEffect(() => {
    if (!map || !extent || !difference || difference.status !== "controlled") return;
    const data = differenceGeoJSON(difference, extent);
    let cancelled = false;
    let bound = false;
    let popup: maplibregl.Popup | null = null;

    const onClick = (event: MapMouseEvent & { features?: MapGeoJSONFeature[] }) => {
      if (isMapDrawing(map)) return;
      const properties = event.features?.[0]?.properties as DifferenceFeatureProperties | undefined;
      if (!properties || !Number.isFinite(Number(properties.delta_m3))) return;
      popup?.remove();
      popup = new maplibregl.Popup({ closeButton: true, className: "atlas-map-popup", maxWidth: "280px" })
        .setLngLat(event.lngLat)
        .setHTML(popupHtml({ ...properties, delta_m3: Number(properties.delta_m3), now_m3: Number(properties.now_m3), possible_m3: Number(properties.possible_m3), reach_m: Number(properties.reach_m) }))
        .addTo(map);
    };
    const enter = () => {
      if (!isMapDrawing(map)) map.getCanvas().style.cursor = "pointer";
    };
    const leave = () => {
      if (map.getCanvas().style.cursor === "pointer") map.getCanvas().style.cursor = "";
    };

    const attach = () => {
      if (cancelled || !hasStyle(map)) return;
      try {
        const existing = map.getSource(DIFFERENCE_SOURCE_ID) as GeoJSONSource | undefined;
        if (existing) existing.setData(data);
        else map.addSource(DIFFERENCE_SOURCE_ID, { type: "geojson", data });
        const beforeId = layerExists(map, ABOVE_OF) ? ABOVE_OF : undefined;
        if (!layerExists(map, DIFFERENCE_FILL_ID)) {
          map.addLayer(
            {
              id: DIFFERENCE_FILL_ID,
              type: "fill",
              source: DIFFERENCE_SOURCE_ID,
              paint: {
                "fill-color": ["case", ["<", ["get", "delta_m3"], 0], DIFFERENCE_LESS, DIFFERENCE_MORE],
                "fill-opacity": ["interpolate", ["linear"], ["get", "share"], 0, 0.16, 1, 0.78],
              },
            },
            beforeId,
          );
        }
        if (!layerExists(map, DIFFERENCE_OUTLINE_ID)) {
          map.addLayer(
            {
              id: DIFFERENCE_OUTLINE_ID,
              type: "line",
              source: DIFFERENCE_SOURCE_ID,
              filter: ["==", ["get", "kind"], "source"],
              paint: { "line-color": "#f3fbe6", "line-width": 1.25, "line-opacity": 0.8, "line-dasharray": [2, 1.5] },
            },
            beforeId,
          );
        }
        if (!bound) {
          map.on("click", DIFFERENCE_FILL_ID, onClick);
          map.on("mouseenter", DIFFERENCE_FILL_ID, enter);
          map.on("mouseleave", DIFFERENCE_FILL_ID, leave);
          bound = true;
        }
      } catch {
        map.once("idle", attach);
      }
    };
    attach();

    return () => {
      cancelled = true;
      map.off("idle", attach);
      popup?.remove();
      if (bound) {
        map.off("click", DIFFERENCE_FILL_ID, onClick);
        map.off("mouseenter", DIFFERENCE_FILL_ID, enter);
        map.off("mouseleave", DIFFERENCE_FILL_ID, leave);
      }
      if (!hasStyle(map)) return;
      try {
        if (map.getLayer(DIFFERENCE_OUTLINE_ID)) map.removeLayer(DIFFERENCE_OUTLINE_ID);
        if (map.getLayer(DIFFERENCE_FILL_ID)) map.removeLayer(DIFFERENCE_FILL_ID);
        if (map.getSource(DIFFERENCE_SOURCE_ID)) map.removeSource(DIFFERENCE_SOURCE_ID);
      } catch {
        // Style already gone.
      }
    };
  }, [map, difference, extent]);
  return null;
}
