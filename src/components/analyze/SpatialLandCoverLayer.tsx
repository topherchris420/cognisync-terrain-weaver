import { useEffect } from "react";
import type {
  GeoJSONSource,
  Map as MapLibreMap,
  MapLayerMouseEvent,
} from "maplibre-gl";
import { SPATIAL_SOURCE_REGISTRY } from "@/lib/spatial-data/registry";
import type {
  SpatialContextResult,
  SpatialFeatureInspection,
  SpatialFeatureProperties,
  SpatialSourceDefinition,
} from "@/lib/spatial-data/types";

export const SPATIAL_CONTEXT_PREFIX = "mannahatta-spatial-context";
const SOURCE_ID = `${SPATIAL_CONTEXT_PREFIX}-source`;
const POLYGON_LAYER_ID = `${SPATIAL_CONTEXT_PREFIX}-polygons`;
const TREE_LAYER_ID = `${SPATIAL_CONTEXT_PREFIX}-tree-observations`;
const MAP_COLORS = {
  buildings: "hsl(20, 12%, 42%)",
  pavement: "hsl(30, 4%, 55%)",
  water: "hsl(200, 75%, 55%)",
  vegetation: "hsl(130, 45%, 45%)",
} as const;

interface SpatialLandCoverLayerProps {
  map: MapLibreMap | null;
  context: SpatialContextResult | null;
  onInspect: (inspection: SpatialFeatureInspection) => void;
}

function sourceFor(sourceId: string): SpatialSourceDefinition | undefined {
  return Object.values(SPATIAL_SOURCE_REGISTRY).find(
    (source) => source.id === sourceId
  );
}

function inspectionFromFeature(
  feature: GeoJSON.Feature<GeoJSON.Geometry, SpatialFeatureProperties>
): SpatialFeatureInspection {
  const properties = feature.properties;
  const source = sourceFor(properties.sourceId);
  const point = feature.geometry.type === "Point";
  return {
    featureId: properties.featureId,
    surfaceClass: properties.surfaceClass,
    sourceId: properties.sourceId,
    observedAt: properties.observedAt ?? source?.observedAt,
    confidence: properties.confidence,
    geometryStatus: point ? "point observation" : "polygon evidence",
    caveats: source?.caveats ?? [
      "Unclassified area is derived from missing polygon coverage.",
    ],
    agency: source?.agency ?? "Mannahatta Counterfactual Engine",
    availability: source?.availability ?? "unavailable",
    processingMethod:
      source?.processingMethod ??
      "Requested bbox minus loaded official polygon classes.",
    officialUrl: source?.officialUrl ?? "",
    affectedMetrics: source?.affectedMetrics ?? ["coverage status"],
  };
}

function safeHasStyle(map: MapLibreMap | null | undefined): boolean {
  if (!map) return false;
  try {
    return Boolean(!map.getStyle || map.getStyle());
  } catch {
    return false;
  }
}

function safeGetLayer(map: MapLibreMap | null | undefined, id: string) {
  if (!map) return undefined;
  try {
    if (map.getStyle && !map.getStyle()) return undefined;
    return map.getLayer(id);
  } catch {
    return undefined;
  }
}

function safeGetSource(map: MapLibreMap | null | undefined, id: string) {
  if (!map) return undefined;
  try {
    if (map.getStyle && !map.getStyle()) return undefined;
    return map.getSource(id);
  } catch {
    return undefined;
  }
}

function safeRemoveLayer(map: MapLibreMap | null | undefined, id: string) {
  if (!map) return;
  try {
    if (map.getStyle && !map.getStyle()) return;
    if (map.getLayer(id)) map.removeLayer(id);
  } catch {
    // Ignore if map or style was already destroyed
  }
}

function safeRemoveSource(map: MapLibreMap | null | undefined, id: string) {
  if (!map) return;
  try {
    if (map.getStyle && !map.getStyle()) return;
    if (map.getSource(id)) map.removeSource(id);
  } catch {
    // Ignore if map or style was already destroyed
  }
}

export function SpatialLandCoverLayer({
  map,
  context,
  onInspect,
}: SpatialLandCoverLayerProps) {
  useEffect(() => {
    if (!map || !context || !safeHasStyle(map)) return;

    const existing = safeGetSource(map, SOURCE_ID) as GeoJSONSource | undefined;
    if (existing) {
      existing.setData(context.featureCollection);
    } else {
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: context.featureCollection,
      });
    }

    if (!safeGetLayer(map, POLYGON_LAYER_ID)) {
      map.addLayer({
        id: POLYGON_LAYER_ID,
        type: "fill",
        source: SOURCE_ID,
        filter: ["!=", ["get", "surfaceClass"], "tree-observation"],
        paint: {
          "fill-color": [
            "match",
            ["get", "surfaceClass"],
            "buildings",
            MAP_COLORS.buildings,
            "pavement",
            MAP_COLORS.pavement,
            "water",
            MAP_COLORS.water,
            "#8b8b83",
          ],
          "fill-opacity": 0.46,
          "fill-outline-color": "rgba(255,255,255,0.34)",
        },
      });
    }
    if (!safeGetLayer(map, TREE_LAYER_ID)) {
      map.addLayer({
        id: TREE_LAYER_ID,
        type: "circle",
        source: SOURCE_ID,
        filter: ["==", ["get", "surfaceClass"], "tree-observation"],
        paint: {
          "circle-color": MAP_COLORS.vegetation,
          "circle-radius": 3.5,
          "circle-stroke-color": "#f4f1e8",
          "circle-stroke-width": 1,
        },
      });
    }

    const handleClick = (
      event: MapLayerMouseEvent & {
        features?: GeoJSON.Feature<GeoJSON.Geometry, SpatialFeatureProperties>[];
      }
    ) => {
      const feature = event.features?.[0];
      if (feature) onInspect(inspectionFromFeature(feature));
    };
    const onLayerClick = map.on.bind(map) as unknown as (
      type: string,
      layer: string,
      listener: typeof handleClick
    ) => void;
    const offLayerClick = map.off.bind(map) as unknown as (
      type: string,
      layer: string,
      listener: typeof handleClick
    ) => void;
    onLayerClick("click", POLYGON_LAYER_ID, handleClick);
    onLayerClick("click", TREE_LAYER_ID, handleClick);

    return () => {
      offLayerClick("click", POLYGON_LAYER_ID, handleClick);
      offLayerClick("click", TREE_LAYER_ID, handleClick);
      for (const layerId of [TREE_LAYER_ID, POLYGON_LAYER_ID]) {
        safeRemoveLayer(map, layerId);
      }
      safeRemoveSource(map, SOURCE_ID);
    };
  }, [context, map, onInspect]);

  return null;
}
