import { useEffect } from "react";
import type { Map as MLMap } from "maplibre-gl";
import { Welikia1609Layer } from "@/components/historical/Welikia1609Layer";
import { FloodplainLayer } from "@/components/historical/FloodplainLayer";
import type { MapEra } from "@/lib/historical/eras";

interface Props {
  map: MLMap | null;
  era: MapEra;
}

/**
 * Draws one era's published raster on the live map.
 *
 * The 1609 era has its own layer because it carries clickable reconstructed
 * blocks as well as imagery; every other era is a single tiled raster, so one
 * component covers all of them.
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

export function EraRasterLayer({ map, era }: Props) {
  const sourceId = `era-${era.id}-src`;
  const layerId = `era-${era.id}-layer`;
  const tiles = era.tiles;
  const opacity = era.opacity ?? 1;

  useEffect(() => {
    if (!map || !tiles) return;
    let removed = false;

    const install = () => {
      if (removed) return;
      if (!safeHasStyle(map) || !map.isStyleLoaded()) return;
      if (!safeGetSource(map, sourceId)) {
        map.addSource(sourceId, {
          type: "raster",
          tiles: [tiles],
          tileSize: 256,
          maxzoom: era.maxzoom ?? 19,
          attribution: era.attribution ?? era.agency,
        });
      }
      if (!safeGetLayer(map, layerId)) {
        map.addLayer({
          id: layerId,
          type: "raster",
          source: sourceId,
          paint: { "raster-opacity": opacity },
        });
      }
    };

    install();
    map.on("styledata", install);
    map.on("load", install);
    map.on("idle", install);

    return () => {
      removed = true;
      map.off("styledata", install);
      map.off("load", install);
      map.off("idle", install);
      safeRemoveLayer(map, layerId);
      safeRemoveSource(map, sourceId);
    };
  }, [map, tiles, sourceId, layerId, opacity, era.maxzoom, era.attribution, era.agency]);

  if (era.kind === "reconstruction") {
    return <Welikia1609Layer map={map} opacity={opacity} />;
  }
  if (era.kind === "floodplain") {
    return <FloodplainLayer map={map} scenarioId={era.id} opacity={opacity} />;
  }
  return null;
}
