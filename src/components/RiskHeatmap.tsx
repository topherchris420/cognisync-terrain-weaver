import { forwardRef, useImperativeHandle, useEffect, useCallback } from "react";
import maplibregl, { Map as MLMap, GeoJSONSource } from "maplibre-gl";
import type { RiskZone } from "@/lib/simulation-types";

interface RiskHeatmapProps {
  riskZones?: RiskZone[];
  map?: MLMap | null;
}

export interface RiskHeatmapHandle {
  addToMap: () => void;
  removeFromMap: () => void;
  updateZones: (zones: RiskZone[]) => void;
}

const RISK_SOURCE_ID = "risk-zones-source";
const RISK_LAYER_ID = "risk-zones-layer";

// Color mapping for risk levels
const RISK_COLORS: Record<string, string> = {
  low: "#22c55e",
  moderate: "#eab308",
  high: "#f97316",
  severe: "#ef4444",
};

// Opacity mapping for risk levels
const RISK_OPACITIES: Record<string, number> = {
  low: 0.4,
  moderate: 0.4,
  high: 0.4,
  severe: 0.5,
};

function riskZonesToGeoJSON(zones: RiskZone[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: zones.map((zone) => ({
      type: "Feature",
      properties: {
        level: zone.level,
        affected_area_km2: zone.affected_area_km2,
      },
      geometry: {
        type: "Polygon",
        coordinates: [[...zone.polygon, zone.polygon[0]]], // Close the polygon
      },
    })),
  };
}

export const RiskHeatmap = forwardRef<RiskHeatmapHandle, RiskHeatmapProps>(function RiskHeatmap(
  { riskZones = [], map },
  ref
) {
  const addToMap = useCallback(() => {
    if (!map) return;

    // Check if layers already exist
    if (map.getLayer(RISK_LAYER_ID)) return;

    // Add GeoJSON source
    map.addSource(RISK_SOURCE_ID, {
      type: "geojson",
      data: riskZonesToGeoJSON(riskZones),
    });

    // Add fill layer with color based on risk level
    map.addLayer({
      id: RISK_LAYER_ID,
      type: "fill",
      source: RISK_SOURCE_ID,
      paint: {
        "fill-color": [
          "match",
          ["get", "level"],
          "low",
          RISK_COLORS.low,
          "moderate",
          RISK_COLORS.moderate,
          "high",
          RISK_COLORS.high,
          "severe",
          RISK_COLORS.severe,
          "#999999", // Default fallback color
        ],
        "fill-opacity": [
          "match",
          ["get", "level"],
          "low",
          RISK_OPACITIES.low,
          "moderate",
          RISK_OPACITIES.moderate,
          "high",
          RISK_OPACITIES.high,
          "severe",
          RISK_OPACITIES.severe,
          0.4, // Default fallback opacity
        ],
      },
    });
  }, [map, riskZones]);

  const removeFromMap = useCallback(() => {
    if (!map) return;

    // Remove layer
    if (map.getLayer(RISK_LAYER_ID)) {
      map.removeLayer(RISK_LAYER_ID);
    }

    // Remove source
    if (map.getSource(RISK_SOURCE_ID)) {
      map.removeSource(RISK_SOURCE_ID);
    }
  }, [map]);

  const updateZones = useCallback(
    (zones: RiskZone[]) => {
      if (!map) return;

      const source = map.getSource(RISK_SOURCE_ID) as GeoJSONSource;
      if (source) {
        source.setData(riskZonesToGeoJSON(zones));
      } else {
        // Source doesn't exist yet, add it
        map.addSource(RISK_SOURCE_ID, {
          type: "geojson",
          data: riskZonesToGeoJSON(zones),
        });

        // Add layer if it doesn't exist
        if (!map.getLayer(RISK_LAYER_ID)) {
          map.addLayer({
            id: RISK_LAYER_ID,
            type: "fill",
            source: RISK_SOURCE_ID,
            paint: {
              "fill-color": [
                "match",
                ["get", "level"],
                "low",
                RISK_COLORS.low,
                "moderate",
                RISK_COLORS.moderate,
                "high",
                RISK_COLORS.high,
                "severe",
                RISK_COLORS.severe,
                "#999999",
              ],
              "fill-opacity": [
                "match",
                ["get", "level"],
                "low",
                RISK_OPACITIES.low,
                "moderate",
                RISK_OPACITIES.moderate,
                "high",
                RISK_OPACITIES.high,
                "severe",
                RISK_OPACITIES.severe,
                0.4,
              ],
            },
          });
        }
      }
    },
    [map]
  );

  // Auto-add to map when riskZones are provided
  useEffect(() => {
    if (riskZones.length > 0 && map) {
      addToMap();
      updateZones(riskZones);
    }
  }, [riskZones, map, addToMap, updateZones]);

  useImperativeHandle(
    ref,
    () => ({
      addToMap,
      removeFromMap,
      updateZones,
    }),
    [addToMap, removeFromMap, updateZones]
  );

  return null;
});