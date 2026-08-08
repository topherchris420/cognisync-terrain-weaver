import { useEffect, useRef, useState } from "react";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import * as turf from "@turf/turf";
import type { Map as MLMap, IControl } from "maplibre-gl";
import { type InterventionKey, INTERVENTION_ORDER, INTERVENTIONS, type Scenario, EMPTY_SCENARIO } from "@/lib/scenario";
import { bboxAreaKm2, parseBBox } from "@/lib/geo";
import type { LandCover } from "@/lib/types";

interface Props {
  map: MLMap | null;
  bbox: unknown;
  cover: LandCover;
  onScenarioChange: (scenario: Scenario) => void;
  activeIntervention: InterventionKey | null;
}

export function MapEditor({ map, bbox, cover, onScenarioChange, activeIntervention }: Props) {
  const drawRef = useRef<MapboxDraw | null>(null);
  
  // Track features by intervention type
  const [features, setFeatures] = useState<Record<string, InterventionKey>>({});
  const activeInterventionRef = useRef(activeIntervention);
  activeInterventionRef.current = activeIntervention;

  useEffect(() => {
    if (!map || !bbox) return;

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        polygon: true,
        trash: true
      }
    });
    
    try {
      map.addControl(draw as unknown as IControl, 'top-left');
      drawRef.current = draw;
    } catch (e) {
      console.warn("Failed to add MapboxDraw control", e);
      return;
    }

    const updateScenario = () => {
      const data = draw.getAll();
      const siteBbox = parseBBox(bbox);
      if (!siteBbox) return;
      
      const siteAreaM2 = bboxAreaKm2(siteBbox) * 1e6;
      if (siteAreaM2 <= 0) return;

      const areas: Record<InterventionKey, number> = {
        street_trees: 0,
        bioswales: 0,
        permeable_pavement: 0,
        green_roofs: 0,
      };

      setFeatures(currentFeatures => {
        data.features.forEach(f => {
          if (!f.id) return;
          const type = currentFeatures[f.id as string];
          if (type && areas[type] !== undefined) {
            areas[type] += turf.area(f);
          }
        });
        return currentFeatures;
      });

      const shares = () => {
        const land = ['vegetation', 'soil', 'buildings', 'pavement'].reduce((a, k) => a + (Number((cover as any)[k]) || 0), 0) || 1;
        return {
          pavement: (cover.pavement || 0) / land,
          buildings: (cover.buildings || 0) / land,
        };
      };
      const s = shares();

      const scenario = { ...EMPTY_SCENARIO };
      for (const key of INTERVENTION_ORDER) {
        const sourceShare = s[INTERVENTIONS[key].source as keyof typeof s];
        if (sourceShare > 0) {
          const availableSourceArea = siteAreaM2 * sourceShare;
          scenario[key] = Math.min(1, areas[key] / availableSourceArea);
        }
      }
      onScenarioChange(scenario);
    };

    const onCreate = (e: { features: GeoJSON.Feature[] }) => {
      const currentIntervention = activeInterventionRef.current;
      if (!currentIntervention) return;
      setFeatures(prev => {
        const next = { ...prev };
        e.features.forEach(f => {
          if (f.id) next[f.id as string] = currentIntervention;
        });
        return next;
      });
      updateScenario();
    };

    map.on('draw.create', onCreate);
    map.on('draw.delete', updateScenario);
    map.on('draw.update', updateScenario);

    return () => {
      map.off('draw.create', onCreate);
      map.off('draw.delete', updateScenario);
      map.off('draw.update', updateScenario);
      try {
        if (map.hasControl(draw as unknown as IControl)) {
          map.removeControl(draw as unknown as IControl);
        }
      } catch (e) {
        console.warn("Failed to remove MapboxDraw control", e);
      }
      if (drawRef.current === draw) {
        drawRef.current = null;
      }
    };
  }, [map, bbox, cover]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
