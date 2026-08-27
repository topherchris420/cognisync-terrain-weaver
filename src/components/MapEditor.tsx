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
import { area, bboxPolygon } from "@turf/turf";
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
  type InterventionKey,
  type Scenario,
} from "@/lib/scenario";
import type { SpatialContextResult } from "@/lib/spatial-data/types";
import type { LandCover } from "@/lib/types";
import { evaluateEligibility } from "@/lib/counterfactual/eligibility";
import { stableHash } from "@/lib/counterfactual/hashing";
import { deriveScenarioFromFeatures } from "@/lib/counterfactual/projected-metrics";
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

export interface MapEditorHandle {
  undo: () => void;
  clear: () => void;
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
  context: SpatialContextResult | null
): InterventionFeature {
  const eligibility = evaluateEligibility(draft.geometry, type, context);
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
      });
      try {
        map.addControl(draw as unknown as IControl, "top-left");
      } catch (error) {
        console.warn("Failed to add MapboxDraw control", error);
        return;
      }
      drawRef.current = draw;

      const create = (event: DrawEvent) => {
        if (syncingRef.current) return;
        const type = activeRef.current;
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
            interventionFromDraft(draft, type, contextRef.current)
          );
        if (created.length === 0) return;
        onFeedbackRef.current?.(created.at(-1)!.eligibility);
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
            contextRef.current
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
          type: candidate.properties?.interventionType,
        }))
      );
      if (signature === currentSignature) return;
      syncingRef.current = true;
      draw.deleteAll();
      if (features.length > 0) {
        draw.add({
          type: "FeatureCollection",
          features: features.map(drawFeature),
        });
      }
      syncingRef.current = false;
    }, [features]);

    useEffect(() => {
      const draw = drawRef.current;
      if (!draw) return;
      const getCanvasStyle = () =>
        typeof map?.getCanvas === "function" ? map.getCanvas().style : null;

      const style = getCanvasStyle();
      if (activeIntervention && activeIntervention !== "wetland") {
        draw.changeMode("draw_polygon");
        if (style) style.cursor = "crosshair";
      } else {
        draw.changeMode("simple_select");
        if (style) style.cursor = "";
      }
      return () => {
        const s = getCanvasStyle();
        if (s) s.cursor = "";
      };
    }, [activeIntervention, map]);

    useEffect(() => {
      if (!map) return;
      if (!map.hasImage(INVALID_PATTERN_ID)) {
        map.addImage(INVALID_PATTERN_ID, hatchImage());
      }
      if (!map.getSource(INVALID_SOURCE_ID)) {
        map.addSource(INVALID_SOURCE_ID, {
          type: "geojson",
          data: invalidCollection(featuresRef.current),
        });
      }
      if (!map.getLayer(INVALID_FILL_ID)) {
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
      if (!map.getLayer(INVALID_OUTLINE_ID)) {
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
          if (map.getLayer(id)) map.removeLayer(id);
        }
        if (map.getSource(INVALID_SOURCE_ID)) {
          map.removeSource(INVALID_SOURCE_ID);
        }
        if (map.hasImage(INVALID_PATTERN_ID)) {
          map.removeImage(INVALID_PATTERN_ID);
        }
      };
    }, [map]);

    useEffect(() => {
      const source = map?.getSource(INVALID_SOURCE_ID) as
        | GeoJSONSource
        | undefined;
      source?.setData(invalidCollection(features));
    }, [features, map]);

    return null;
  }
);
