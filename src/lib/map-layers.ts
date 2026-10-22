import type { Map as MLMap } from "maplibre-gl";

/**
 * Small, defensive helpers for layers that come and go on a live map.
 *
 * Overlays are installed and removed while tiles stream, styles swap between
 * imagery providers, and panes unmount. Every helper here tolerates a map
 * whose style is mid-swap or already destroyed.
 */

/** The present-day satellite layer every MapView style starts with. */
export const BASE_IMAGERY_LAYER_ID = "satellite";

/** Prefixes owned by the era timeline, so a capture can find and hide them. */
export const ERA_LAYER_PREFIXES = ["era-", "welikia-1609-", "floodplain-"] as const;

export function isEraLayerId(id: string): boolean {
  return ERA_LAYER_PREFIXES.some((prefix) => id.startsWith(prefix));
}

/**
 * True once the style document is parsed and sources can be added.
 *
 * Not `map.isStyleLoaded()`: that stays false while any tile is in flight,
 * which is exactly when a year switch happens. Waiting on it left the new
 * year's layer uninstalled until every terrain and imagery tile had settled.
 */
export function styleReady(map: MLMap | null | undefined): boolean {
  if (!map) return false;
  try {
    const style = (map as unknown as { style?: { _loaded?: unknown } }).style;
    if (style && typeof style._loaded === "boolean") return style._loaded;
    return Boolean(map.isStyleLoaded?.());
  } catch {
    return false;
  }
}

export function hasLayer(map: MLMap | null | undefined, id: string): boolean {
  if (!map) return false;
  try {
    return Boolean(map.getLayer(id));
  } catch {
    return false;
  }
}

export function hasSource(map: MLMap | null | undefined, id: string): boolean {
  if (!map) return false;
  try {
    return Boolean(map.getSource(id));
  } catch {
    return false;
  }
}

export function removeLayers(map: MLMap | null | undefined, ids: readonly string[]) {
  if (!map) return;
  for (const id of ids) {
    try {
      if (map.getLayer(id)) map.removeLayer(id);
    } catch {
      // Map or style already destroyed.
    }
  }
}

export function removeSource(map: MLMap | null | undefined, id: string) {
  if (!map) return;
  try {
    if (map.getSource(id)) map.removeSource(id);
  } catch {
    // Map or style already destroyed.
  }
}

/** Layer ids bottom to top, or an empty list when the style is unavailable. */
export function layerOrder(map: MLMap): string[] {
  try {
    if (typeof map.getLayersOrder === "function") return map.getLayersOrder();
  } catch {
    // Fall through.
  }
  return [];
}

/**
 * The layer an era layer is inserted before. Era layers sit above the base
 * imagery and below the hillshade, labels and every analysis overlay: added to
 * the top, a full-cover aerial photograph hid the flood model and flow paths.
 *
 * A `raster` goes directly on the base, under any era shapes already drawn;
 * an `overlay` (reconstructed blocks, floodplain polygons) goes above every
 * era layer, so it is never buried by the imagery it annotates.
 */
export function eraLayerAnchor(
  map: MLMap,
  kind: "raster" | "overlay"
): string | undefined {
  const order = layerOrder(map);
  const base = order.indexOf(BASE_IMAGERY_LAYER_ID);
  if (base === -1) return undefined;
  const above = order.slice(base + 1);
  return kind === "raster" ? above[0] : above.find((id) => !isEraLayerId(id));
}

export type BaseImageryRole = "present" | "context";

const BASE_PAINT: Record<BaseImageryRole, Record<string, number>> = {
  present: { "raster-saturation": 0, "raster-opacity": 1 },
  // Greyed and faded: still orients the eye where a historical survey has no
  // tile, but can never be mistaken for imagery of that year.
  context: { "raster-saturation": -1, "raster-opacity": 0.35 },
};

/** Show today's imagery as itself, or as greyed context under the past. */
export function setBaseImageryRole(map: MLMap | null | undefined, role: BaseImageryRole) {
  if (!map || !hasLayer(map, BASE_IMAGERY_LAYER_ID)) return;
  for (const [property, value] of Object.entries(BASE_PAINT[role])) {
    try {
      map.setPaintProperty(BASE_IMAGERY_LAYER_ID, property, value);
    } catch {
      // Style mid-swap; the next install pass reapplies it.
    }
  }
}

export function baseImageryRole(map: MLMap | null | undefined): BaseImageryRole {
  if (!map || !hasLayer(map, BASE_IMAGERY_LAYER_ID)) return "present";
  try {
    const saturation = map.getPaintProperty?.(BASE_IMAGERY_LAYER_ID, "raster-saturation");
    return typeof saturation === "number" && saturation < 0 ? "context" : "present";
  } catch {
    return "present";
  }
}
