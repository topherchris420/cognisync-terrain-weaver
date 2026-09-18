import { forwardRef, useImperativeHandle, useEffect, useRef, useCallback } from "react";
import maplibregl, { Map as MLMap, GeoJSONSource, Popup } from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import type { FlowPath } from "@/lib/simulation-types";
import { smoothFlowPoints } from "@/lib/simulation";

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
const FLOW_GLOW_LAYER_ID = "flow-paths-glow-layer";
const FLOW_LAYER_ID = "flow-paths-layer";
const FLOW_ANIMATION_LAYER_ID = "flow-paths-animation-layer";

function flowPathsToGeoJSON(paths: FlowPath[]): FeatureCollection {
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
        coordinates: smoothFlowPoints(path.points, 2),
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
    if (map.isStyleLoaded() && map.getLayer(FLOW_LAYER_ID)) return;

    // Add GeoJSON source
    map.addSource(FLOW_SOURCE_ID, {
      type: "geojson",
      data: flowPathsToGeoJSON(flowPaths),
    });

    // Add glowing blur layer underneath
    map.addLayer({
      id: FLOW_GLOW_LAYER_ID,
      type: "line",
      source: FLOW_SOURCE_ID,
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": "#60a5fa",
        "line-width": 8,
        "line-blur": 6,
        "line-opacity": [
          "interpolate",
          ["linear"],
          ["get", "volume_m3"],
          0,
          0.1,
          1000,
          0.6,
        ],
      },
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
    if (map.isStyleLoaded() && map.getLayer(FLOW_ANIMATION_LAYER_ID)) {
      map.removeLayer(FLOW_ANIMATION_LAYER_ID);
    }
    if (map.isStyleLoaded() && map.getLayer(FLOW_LAYER_ID)) {
      map.removeLayer(FLOW_LAYER_ID);
    }
    if (map.isStyleLoaded() && map.getLayer(FLOW_GLOW_LAYER_ID)) {
      map.removeLayer(FLOW_GLOW_LAYER_ID);
    }

    // Remove source
    if (map.isStyleLoaded() && map.getSource(FLOW_SOURCE_ID)) {
      map.removeSource(FLOW_SOURCE_ID);
    }
  }, [map]);

  const updatePaths = useCallback(
    (paths: FlowPath[]) => {
      if (!map) return;

      const source = map.isStyleLoaded() && map.getSource(FLOW_SOURCE_ID) as GeoJSONSource;
      if (source) {
        source.setData(flowPathsToGeoJSON(paths));
      } else {
        // Source doesn't exist yet, add it
        map.addSource(FLOW_SOURCE_ID, {
          type: "geojson",
          data: flowPathsToGeoJSON(paths),
        });

        // Add layers if they don't exist
        if (!map.isStyleLoaded() && map.getLayer(FLOW_GLOW_LAYER_ID)) {
          map.addLayer({
            id: FLOW_GLOW_LAYER_ID,
            type: "line",
            source: FLOW_SOURCE_ID,
            layout: {
              "line-join": "round",
              "line-cap": "round",
            },
            paint: {
              "line-color": "#60a5fa",
              "line-width": 8,
              "line-blur": 6,
              "line-opacity": [
                "interpolate",
                ["linear"],
                ["get", "volume_m3"],
                0,
                0.1,
                1000,
                0.6,
              ],
            },
          });
        }

        if (!map.isStyleLoaded() && map.getLayer(FLOW_LAYER_ID)) {
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

        if (!map.isStyleLoaded() && map.getLayer(FLOW_ANIMATION_LAYER_ID)) {
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

  // Compute dynamic physical velocity step based on flow paths
  const calculateVelocityStep = useCallback(() => {
    if (!flowPaths || flowPaths.length === 0) return 0.5;
    const totalVel = flowPaths.reduce((sum, p) => sum + (p.velocity_mps || 1.5), 0);
    const avgVel = totalVel / flowPaths.length;
    // Scale 1 m/s to ~0.3 step, bounded between 0.2 and 2.5
    return Math.max(0.2, Math.min(2.5, avgVel * 0.25));
  }, [flowPaths]);

  // Handle interactive hover / click popup inspection
  const popupRef = useRef<Popup | null>(null);

  useEffect(() => {
    if (!map) return;

    const handleMouseEnter = () => {
      map.getCanvas().style.cursor = "pointer";
    };

    const handleMouseLeave = () => {
      map.getCanvas().style.cursor = "";
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
    };

    const handleClick = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
      if (!e.features || e.features.length === 0) return;
      const feat = e.features[0];
      const props = feat.properties || {};
      const vol = Number(props.volume_m3 || 0);
      const vel = Number(props.velocity_mps || 0);

      const energyLevel = vel > 4 ? "High Kinetic Surge" : vel > 2 ? "Moderate Channeling" : "Standard Runoff";
      const energyColor = vel > 4 ? "text-destructive font-bold" : vel > 2 ? "text-amber-500 font-bold" : "text-primary font-bold";

      const html = `
        <div class="p-2 text-xs font-mono bg-card text-foreground rounded shadow-md border border-border min-w-[180px]">
          <div class="font-bold text-primary mb-1 border-b border-border pb-1 uppercase tracking-wider flex items-center justify-between">
            <span>Hydrodynamic Flow Vector</span>
          </div>
          <div class="space-y-1 mt-1.5">
            <div class="flex justify-between">
              <span class="text-muted-foreground">Discharge Volume:</span>
              <span class="font-bold">${vol.toLocaleString()} m³</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted-foreground">Flow Velocity:</span>
              <span class="font-bold">${vel.toFixed(1)} m/s</span>
            </div>
            <div class="flex justify-between items-center pt-1 border-t border-border/50 text-[10px]">
              <span class="text-muted-foreground">Energy Profile:</span>
              <span class="${energyColor}">${energyLevel}</span>
            </div>
          </div>
        </div>
      `;

      if (popupRef.current) popupRef.current.remove();
      popupRef.current = new maplibregl.Popup({ closeButton: true, className: "hydro-vector-popup" })
        .setLngLat(e.lngLat)
        .setHTML(html)
        .addTo(map);
    };

    if (map.isStyleLoaded() && map.getLayer(FLOW_LAYER_ID)) {
      map.on("mouseenter", FLOW_LAYER_ID, handleMouseEnter);
      map.on("mouseleave", FLOW_LAYER_ID, handleMouseLeave);
      map.on("click", FLOW_LAYER_ID, handleClick);
    }

    return () => {
      if (map.isStyleLoaded() && map.getLayer(FLOW_LAYER_ID)) {
        map.off("mouseenter", FLOW_LAYER_ID, handleMouseEnter);
        map.off("mouseleave", FLOW_LAYER_ID, handleMouseLeave);
        map.off("click", FLOW_LAYER_ID, handleClick);
      }
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
    };
  }, [map, flowPaths]);

  // Start animation loop
  useEffect(() => {
    if (!map) return;

    const animate = () => {
      const step = calculateVelocityStep();
      dashOffsetRef.current += step;
      if (dashOffsetRef.current > 9) {
        dashOffsetRef.current = 0;
      }

      if (map.isStyleLoaded() && map.getLayer(FLOW_ANIMATION_LAYER_ID)) {
        map.setPaintProperty(
          FLOW_ANIMATION_LAYER_ID,
          "line-dashoffset",
          dashOffsetRef.current
        );
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    // Start animation once layers are added
    if (map.isStyleLoaded() && map.getLayer(FLOW_ANIMATION_LAYER_ID)) {
      animationFrameRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [map, calculateVelocityStep]);

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
