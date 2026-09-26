import type { Map as MLMap } from "maplibre-gl";

/**
 * While a shape is being drawn, every click on the map is a vertex. Layers
 * with their own click popups or hover cursors check this and stand aside,
 * so placing a point over a pond doesn't open its depth card.
 */
function container(map: MLMap | null | undefined): HTMLElement | null {
  try {
    return typeof map?.getContainer === "function" ? map.getContainer() : null;
  } catch {
    return null;
  }
}

export function setMapDrawing(map: MLMap | null | undefined, drawing: boolean) {
  const el = container(map);
  if (!el) return;
  if (drawing) el.dataset.drawing = "true";
  else delete el.dataset.drawing;
}

export function isMapDrawing(map: MLMap | null | undefined): boolean {
  return container(map)?.dataset.drawing === "true";
}
