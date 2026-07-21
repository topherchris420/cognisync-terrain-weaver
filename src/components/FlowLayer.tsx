import { forwardRef, useImperativeHandle, useEffect, useRef, useCallback } from "react";
import maplibregl, { Map as MLMap, GeoJSONSource } from "maplibre-gl";
import type { FlowPath } from "@/lib/simulation-types";

interface FlowLayerProps {
  flowPaths?: FlowPath[];
  map?: MLMap | null;
}

export interface FlowLayerHandle {
  addToMap: () => void;
  removeFromMap: () => void;
  updatePaths: (paths: FlowPath[]) => void;
}

const FLOW_SOURCE_ID = "flow-paths-source";
const FLOW_LAYER_ID = "flow-paths-layer";
const FLOW_ANIMATION_LAYER_ID = "flow-paths-animation-layer";

function flowPathsToGeoJSON(paths: FlowPath[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: paths.map((path) => ({
      type: "Feature",
      properties: {
        volume_m3: path.volume_m3,
        velocity_mps: path.velocity_mps,
      },
      geometry: {
        type: "LineString",
        coordinates: path.points,
      },
    })),
  };
}

function calculateOpacity(volume_m3: number): number {
  // Normalize volume to 0.3-1.0 opacity range
  const minOpacity = 0.3;
  const maxOpacity = 1.0;
  // Assume typical volume range 0-1000 m3
  const normalized = Math.min(volume_m3 / 1000, 1);
  return minOpacity + (maxOpacity - minOpacity) * normalized;
}

export const FlowLayer = forwardRef<FlowLayerHandle, FlowLayerProps>(function FlowLayer(
  { flowPaths = [], map },
  ref
) {
  const animationFrameRef = useRef<number | null>(null);
  const dashOffsetRef = useRef(0);

  const addToMap = useCallback(() => {
    if (!map) return;

    // Check if layers already exist
    if (map.getLayer(FLOW_LAYER_ID)) return;

    // Add GeoJSON source
    map.addSource(FLOW_SOURCE_ID, {
      type: "geojson",
      data: flowPathsToGeoJSON(flowPaths),
    });

    // Add static line layer (base)
    map.addLayer({
      id: FLOW_LAYER_ID,
      type: "line",
      source: FLOW_SOURCE_ID,
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": "#3b82f6",
        "line-width": 2,
        "line-opacity": [
          "interpolate",
          ["linear"],
          ["get", "volume_m3"],
          0,
          0.3,
          1000,
          1,
        ],
      },
    });

    // Add animated dashed line layer
    map.addLayer({
      id: FLOW_ANIMATION_LAYER_ID,
      type: "line",
      source: FLOW_SOURCE_ID,
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": "#3b82f6",
        "line-width": 3,
        "line-dasharray": [2, 4],
        "line-opacity": [
          "interpolate",
          ["linear"],
          ["get", "volume_m3"],
          0,
          0.3,
          1000,
          1,
        ],
      },
    });
  }, [map, flowPaths]);

  const removeFromMap = useCallback(() => {
    if (!map) return;

    // Stop animation
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Remove layers
    if (map.getLayer(FLOW_ANIMATION_LAYER_ID)) {
      map.removeLayer(FLOW_ANIMATION_LAYER_ID);
    }
    if (map.getLayer(FLOW_LAYER_ID)) {
      map.removeLayer(FLOW_LAYER_ID);
    }

    // Remove source
    if (map.getSource(FLOW_SOURCE_ID)) {
      map.removeSource(FLOW_SOURCE_ID);
    }
  }, [map]);

  const updatePaths = useCallback(
    (paths: FlowPath[]) => {
      if (!map) return;

      const source = map.getSource(FLOW_SOURCE_ID) as GeoJSONSource;
      if (source) {
        source.setData(flowPathsToGeoJSON(paths));
      } else {
        // Source doesn't exist yet, add it
        map.addSource(FLOW_SOURCE_ID, {
          type: "geojson",
          data: flowPathsToGeoJSON(paths),
        });

        // Add layers if they don't exist
        if (!map.getLayer(FLOW_LAYER_ID)) {
          map.addLayer({
            id: FLOW_LAYER_ID,
            type: "line",
            source: FLOW_SOURCE_ID,
            layout: {
              "line-join": "round",
              "line-cap": "round",
            },
            paint: {
              "line-color": "#3b82f6",
              "line-width": 2,
              "line-opacity": [
                "interpolate",
                ["linear"],
                ["get", "volume_m3"],
                0,
                0.3,
                1000,
                1,
              ],
            },
          });
        }

        if (!map.getLayer(FLOW_ANIMATION_LAYER_ID)) {
          map.addLayer({
            id: FLOW_ANIMATION_LAYER_ID,
            type: "line",
            source: FLOW_SOURCE_ID,
            layout: {
              "line-join": "round",
              "line-cap": "round",
            },
            paint: {
              "line-color": "#3b82f6",
              "line-width": 3,
              "line-dasharray": [2, 4],
              "line-opacity": [
                "interpolate",
                ["linear"],
                ["get", "volume_m3"],
                0,
                0.3,
                1000,
                1,
              ],
            },
          });
        }
      }
    },
    [map]
  );

  // Start animation loop
  useEffect(() => {
    if (!map) return;

    const animate = () => {
      dashOffsetRef.current += 0.5;
      if (dashOffsetRef.current > 6) {
        dashOffsetRef.current = 0;
      }

      if (map.getLayer(FLOW_ANIMATION_LAYER_ID)) {
        map.setPaintProperty(
          FLOW_ANIMATION_LAYER_ID,
          "line-dashoffset",
          dashOffsetRef.current
        );
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    // Start animation once layers are added
    if (map.getLayer(FLOW_ANIMATION_LAYER_ID)) {
      animationFrameRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [map]);

  // Sync overlay with the current paths: add/update when there are paths,
  // and tear the layers down again when they're cleared.
  useEffect(() => {
    if (!map) return;
    if (flowPaths.length > 0) {
      addToMap();
      updatePaths(flowPaths);
    } else {
      removeFromMap();
    }
  }, [flowPaths, map, addToMap, updatePaths, removeFromMap]);

  useImperativeHandle(
    ref,
    () => ({
      addToMap,
      removeFromMap,
      updatePaths,
    }),
    [addToMap, removeFromMap, updatePaths]
  );

  return null;
});