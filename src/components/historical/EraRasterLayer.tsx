import { useEffect } from "react";
import type { Map as MLMap } from "maplibre-gl";
import { Welikia1609Layer } from "@/components/historical/Welikia1609Layer";
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
      if (!map.getSource(sourceId)) {
        map.addSource(sourceId, {
          type: "raster",
          tiles: [tiles],
          tileSize: 256,
          maxzoom: era.maxzoom ?? 19,
          attribution: era.attribution ?? era.agency,
        });
      }
      if (!map.getLayer(layerId)) {
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

    return () => {
      removed = true;
      map.off("styledata", install);
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    };
  }, [map, tiles, sourceId, layerId, opacity, era.maxzoom, era.attribution, era.agency]);

  if (era.kind === "reconstruction") {
    return <Welikia1609Layer map={map} opacity={opacity} />;
  }
  return null;
}
