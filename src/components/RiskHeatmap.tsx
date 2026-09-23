import type { FeatureCollection } from "geojson";
import { forwardRef, useImperativeHandle, useEffect, useCallback, useRef, useState } from "react";
import maplibregl, { Map as MLMap, GeoJSONSource, Popup } from "maplibre-gl";
import type { ExpressionSpecification } from "maplibre-gl";
import type { RiskZone } from "@/lib/simulation-types";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { DEPTH_RAMP, POND_HIT_PX, depthColor } from "@/lib/water-palette";

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
const HEAT_SOURCE_ID = "risk-zones-heat-source";
const HEAT_LAYER_ID = "risk-zones-heat-layer";
const HEAT_OPACITY = 0.9;


/** Ponding appears once the flow front has mostly crossed the study area. */
const FILL_DELAY_MS = 1500;
const FILL_DURATION_MS = 1400;

/** Used only when an engine reports a level but no modeled depth. */
const LEVEL_DEPTH_M: Record<RiskZone["level"], number> = {
  low: 0.05,
  moderate: 0.15,
  high: 0.4,
  severe: 1,
};

const LEVEL_LABEL: Record<RiskZone["level"], string> = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
  severe: "Severe",
};

// Density, not a single cell's depth, drives the color: neighbouring ponded
// cells merge into continuous water the way it actually spreads along a street.
const HEAT_COLOR: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["heatmap-density"],
  0,
  "rgba(155, 227, 240, 0)",
  0.04,
  "rgba(155, 227, 240, 0.18)",
  0.16,
  "rgba(125, 214, 236, 0.62)",
  0.34,
  DEPTH_RAMP[1][1],
  0.58,
  DEPTH_RAMP[2][1],
  0.82,
  DEPTH_RAMP[3][1],
  1,
  DEPTH_RAMP[4][1],
];

const HEAT_WEIGHT: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["get", "depth_m"],
  0,
  0.3,
  0.35,
  0.6,
  1,
  0.85,
  2.5,
  1,
];

/** Kernel radius tracking the true cell size at every zoom, so water stays put. */
function heatRadius(zones: RiskZone[]): ExpressionSpecification | number {
  const ring = zones[0]?.polygon;
  if (!ring || ring.length < 3) return 12;
  const lngs = ring.map((p) => p[0]);
  const lat = ring.reduce((sum, p) => sum + p[1], 0) / ring.length;
  const cos = Math.cos((lat * Math.PI) / 180);
  const cellM = (Math.max(...lngs) - Math.min(...lngs)) * 111_320 * cos;
  if (!(cellM > 0)) return 12;
  const px = (z: number) => (1.8 * cellM) / ((40_075_016.686 * cos) / (512 * 2 ** z));
  return ["interpolate", ["exponential", 2], ["zoom"], 10, px(10), 22, px(22)];
}

function riskZonesToPoints(zones: RiskZone[]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: zones.map((zone) => {
      const n = zone.polygon.length || 1;
      const lng = zone.polygon.reduce((sum, p) => sum + p[0], 0) / n;
      const lat = zone.polygon.reduce((sum, p) => sum + p[1], 0) / n;
      return {
        type: "Feature",
        properties: { depth_m: zone.flood_depth_m ?? LEVEL_DEPTH_M[zone.level] ?? 0.1 },
        geometry: { type: "Point", coordinates: [lng, lat] },
      };
    }),
  };
}

function riskZonesToGeoJSON(zones: RiskZone[]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: zones.map((zone) => ({
      type: "Feature",
      properties: {
        level: zone.level,
        affected_area_km2: zone.affected_area_km2,
        depth_m: zone.flood_depth_m ?? LEVEL_DEPTH_M[zone.level] ?? 0.1,
      },
      geometry: {
        type: "Polygon",
        coordinates: [[...zone.polygon, zone.polygon[0]]],
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
  const reduceMotion = usePrefersReducedMotion();
  const popupRef = useRef<Popup | null>(null);
  const fadeFrameRef = useRef<number | null>(null);
  const [attached, setAttached] = useState(0);

  const addLayers = useCallback(
    (zones: RiskZone[]) => {
      if (!map) return;
      const beforeId = safeGetLayer(map, "flow-paths-glow-layer") ? "flow-paths-glow-layer" : undefined;
      if (!safeGetSource(map, HEAT_SOURCE_ID)) {
        map.addSource(HEAT_SOURCE_ID, { type: "geojson", data: riskZonesToPoints(zones) });
      }
      if (!safeGetLayer(map, HEAT_LAYER_ID)) {
        map.addLayer(
          {
            id: HEAT_LAYER_ID,
            type: "heatmap",
            source: HEAT_SOURCE_ID,
            paint: {
              "heatmap-weight": HEAT_WEIGHT,
              "heatmap-intensity": 1.6,
              "heatmap-radius": heatRadius(zones),
              "heatmap-color": HEAT_COLOR,
              "heatmap-opacity": reduceMotion ? HEAT_OPACITY : 0,
              "heatmap-opacity-transition": reduceMotion
                ? { duration: 0, delay: 0 }
                : { duration: FILL_DURATION_MS, delay: FILL_DELAY_MS },
            },
          },
          beforeId
        );
      }
      // Invisible cells above the water keep every modeled cell inspectable.
      if (!safeGetLayer(map, RISK_LAYER_ID)) {
        map.addLayer(
          {
            id: RISK_LAYER_ID,
            type: "fill",
            source: RISK_SOURCE_ID,
            paint: { "fill-color": "#9be3f0", "fill-opacity": 0 },
          },
          beforeId
        );
      }
      if (!reduceMotion) {
        if (fadeFrameRef.current) cancelAnimationFrame(fadeFrameRef.current);
        // The transition needs one committed frame at zero before it can run.
        fadeFrameRef.current = requestAnimationFrame(() => {
          fadeFrameRef.current = requestAnimationFrame(() => {
            try {
              if (safeGetLayer(map, HEAT_LAYER_ID)) map.setPaintProperty(HEAT_LAYER_ID, "heatmap-opacity", HEAT_OPACITY);
            } catch {
              // Ignore if the style was replaced mid-fade
            }
          });
        });
      }
    },
    [map, reduceMotion]
  );

  const addToMap = useCallback(() => {
    if (!map || !safeHasStyle(map)) return;
    if (safeGetLayer(map, RISK_LAYER_ID) || safeGetLayer(map, HEAT_LAYER_ID)) return;

    if (!safeGetSource(map, RISK_SOURCE_ID)) {
      map.addSource(RISK_SOURCE_ID, {
        type: "geojson",
        data: riskZonesToGeoJSON(riskZones),
      });
    }
    addLayers(riskZones);
  }, [map, riskZones, addLayers]);

  const removeFromMap = useCallback(() => {
    if (fadeFrameRef.current) {
      cancelAnimationFrame(fadeFrameRef.current);
      fadeFrameRef.current = null;
    }
    if (popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }

    if (!map) return;
    safeRemoveLayer(map, RISK_OUTLINE_LAYER_ID);
    safeRemoveLayer(map, RISK_LAYER_ID);
    safeRemoveLayer(map, HEAT_LAYER_ID);
    safeRemoveSource(map, RISK_SOURCE_ID);
    safeRemoveSource(map, HEAT_SOURCE_ID);
  }, [map]);

  const updateZones = useCallback(
    (zones: RiskZone[]) => {
      if (!map || !safeHasStyle(map)) return;

      const source = safeGetSource(map, RISK_SOURCE_ID) as GeoJSONSource | undefined;
      if (source) {
        source.setData(riskZonesToGeoJSON(zones));
        (safeGetSource(map, HEAT_SOURCE_ID) as GeoJSONSource | undefined)?.setData(riskZonesToPoints(zones));
        if (safeGetLayer(map, HEAT_LAYER_ID)) map.setPaintProperty(HEAT_LAYER_ID, "heatmap-radius", heatRadius(zones));
      } else {
        map.addSource(RISK_SOURCE_ID, {
          type: "geojson",
          data: riskZonesToGeoJSON(zones),
        });
        addLayers(zones);
      }
    },
    [map, addLayers]
  );

  useEffect(() => {
    if (!map || !safeHasStyle(map)) return;

    // Pools render softer and wider than their cells, so a click anywhere on
    // the water resolves to the nearest modeled cell within a few pixels.
    const nearestCell = (point: maplibregl.Point) => {
      if (!safeGetLayer(map, RISK_LAYER_ID)) return null;
      const r = POND_HIT_PX;
      const hits = map.queryRenderedFeatures(
        [
          [point.x - r, point.y - r],
          [point.x + r, point.y + r],
        ],
        { layers: [RISK_LAYER_ID] }
      );
      let best: { feature: maplibregl.MapGeoJSONFeature; center: [number, number]; d: number } | null = null;
      for (const feature of hits) {
        if (feature.geometry.type !== "Polygon") continue;
        const ring = feature.geometry.coordinates[0].slice(0, -1);
        const center: [number, number] = [
          ring.reduce((sum, p) => sum + p[0], 0) / ring.length,
          ring.reduce((sum, p) => sum + p[1], 0) / ring.length,
        ];
        const px = map.project(center);
        const d = Math.hypot(px.x - point.x, px.y - point.y);
        if (!best || d < best.d) best = { feature, center, d };
      }
      return best;
    };

    const handleMove = (e: maplibregl.MapMouseEvent) => {
      try {
        const over = Boolean(nearestCell(e.point));
        const canvas = map.getCanvas();
        if (over) canvas.style.cursor = "pointer";
        else if (canvas.style.cursor === "pointer" && !map.queryRenderedFeatures(e.point, { layers: ["flow-paths-layer"].filter((id) => safeGetLayer(map, id)) }).length) canvas.style.cursor = "";
      } catch {
        // Ignore cursor updates if canvas is unavailable
      }
    };

    const handleClick = (e: maplibregl.MapMouseEvent) => {
      const hit = nearestCell(e.point);
      if (!hit) return;
      const props = hit.feature.properties || {};
      const level = (props.level as RiskZone["level"]) || "moderate";
      const areaM2 = Number(props.affected_area_km2 || 0) * 1e6;
      const depth = Number(props.depth_m || 0);
      // The engine caps standing depth at 4 m; a capped cell is "at least" that.
      const depthText =
        depth >= 4 ? "4 m or more" : depth >= 1 ? `${depth.toFixed(2)} m` : `${Math.round(depth * 100)} cm`;

      const html = `
        <div class="atlas-popup">
          <div class="atlas-popup-title"><span class="atlas-popup-swatch" style="background:${depthColor(depth)}"></span>Ponding cell</div>
          <dl>
            <div><dt>Modeled depth</dt><dd>${depthText}</dd></div>
            <div><dt>Cell area</dt><dd>${Math.round(areaM2).toLocaleString()} m²</dd></div>
            <div><dt>Accumulation</dt><dd>${LEVEL_LABEL[level] ?? "Moderate"}</dd></div>
          </dl>
          <p>Water gathered here from every cell that drains into it. No sewer capacity is modeled.</p>
        </div>
      `;

      if (popupRef.current) popupRef.current.remove();
      popupRef.current = new maplibregl.Popup({ closeButton: true, className: "atlas-map-popup", maxWidth: "260px" })
        .setLngLat(hit.center)
        .setHTML(html)
        .addTo(map);
    };

    if (safeGetLayer(map, RISK_LAYER_ID)) {
      map.on("mousemove", handleMove);
      map.on("click", handleClick);
    }

    return () => {
      map.off("mousemove", handleMove);
      map.off("click", handleClick);
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
    };
  }, [map, riskZones, attached]);

  useEffect(() => {
    if (!map) return;
    if (riskZones.length === 0) {
      removeFromMap();
      return;
    }
    let cancelled = false;
    const attach = () => {
      if (cancelled) return;
      try {
        addToMap();
        updateZones(riskZones);
      } catch {
        // Style not ready yet
      }
      if (!safeGetLayer(map, RISK_LAYER_ID)) {
        map.once("idle", attach);
        return;
      }
      setAttached((n) => n + 1);
    };
    attach();
    return () => {
      cancelled = true;
      map.off("idle", attach);
    };
  }, [riskZones, map, addToMap, updateZones, removeFromMap]);

  useEffect(() => removeFromMap, [removeFromMap]);

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

