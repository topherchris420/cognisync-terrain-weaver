import type { FeatureCollection } from "geojson";
import { forwardRef, useImperativeHandle, useEffect, useCallback, useRef } from "react";
import maplibregl, { Map as MLMap, GeoJSONSource, Popup } from "maplibre-gl";
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
const RISK_OUTLINE_LAYER_ID = "risk-zones-outline-layer";

// Color mapping for risk levels
const RISK_COLORS: Record<string, string> = {
  low: "#22c55e",
  moderate: "#eab308",
  high: "#f97316",
  severe: "#ef4444",
};

// Base opacity mapping for risk levels
const RISK_OPACITIES: Record<string, number> = {
  low: 0.35,
  moderate: 0.45,
  high: 0.55,
  severe: 0.65,
};

function riskZonesToGeoJSON(zones: RiskZone[]): FeatureCollection {
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

export const RiskHeatmap = forwardRef<RiskHeatmapHandle, RiskHeatmapProps>(function RiskHeatmap(
  { riskZones = [], map },
  ref
) {
  const animFrameRef = useRef<number | null>(null);
  const pulsePhaseRef = useRef(0);
  const popupRef = useRef<Popup | null>(null);

  const addToMap = useCallback(() => {
    if (!map || !safeHasStyle(map)) return;

    if (!map.isStyleLoaded()) return;

    // StrictMode and rapid state changes can invoke this more than once.
    // Reuse an existing source instead of attempting to register it again.
    if (safeGetLayer(map, RISK_LAYER_ID) || safeGetLayer(map, RISK_OUTLINE_LAYER_ID)) return;

    if (!safeGetSource(map, RISK_SOURCE_ID)) {
      map.addSource(RISK_SOURCE_ID, {
        type: "geojson",
        data: riskZonesToGeoJSON(riskZones),
      });
    }

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

    // Add outline casing layer
    map.addLayer({
      id: RISK_OUTLINE_LAYER_ID,
      type: "line",
      source: RISK_SOURCE_ID,
      paint: {
        "line-color": [
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
          "#ffffff",
        ],
        "line-width": 2,
        "line-opacity": 0.85,
      },
    });
  }, [map, riskZones]);

  const removeFromMap = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    if (popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }

    if (!map) return;
    safeRemoveLayer(map, RISK_OUTLINE_LAYER_ID);
    safeRemoveLayer(map, RISK_LAYER_ID);
    safeRemoveSource(map, RISK_SOURCE_ID);
  }, [map]);

  const updateZones = useCallback(
    (zones: RiskZone[]) => {
      if (!map || !safeHasStyle(map)) return;

      const source = safeGetSource(map, RISK_SOURCE_ID) as GeoJSONSource | undefined;
      if (source) {
        source.setData(riskZonesToGeoJSON(zones));
      } else {
        // Source doesn't exist yet, add it
        map.addSource(RISK_SOURCE_ID, {
          type: "geojson",
          data: riskZonesToGeoJSON(zones),
        });

        if (!safeGetLayer(map, RISK_LAYER_ID)) {
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

        if (!safeGetLayer(map, RISK_OUTLINE_LAYER_ID)) {
          map.addLayer({
            id: RISK_OUTLINE_LAYER_ID,
            type: "line",
            source: RISK_SOURCE_ID,
            paint: {
              "line-color": [
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
                "#ffffff",
              ],
              "line-width": 2,
              "line-opacity": 0.85,
            },
          });
        }
      }
    },
    [map]
  );

  // Pulsing animation loop for hazard zones
  useEffect(() => {
    if (!map || !safeHasStyle(map)) return;

    const animatePulse = () => {
      pulsePhaseRef.current += 0.04;
      const pulseFactor = (Math.sin(pulsePhaseRef.current) + 1) / 2; // 0 to 1
      const severeOpacity = 0.5 + pulseFactor * 0.25;

      if (safeGetLayer(map, RISK_LAYER_ID)) {
        try {
          map.setPaintProperty(RISK_LAYER_ID, "fill-opacity", [
            "match",
            ["get", "level"],
            "low",
            RISK_OPACITIES.low,
            "moderate",
            RISK_OPACITIES.moderate,
            "high",
            RISK_OPACITIES.high,
            "severe",
            severeOpacity,
            0.4,
          ]);
        } catch {
          // Ignore if layer or map was destroyed
        }
      }

      animFrameRef.current = requestAnimationFrame(animatePulse);
    };

    if (riskZones.length > 0 && safeGetLayer(map, RISK_LAYER_ID)) {
      animFrameRef.current = requestAnimationFrame(animatePulse);
    }

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [map, riskZones]);

  // Handle click popup inspection on risk zones
  useEffect(() => {
    if (!map || !safeHasStyle(map)) return;

    const handleMouseEnter = () => {
      try {
        map.getCanvas().style.cursor = "pointer";
      } catch {
        // Ignore cursor updates if canvas is unavailable
      }
    };

    const handleMouseLeave = () => {
      try {
        map.getCanvas().style.cursor = "";
      } catch {
        // Ignore cursor updates if canvas is unavailable
      }
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
    };

    const handleClick = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
      if (!e.features || e.features.length === 0) return;
      const feat = e.features[0];
      const props = feat.properties || {};
      const level = String(props.level || "moderate").toUpperCase();
      const areaKm2 = Number(props.affected_area_km2 || 0);
      const areaHa = (areaKm2 * 100).toFixed(1);

      const color = RISK_COLORS[props.level] || "#f97316";

      const html = `
        <div class="p-2 text-xs font-mono bg-card text-foreground rounded shadow-md border border-border min-w-[200px]">
          <div class="font-bold border-b border-border pb-1 uppercase tracking-wider flex items-center justify-between" style="color: ${color}">
            <span>Inundation Zone</span>
            <span class="px-1.5 py-0.2 rounded text-[10px] bg-muted">${level}</span>
          </div>
          <div class="space-y-1 mt-1.5">
            <div class="flex justify-between">
              <span class="text-muted-foreground">Affected Footprint:</span>
              <span class="font-bold">${areaHa} ha (${areaKm2.toFixed(2)} km²)</span>
            </div>
            <div class="pt-1 text-[10px] text-muted-foreground border-t border-border/40 leading-tight">
              ${props.level === "severe" ? "Immediate action: Deploy pumps & clear storm drains." : "Monitor SCADA streamgages & sensor networks."}
            </div>
          </div>
        </div>
      `;

      if (popupRef.current) popupRef.current.remove();
      popupRef.current = new maplibregl.Popup({ closeButton: true })
        .setLngLat(e.lngLat)
        .setHTML(html)
        .addTo(map);
    };

    if (safeGetLayer(map, RISK_LAYER_ID)) {
      map.on("mouseenter", RISK_LAYER_ID, handleMouseEnter);
      map.on("mouseleave", RISK_LAYER_ID, handleMouseLeave);
      map.on("click", RISK_LAYER_ID, handleClick);
    }

    return () => {
      if (safeGetLayer(map, RISK_LAYER_ID)) {
        map.off("mouseenter", RISK_LAYER_ID, handleMouseEnter);
        map.off("mouseleave", RISK_LAYER_ID, handleMouseLeave);
        map.off("click", RISK_LAYER_ID, handleClick);
      }
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
    };
  }, [map, riskZones]);

  // Sync overlay with current zones
  useEffect(() => {
    if (!map) return;
    if (riskZones.length > 0) {
      addToMap();
      updateZones(riskZones);
    } else {
      removeFromMap();
    }
  }, [riskZones, map, addToMap, updateZones, removeFromMap]);

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
