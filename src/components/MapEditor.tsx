import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import { area, bboxPolygon, difference, feature, featureCollection, intersect } from "@turf/turf";
import type {
  GeoJSONSource,
  IControl,
  Map as MapLibreMap,
  StyleImageInterface,
} from "maplibre-gl";
import { ABSORPTION_WEIGHTS } from "@/lib/absorption";
import { parseBBox } from "@/lib/geo";
import {
  INTERVENTIONS,
  INTERVENTION_COLORS,
  type InterventionKey,
  type Scenario,
} from "@/lib/scenario";
import type { SpatialContextResult } from "@/lib/spatial-data/types";
import type { LandCover } from "@/lib/types";
import { evaluateEligibility } from "@/lib/counterfactual/eligibility";
import { stableHash } from "@/lib/counterfactual/hashing";
import { deriveScenarioFromFeatures } from "@/lib/counterfactual/projected-metrics";
import { setMapDrawing } from "@/lib/map-drawing";
import type {
  EligibilityResult,
  InterventionFeature,
  InterventionParameters,
  InterventionType,
} from "@/lib/counterfactual/types";

type SimBBox = { north: number; south: number; east: number; west: number };
type PolygonGeometry = GeoJSON.Polygon | GeoJSON.MultiPolygon;

const INVALID_SOURCE_ID = "mannahatta-editor-invalid-source";
const INVALID_FILL_ID = "mannahatta-editor-invalid-fill";
const INVALID_OUTLINE_ID = "mannahatta-editor-invalid-outline";
const INVALID_PATTERN_ID = "mannahatta-editor-invalid-hatch";
/** Draw's own source for settled features; present once Draw has attached. */
const DRAW_COLD_SOURCE_ID = "mapbox-gl-draw-cold";

/** A shape still being drawn has no intervention yet; it takes the UI accent. */
const DRAFT_COLOR = "#d6e8a4";
const interventionColor: unknown[] = [
  "match",
  ["get", "user_interventionType"],
  ...Object.entries(INTERVENTION_COLORS).flat(),
  DRAFT_COLOR,
];
const isActive: unknown[] = ["==", ["get", "active"], "true"];
const polygonFilter = ["all", ["==", "$type", "Polygon"]];

/**
 * Draw's default theme drives line-dasharray from data, which MapLibre
 * rejects, so drawn shapes lost their outline and kept only a 10% fill.
 * These layers are MapLibre-safe and colour each shape by what it is.
 */
const DRAW_STYLES = [
  {
    id: "gl-draw-polygon-fill",
    type: "fill",
    filter: polygonFilter,
    paint: {
      "fill-color": interventionColor,
      "fill-opacity": ["case", isActive, 0.22, 0.34],
    },
  },
  {
    id: "gl-draw-polygon-halo",
    type: "line",
    filter: polygonFilter,
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#08120f", "line-width": 5, "line-opacity": 0.45 },
  },
  {
    id: "gl-draw-polygon-stroke",
    type: "line",
    filter: ["all", ["==", "$type", "Polygon"], ["!=", "active", "true"]],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": interventionColor, "line-width": 2.25 },
  },
  {
    id: "gl-draw-polygon-stroke-active",
    type: "line",
    filter: ["all", ["any", ["==", "$type", "Polygon"], ["==", "$type", "LineString"]], ["==", "active", "true"]],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": interventionColor, "line-width": 2.25, "line-dasharray": [1.5, 1.25] },
  },
  {
    id: "gl-draw-vertex-halo",
    type: "circle",
    filter: ["all", ["==", "$type", "Point"], ["==", "meta", "vertex"], ["!=", "mode", "simple_select"]],
    paint: { "circle-radius": ["case", isActive, 7, 5.5], "circle-color": "#08120f", "circle-opacity": 0.6 },
  },
  {
    id: "gl-draw-vertex",
    type: "circle",
    filter: ["all", ["==", "$type", "Point"], ["==", "meta", "vertex"], ["!=", "mode", "simple_select"]],
    paint: { "circle-radius": ["case", isActive, 5, 3.75], "circle-color": "#ffffff" },
  },
  {
    id: "gl-draw-midpoint",
    type: "circle",
    filter: ["all", ["==", "$type", "Point"], ["==", "meta", "midpoint"]],
    paint: { "circle-radius": 3, "circle-color": DRAFT_COLOR, "circle-opacity": 0.85 },
  },
];

export interface MapEditorHandle {
  undo: () => void;
  clear: () => void;
  /** Discard the shape in progress; leaving the tool otherwise keeps it. */
  cancelDraft: () => void;
}

export interface MapEditorProps {
  map: MapLibreMap | null;
  bbox: SimBBox | unknown | null;
  context?: SpatialContextResult | null;
  activeIntervention: InterventionType | null;
  features?: InterventionFeature[];
  onChange?: (features: InterventionFeature[]) => void;
  onDraftFeedback?: (feedback: EligibilityResult | null) => void;
  /** Temporary compatibility path until Analyze mounts canonical features. */
  cover?: LandCover;
  /** Temporary compatibility path; scenario fractions are derived output. */
  onScenarioChange?: (scenario: Scenario) => void;
}

interface DrawEvent {
  features: Array<
    GeoJSON.Feature<PolygonGeometry, Record<string, unknown>>
  >;
}

function isPolygonGeometry(
  geometry: GeoJSON.Geometry | null
): geometry is PolygonGeometry {
  return (
    geometry?.type === "Polygon" || geometry?.type === "MultiPolygon"
  );
}

function parametersFor(type: InterventionType): InterventionParameters {
  if (type === "wetland") {
    return {
      retentionFractionDelta: 0,
      storageDeltaMm: 0,
      roughnessDelta: 0,
      calibrationProvenance: [],
    };
  }
  const definition = INTERVENTIONS[type as InterventionKey];
  return {
    retentionFractionDelta: Math.min(
      1,
      Math.max(
        0,
        definition.targetWeight -
          ABSORPTION_WEIGHTS[definition.source]
      )
    ),
    storageDeltaMm: 0,
    roughnessDelta: 0,
    calibrationProvenance: [],
  };
}

function featureId(
  draft: GeoJSON.Feature<PolygonGeometry, Record<string, unknown>>
): string {
  if (draft.id !== undefined) return String(draft.id);
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return stableHash({ geometry: draft.geometry, properties: draft.properties });
}

function interventionFromDraft(
  draft: GeoJSON.Feature<PolygonGeometry, Record<string, unknown>>,
  type: InterventionType,
  context: SpatialContextResult | null,
  bounds: unknown
): InterventionFeature {
  const eligibility = evaluateEligibility(draft.geometry, type, context);
  const extent = normalizedBbox(bounds);
  // One canonical clipped geometry drives both costs and grid modifiers.
  if (eligibility.validGeometry) {
    try {
      const clipped = extent ? intersect(featureCollection([
        feature(eligibility.validGeometry),
        bboxPolygon([extent.west, extent.south, extent.east, extent.north]),
      ])) : null;
      const invalid = clipped
        ? difference(featureCollection([feature(draft.geometry), clipped]))
        : feature(draft.geometry);
      eligibility.validGeometry = clipped?.geometry ?? null;
      eligibility.invalidGeometry = invalid?.geometry ?? null;
      eligibility.validAreaM2 = clipped ? area(clipped) : 0;
      eligibility.invalidAreaM2 = invalid ? area(invalid) : 0;
      eligibility.eligible = eligibility.validAreaM2 > 0;
      if (eligibility.invalidAreaM2 > 0.01) {
        eligibility.reasonCodes.push(eligibility.eligible ? "PARTIALLY_OUTSIDE_ELIGIBLE_SURFACE" : "OUTSIDE_ELIGIBLE_SURFACE");
        eligibility.caveats.push("Only geometry inside the analyzed study footprint is modeled.");
      }
    } catch {
      eligibility.eligible = false;
      eligibility.validGeometry = null;
      eligibility.validAreaM2 = 0;
      eligibility.invalidGeometry = draft.geometry;
      eligibility.caveats.push("The drawing could not be clipped to the study footprint.");
    }
  }
  return {
    id: featureId(draft),
    type,
    geometry: draft.geometry,
    areaM2: eligibility.validAreaM2,
    parameters: parametersFor(type),
    eligibility,
    provenance: eligibility.provenance,
  };
}

function drawFeature(candidate: InterventionFeature): GeoJSON.Feature {
  return {
    type: "Feature",
    id: candidate.id,
    geometry: candidate.geometry,
    properties: { interventionType: candidate.type },
  };
}

function normalizedBbox(value: unknown): SimBBox | null {
  if (
    value &&
    typeof value === "object" &&
    ["north", "south", "east", "west"].every(
      (key) => typeof (value as Record<string, unknown>)[key] === "number"
    )
  ) {
    return value as SimBBox;
  }
  const parsed = parseBBox(value);
  if (!parsed) return null;
  return {
    west: parsed[0][0],
    south: parsed[0][1],
    east: parsed[1][0],
    north: parsed[1][1],
  };
}

function siteAreaM2(value: unknown): number {
  const bbox = normalizedBbox(value);
  return bbox
    ? area(bboxPolygon([bbox.west, bbox.south, bbox.east, bbox.north]))
    : 0;
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

function invalidCollection(
  features: InterventionFeature[]
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: features.flatMap((candidate) =>
      candidate.eligibility.invalidGeometry
        ? [{
            type: "Feature" as const,
            id: `${candidate.id}:invalid`,
            geometry: candidate.eligibility.invalidGeometry,
            properties: {
              interventionType: candidate.type,
              reasonCodes: candidate.eligibility.reasonCodes.join(","),
            },
          }]
        : []
    ),
  };
}

function hatchImage(): StyleImageInterface {
  const width = 8;
  const height = 8;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if ((x + y) % 6 > 1) continue;
      const offset = (y * width + x) * 4;
      data[offset] = 220;
      data[offset + 1] = 38;
      data[offset + 2] = 38;
      data[offset + 3] = 210;
    }
  }
  return { width, height, data };
}

export const MapEditor = forwardRef<MapEditorHandle, MapEditorProps>(
  function MapEditor(
    {
      map,
      bbox,
      context = null,
      activeIntervention,
      features: controlledFeatures,
      onChange,
      onDraftFeedback,
      cover,
      onScenarioChange,
    },
    ref
  ) {
    const controlled = controlledFeatures !== undefined;
    const [legacyFeatures, setLegacyFeatures] = useState<
      InterventionFeature[]
    >([]);
    const features = controlled ? controlledFeatures : legacyFeatures;
    const drawRef = useRef<MapboxDraw | null>(null);
    const syncingRef = useRef(false);
    const historyRef = useRef<InterventionFeature[][]>([]);
    const featuresRef = useRef(features);
    const activeRef = useRef(activeIntervention);
    /** The tool the current draft was started with; outlives a "Done" click. */
    const draftTypeRef = useRef<InterventionType | null>(null);
    /** A shape just closed while its tool is still armed: start the next one. */
    const rearmRef = useRef(false);
    const contextRef = useRef(context);
    const controlledRef = useRef(controlled);
    const onChangeRef = useRef(onChange);
    const onFeedbackRef = useRef(onDraftFeedback);
    const legacyProjectionRef = useRef({
      cover,
      bbox,
      onScenarioChange,
    });

    featuresRef.current = features;
    activeRef.current = activeIntervention;
    contextRef.current = context;
    controlledRef.current = controlled;
    onChangeRef.current = onChange;
    onFeedbackRef.current = onDraftFeedback;
    legacyProjectionRef.current = { cover, bbox, onScenarioChange };

    const commit = useCallback(
      (next: InterventionFeature[], remember = true) => {
        if (remember) {
          historyRef.current.push(featuresRef.current);
          if (historyRef.current.length > 50) historyRef.current.shift();
        }
        featuresRef.current = next;
        if (controlledRef.current) {
          onChangeRef.current?.(next);
        } else {
          setLegacyFeatures(next);
        }

        const legacy = legacyProjectionRef.current;
        if (legacy.cover && legacy.onScenarioChange) {
          legacy.onScenarioChange(
            deriveScenarioFromFeatures(
              next,
              legacy.cover,
              siteAreaM2(legacy.bbox)
            )
          );
        }
      },
      []
    );

    useImperativeHandle(
      ref,
      () => ({
        undo() {
          const previous = historyRef.current.pop();
          if (previous) commit(previous, false);
        },
        cancelDraft() {
          const draw = drawRef.current;
          if (!draw || draftTypeRef.current === null) return;
          draftTypeRef.current = null;
          try {
            draw.trash();
          } catch {
            // Nothing in progress to discard
          }
        },
        clear() {
          if (featuresRef.current.length === 0) return;
          commit([]);
          onFeedbackRef.current?.(null);
        },
      }),
      [commit]
    );

    useEffect(() => {
      if (!map) return;
      const draw = new MapboxDraw({
        displayControlsDefault: false,
        controls: {},
        userProperties: true,
        styles: DRAW_STYLES as object[],
        // Closing a shape means clicking its first point; Draw's 2 px default
        // makes that a pixel hunt, so the shape kept growing instead.
        clickBuffer: 10,
        touchBuffer: 24,
      });

      // Draw attaches its sources and layers only once map.loaded() is true.
      // A routed storm's flow animation restyles the map every frame, so
      // loaded() never settles and every drawing would silently vanish. A
      // loaded style is all Draw needs, so answer for that until it attaches.
      const loadable = map as unknown as { loaded?: () => boolean };
      const shimLoaded = !Object.prototype.hasOwnProperty.call(map, "loaded");
      if (shimLoaded) {
        loadable.loaded = () =>
          safeHasStyle(map) &&
          (typeof map.isStyleLoaded !== "function" || map.isStyleLoaded() !== false);
      }
      let attachPoll: number | undefined;
      const releaseLoaded = () => {
        if (attachPoll !== undefined) window.clearInterval(attachPoll);
        attachPoll = undefined;
        if (shimLoaded) delete loadable.loaded;
      };

      try {
        map.addControl(draw as unknown as IControl, "top-left");
      } catch (error) {
        releaseLoaded();
        console.warn("Failed to add MapboxDraw control", error);
        return;
      }
      if (safeGetSource(map, DRAW_COLD_SOURCE_ID)) releaseLoaded();
      else {
        attachPoll = window.setInterval(() => {
          if (safeGetSource(map, DRAW_COLD_SOURCE_ID)) releaseLoaded();
        }, 50);
      }
      drawRef.current = draw;

      const create = (event: DrawEvent) => {
        if (syncingRef.current) return;
        const type = activeRef.current ?? draftTypeRef.current;
        if (!type) {
          draw.delete(
            event.features
              .filter((draft) => draft.id !== undefined)
              .map((draft) => String(draft.id))
          );
          onFeedbackRef.current?.(null);
          return;
        }
        const created = event.features
          .filter((draft) => isPolygonGeometry(draft.geometry))
          .map((draft) =>
            interventionFromDraft(draft, type, contextRef.current, legacyProjectionRef.current.bbox)
          );
        if (created.length === 0) return;
        onFeedbackRef.current?.(created.at(-1)!.eligibility);
        rearmRef.current = activeRef.current !== null;
        commit([...featuresRef.current, ...created]);
      };

      const update = (event: DrawEvent) => {
        if (syncingRef.current) return;
        const next = [...featuresRef.current];
        let feedback: EligibilityResult | null = null;
        for (const draft of event.features) {
          if (!isPolygonGeometry(draft.geometry)) continue;
          const id = featureId(draft);
          const index = next.findIndex((candidate) => candidate.id === id);
          const type =
            index >= 0 ? next[index].type : activeRef.current;
          if (!type) continue;
          const updated = interventionFromDraft(
            { ...draft, id },
            type,
            contextRef.current,
            legacyProjectionRef.current.bbox
          );
          feedback = updated.eligibility;
          if (index >= 0) next[index] = updated;
          else next.push(updated);
        }
        if (feedback) onFeedbackRef.current?.(feedback);
        commit(next);
      };

      const remove = (event: DrawEvent) => {
        if (syncingRef.current) return;
        const removed = new Set(
          event.features
            .filter((draft) => draft.id !== undefined)
            .map((draft) => String(draft.id))
        );
        commit(
          featuresRef.current.filter(
            (candidate) => !removed.has(candidate.id)
          )
        );
        onFeedbackRef.current?.(null);
      };

      map.on("draw.create", create);
      map.on("draw.update", update);
      map.on("draw.delete", remove);
      return () => {
        releaseLoaded();
        map.off("draw.create", create);
        map.off("draw.update", update);
        map.off("draw.delete", remove);
        try {
          if (map.hasControl(draw as unknown as IControl)) {
            map.removeControl(draw as unknown as IControl);
          }
        } catch (error) {
          console.warn("Failed to remove MapboxDraw control", error);
        }
        if (drawRef.current === draw) drawRef.current = null;
      };
    }, [commit, map]);

    useEffect(() => {
      const draw = drawRef.current;
      if (!draw) return;
      const signature = stableHash(
        features.map((candidate) => ({
          id: candidate.id,
          geometry: candidate.geometry,
          type: candidate.type,
        }))
      );
      const currentSignature = stableHash(
        draw.getAll().features.map((candidate) => ({
          id: String(candidate.id),
          geometry: candidate.geometry,
          type: candidate.properties?.interventionType ?? null,
        }))
      );
      if (signature !== currentSignature) {
        syncingRef.current = true;
        draw.deleteAll();
        if (features.length > 0) {
          draw.add({
            type: "FeatureCollection",
            features: features.map(drawFeature),
          });
        }
        syncingRef.current = false;
      }
      // Re-arm only after the sync, which would otherwise wipe the new draft.
      if (rearmRef.current) {
        rearmRef.current = false;
        const type = activeRef.current;
        if (type && type !== "wetland") {
          draftTypeRef.current = type;
          draw.changeMode("draw_polygon");
        }
      }
    }, [features, map]);

    useEffect(() => {
      const draw = drawRef.current;
      if (!draw) return;
      const getCanvasStyle = () =>
        typeof map?.getCanvas === "function" ? map.getCanvas().style : null;

      const style = getCanvasStyle();
      const drawing = Boolean(activeIntervention && activeIntervention !== "wetland");
      if (drawing) {
        draftTypeRef.current = activeIntervention;
        draw.changeMode("draw_polygon");
        if (style) style.cursor = "crosshair";
      } else {
        // Leaving draw mode closes a shape with three or more points; it keeps
        // the tool it was started with, so "Done" never throws work away.
        draw.changeMode("simple_select");
        draftTypeRef.current = null;
        if (style) style.cursor = "";
      }
      setMapDrawing(map, drawing);
      return () => {
        setMapDrawing(map, false);
        const s = getCanvasStyle();
        if (s) s.cursor = "";
      };
    }, [activeIntervention, map]);

    useEffect(() => {
      if (!map || !safeHasStyle(map)) return;
      if (!map.hasImage(INVALID_PATTERN_ID)) {
        map.addImage(INVALID_PATTERN_ID, hatchImage());
      }
      if (!safeGetSource(map, INVALID_SOURCE_ID)) {
        map.addSource(INVALID_SOURCE_ID, {
          type: "geojson",
          data: invalidCollection(featuresRef.current),
        });
      }
      if (!safeGetLayer(map, INVALID_FILL_ID)) {
        map.addLayer({
          id: INVALID_FILL_ID,
          type: "fill",
          source: INVALID_SOURCE_ID,
          paint: {
            "fill-color": "rgba(220, 38, 38, 0.18)",
            "fill-pattern": INVALID_PATTERN_ID,
          },
        });
      }
      if (!safeGetLayer(map, INVALID_OUTLINE_ID)) {
        map.addLayer({
          id: INVALID_OUTLINE_ID,
          type: "line",
          source: INVALID_SOURCE_ID,
          paint: {
            "line-color": "#dc2626",
            "line-width": 2,
            "line-dasharray": [2, 2],
          },
        });
      }
      return () => {
        for (const id of [INVALID_OUTLINE_ID, INVALID_FILL_ID]) {
          safeRemoveLayer(map, id);
        }
        safeRemoveSource(map, INVALID_SOURCE_ID);
        try {
          if (map.hasImage(INVALID_PATTERN_ID)) {
            map.removeImage(INVALID_PATTERN_ID);
          }
        } catch {
          // Ignore if image or map style was destroyed
        }
      };
    }, [map]);

    useEffect(() => {
      if (!map || !safeHasStyle(map)) return;
      const source = safeGetSource(map, INVALID_SOURCE_ID) as
        | GeoJSONSource
        | undefined;
      source?.setData(invalidCollection(features));
    }, [features, map]);

    return null;
  }
);
