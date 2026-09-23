import { forwardRef, useImperativeHandle, useEffect, useRef, useCallback, useState } from "react";
import maplibregl, { Map as MLMap, GeoJSONSource, Popup } from "maplibre-gl";
import type { ExpressionSpecification } from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import type { FlowPath } from "@/lib/simulation-types";
import { smoothFlowPoints } from "@/lib/simulation";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { FLOW_HEAD as HEAD, FLOW_MOUTH as MOUTH } from "@/lib/water-palette";

interface FlowLayerProps {
  flowPaths?: FlowPath[];
  map?: MLMap | null;
  /** Wider vectors when the map is pitched, so runoff stays readable on the mesh. */
  relief?: boolean;
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

/** Time for the first drop to travel from every source cell to its outlet. */
const REVEAL_MS = 2200;
/** The front is held back until the rain overlay has had a moment to land. */
const REVEAL_DELAY_MS = 450;

// Paths are ordered source → outlet, so line-progress is distance downhill.
// Water gathers as it goes: faint at the head, brightest where it collects.
const FRONT = "rgba(255, 255, 255, 1)";
const CLEAR = "rgba(118, 205, 228, 0)";
const GLOW_HEAD = "rgba(47, 170, 214, 0)";
const GLOW_MOUTH = "rgba(47, 170, 214, 0.55)";

function mix(a: string, b: string, t: number): string {
  const pa = a.match(/[\d.]+/g)!.map(Number);
  const pb = b.match(/[\d.]+/g)!.map(Number);
  const v = pa.map((x, i) => x + (pb[i] - x) * t);
  return `rgba(${Math.round(v[0])}, ${Math.round(v[1])}, ${Math.round(v[2])}, ${v[3].toFixed(3)})`;
}

/** A gradient drawn up to `progress`, with a bright wavefront at the leading edge. */
function revealGradient(progress: number, glow = false): ExpressionSpecification {
  const head = glow ? GLOW_HEAD : HEAD;
  const mouth = glow ? GLOW_MOUTH : MOUTH;
  if (progress >= 1) {
    return ["interpolate", ["linear"], ["line-progress"], 0, head, 1, mouth];
  }
  const p = Math.max(0.002, Math.min(0.996, progress));
  const behind = Math.max(0.001, p - 0.06);
  const stops: (number | string)[] = [0, head];
  if (behind > 0.001) stops.push(behind, mix(head, mouth, behind));
  stops.push(p, glow ? mouth : FRONT, Math.min(0.999, p + 0.002), CLEAR, 1, CLEAR);
  return ["interpolate", ["linear"], ["line-progress"], ...stops] as ExpressionSpecification;
}

// Cycling dash patterns is the supported way to move dashes along a MapLibre
// line; there is no animatable dash offset.
const DASH_SEQUENCE: number[][] = [
  [0, 4, 3],
  [0.5, 4, 2.5],
  [1, 4, 2],
  [1.5, 4, 1.5],
  [2, 4, 1],
  [2.5, 4, 0.5],
  [3, 4, 0],
  [0, 0.5, 3, 3.5],
  [0, 1, 3, 3],
  [0, 1.5, 3, 2.5],
  [0, 2, 3, 2],
  [0, 2.5, 3, 1.5],
  [0, 3, 3, 1],
  [0, 3.5, 3, 0.5],
];

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

function safePaint(map: MLMap, layerId: string, property: string, value: unknown) {
  if (!safeGetLayer(map, layerId)) return;
  try {
    map.setPaintProperty(layerId, property, value);
  } catch {
    // Layer may have been removed between the check and the write.
  }
}

const RELIEF_WIDTH = {
  glow: 14,
  base: 3.5,
  dash: 2.5,
} as const;

const FLAT_WIDTH = {
  glow: 10,
  base: 2.25,
  dash: 1.75,
} as const;

/** Heavier paths carry more water: scale width by accumulated volume. */
function volumeWidth(base: number): ExpressionSpecification {
  return [
    "interpolate",
    ["linear"],
    ["get", "volume_m3"],
    0,
    base * 0.6,
    400,
    base,
    2000,
    base * 1.6,
  ];
}

export const FlowLayer = forwardRef<FlowLayerHandle, FlowLayerProps>(function FlowLayer(
  { flowPaths = [], map, relief = false },
  ref
) {
  const reduceMotion = usePrefersReducedMotion();
  const animationFrameRef = useRef<number | null>(null);
  const revealStartRef = useRef<number>(0);
  const [attached, setAttached] = useState(0);
  const widths = relief ? RELIEF_WIDTH : FLAT_WIDTH;

  const addToMap = useCallback(() => {
    if (!map || !safeHasStyle(map)) return;

    // StrictMode and rapid state changes can invoke this more than once.
    // Reuse an existing source instead of attempting to register it again.
    if (safeGetLayer(map, FLOW_GLOW_LAYER_ID) || safeGetLayer(map, FLOW_LAYER_ID) || safeGetLayer(map, FLOW_ANIMATION_LAYER_ID)) return;

    if (!safeGetSource(map, FLOW_SOURCE_ID)) {
      map.addSource(FLOW_SOURCE_ID, {
        type: "geojson",
        lineMetrics: true,
        data: flowPathsToGeoJSON(flowPaths),
      });
    }

    const initial = reduceMotion ? 1 : 0;

    map.addLayer({
      id: FLOW_GLOW_LAYER_ID,
      type: "line",
      source: FLOW_SOURCE_ID,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-width": volumeWidth(widths.glow),
        "line-blur": 8,
        "line-gradient": revealGradient(initial, true),
      },
    });

    map.addLayer({
      id: FLOW_LAYER_ID,
      type: "line",
      source: FLOW_SOURCE_ID,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-width": volumeWidth(widths.base),
        "line-gradient": revealGradient(initial),
      },
    });

    map.addLayer({
      id: FLOW_ANIMATION_LAYER_ID,
      type: "line",
      source: FLOW_SOURCE_ID,
      layout: { "line-join": "round", "line-cap": "butt" },
      paint: {
        "line-color": "#f2fdff",
        "line-width": widths.dash,
        "line-dasharray": DASH_SEQUENCE[0],
        "line-opacity": reduceMotion ? 0.55 : 0,
        "line-opacity-transition": { duration: 900, delay: 0 },
      },
    });
  }, [map, flowPaths, reduceMotion, widths]);

  const removeFromMap = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (!map) return;

    safeRemoveLayer(map, FLOW_ANIMATION_LAYER_ID);
    safeRemoveLayer(map, FLOW_LAYER_ID);
    safeRemoveLayer(map, FLOW_GLOW_LAYER_ID);
    safeRemoveSource(map, FLOW_SOURCE_ID);
  }, [map]);

  const updatePaths = useCallback(
    (paths: FlowPath[]) => {
      if (!map || !safeHasStyle(map)) return;

      let source = safeGetSource(map, FLOW_SOURCE_ID) as GeoJSONSource | undefined;
      if (!source) {
        addToMap();
        source = safeGetSource(map, FLOW_SOURCE_ID) as GeoJSONSource | undefined;
      }
      if (source) {
        source.setData(flowPathsToGeoJSON(paths));
      }
    },
    [map, addToMap]
  );

  const popupRef = useRef<Popup | null>(null);

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
    };

    const handleClick = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
      if (!e.features || e.features.length === 0) return;
      const feat = e.features[0];
      const props = feat.properties || {};
      const vol = Number(props.volume_m3 || 0);
      const vel = Number(props.velocity_mps || 0);

      const character = vel > 4 ? "Fast, concentrated flow" : vel > 2 ? "Channelled flow" : "Sheet runoff";

      const html = `
        <div class="atlas-popup">
          <div class="atlas-popup-title"><span class="atlas-popup-swatch atlas-popup-swatch--flow"></span>Flow path</div>
          <dl>
            <div><dt>Water carried</dt><dd>${Math.round(vol).toLocaleString()} m³</dd></div>
            <div><dt>Velocity</dt><dd>${vel.toFixed(1)} m/s</dd></div>
          </dl>
          <p>${character}, routed downhill cell to cell (D8).</p>
        </div>
      `;

      if (popupRef.current) popupRef.current.remove();
      popupRef.current = new maplibregl.Popup({ closeButton: true, className: "atlas-map-popup", maxWidth: "260px" })
        .setLngLat(e.lngLat)
        .setHTML(html)
        .addTo(map);
    };

    if (safeGetLayer(map, FLOW_LAYER_ID)) {
      map.on("mouseenter", FLOW_LAYER_ID, handleMouseEnter);
      map.on("mouseleave", FLOW_LAYER_ID, handleMouseLeave);
      map.on("click", FLOW_LAYER_ID, handleClick);
    }

    return () => {
      if (safeGetLayer(map, FLOW_LAYER_ID)) {
        map.off("mouseenter", FLOW_LAYER_ID, handleMouseEnter);
        map.off("mouseleave", FLOW_LAYER_ID, handleMouseLeave);
        map.off("click", FLOW_LAYER_ID, handleClick);
      }
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
    };
  }, [map, flowPaths, attached]);

  // Sync overlay with the current paths, and restart the downhill reveal for
  // every new set of paths so each storm is seen travelling the terrain.
  // Layers can only be added once the style is ready; while tiles are still
  // streaming in after a camera move, wait for the map to go idle and retry.
  useEffect(() => {
    if (!map) return;
    if (flowPaths.length === 0) {
      removeFromMap();
      return;
    }
    let cancelled = false;
    const attach = () => {
      if (cancelled) return;
      try {
        addToMap();
        updatePaths(flowPaths);
      } catch {
        // Style not ready yet
      }
      if (!safeGetLayer(map, FLOW_LAYER_ID)) {
        map.once("idle", attach);
        return;
      }
      revealStartRef.current = performance.now() + REVEAL_DELAY_MS;
      setAttached((n) => n + 1);
    };
    attach();
    return () => {
      cancelled = true;
      map.off("idle", attach);
    };
  }, [flowPaths, map, addToMap, updatePaths, removeFromMap]);

  useEffect(() => {
    if (!map || !safeHasStyle(map) || flowPaths.length === 0) return;

    if (reduceMotion) {
      safePaint(map, FLOW_LAYER_ID, "line-gradient", revealGradient(1));
      safePaint(map, FLOW_GLOW_LAYER_ID, "line-gradient", revealGradient(1, true));
      safePaint(map, FLOW_ANIMATION_LAYER_ID, "line-opacity", 0.55);
      return;
    }

    const avgVelocity =
      flowPaths.reduce((sum, p) => sum + (p.velocity_mps || 1.5), 0) / flowPaths.length;
    // Faster modeled water moves the particles faster, within a readable band.
    const msPerStep = Math.max(38, Math.min(110, 110 - avgVelocity * 14));

    let revealed = false;
    let dashStep = -1;

    const animate = (now: number) => {
      if (!safeGetLayer(map, FLOW_LAYER_ID)) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }
      if (!revealed) {
        const elapsed = now - revealStartRef.current;
        const t = Math.max(0, Math.min(1, elapsed / REVEAL_MS));
        // Water accelerates off the high ground, then settles as it pools.
        const eased = 1 - Math.pow(1 - t, 2.2);
        safePaint(map, FLOW_LAYER_ID, "line-gradient", revealGradient(eased));
        safePaint(map, FLOW_GLOW_LAYER_ID, "line-gradient", revealGradient(eased, true));
        if (t >= 1) {
          revealed = true;
          safePaint(map, FLOW_ANIMATION_LAYER_ID, "line-opacity", 0.7);
        }
      } else {
        const step = Math.floor(now / msPerStep) % DASH_SEQUENCE.length;
        if (step !== dashStep) {
          dashStep = step;
          safePaint(map, FLOW_ANIMATION_LAYER_ID, "line-dasharray", DASH_SEQUENCE[step]);
        }
      }
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [map, flowPaths, reduceMotion, attached]);

  useEffect(() => removeFromMap, [removeFromMap]);

  useEffect(() => {
    if (!map || !safeHasStyle(map)) return;
    safePaint(map, FLOW_GLOW_LAYER_ID, "line-width", volumeWidth(widths.glow));
    safePaint(map, FLOW_LAYER_ID, "line-width", volumeWidth(widths.base));
    safePaint(map, FLOW_ANIMATION_LAYER_ID, "line-width", widths.dash);
  }, [map, widths, flowPaths]);

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
