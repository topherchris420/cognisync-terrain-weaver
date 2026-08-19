import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import maplibregl, { Map as MLMap, Marker, Popup } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { TacticalCOPState, IoTSensor, SupplyNode, ConvoyAsset, TransitCorridor } from "@/lib/tactical/types";
import type { TacticalLayersState } from "./TacticalLayerControls";
import type { FlowPath, RiskZone } from "@/lib/simulation-types";
import { FlowLayer, type FlowLayerHandle } from "@/components/FlowLayer";
import { RiskHeatmap, type RiskHeatmapHandle } from "@/components/RiskHeatmap";

interface TacticalMapViewProps {
  state: TacticalCOPState;
  layers: TacticalLayersState;
  flowPaths?: FlowPath[];
  riskZones?: RiskZone[];
  center: [number, number]; // [lng, lat]
  zoom?: number;
  onSelectSensor?: (sensor: IoTSensor) => void;
  onSelectNode?: (node: SupplyNode) => void;
  onSelectCorridor?: (corridor: TransitCorridor) => void;
}

export interface TacticalMapViewHandle {
  flyTo: (lng: number, lat: number, zoom?: number) => void;
  getMap: () => MLMap | null;
}

const TACTICAL_CORRIDORS_SOURCE = "tactical-corridors-source";
const TACTICAL_CORRIDORS_LAYER = "tactical-corridors-layer";
const TACTICAL_CORRIDORS_CASING = "tactical-corridors-casing";

export const TacticalMapView = forwardRef<TacticalMapViewHandle, TacticalMapViewProps>(
  function TacticalMapView(
    {
      state,
      layers,
      flowPaths = [],
      riskZones = [],
      center,
      zoom = 14.5,
      onSelectSensor,
      onSelectNode,
      onSelectCorridor,
    },
    ref
  ) {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<MLMap | null>(null);
    const markersRef = useRef<Marker[]>([]);
    const flowLayerRef = useRef<FlowLayerHandle>(null);
    const riskHeatmapRef = useRef<RiskHeatmapHandle>(null);

    useImperativeHandle(ref, () => ({
      flyTo: (lng: number, lat: number, targetZoom = 15) => {
        mapRef.current?.flyTo({ center: [lng, lat], zoom: targetZoom, duration: 1200 });
      },
      getMap: () => mapRef.current,
    }));

    // Initialize Map
    useEffect(() => {
      if (!mapContainerRef.current || mapRef.current) return;

      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: {
          version: 8,
          sources: {
            satellite: {
              type: "raster",
              tiles: [
                "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
              ],
              tileSize: 256,
              attribution: "Esri World Imagery",
            },
            labels: {
              type: "raster",
              tiles: [
                "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
              ],
              tileSize: 256,
            },
          },
          layers: [
            { id: "satellite", type: "raster", source: "satellite" },
            { id: "labels", type: "raster", source: "labels", paint: { "raster-opacity": 0.85 } },
          ],
        },
        center,
        zoom,
        attributionControl: false,
      });

      map.addControl(new maplibregl.NavigationControl(), "top-right");

      map.on("load", () => {
        // Add Transit Corridors Source & Layers
        map.addSource(TACTICAL_CORRIDORS_SOURCE, {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [],
          },
        });

        map.addLayer({
          id: TACTICAL_CORRIDORS_CASING,
          type: "line",
          source: TACTICAL_CORRIDORS_SOURCE,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#000000",
            "line-width": 6,
            "line-opacity": 0.7,
          },
        });

        map.addLayer({
          id: TACTICAL_CORRIDORS_LAYER,
          type: "line",
          source: TACTICAL_CORRIDORS_SOURCE,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": [
              "match",
              ["get", "status"],
              "closed",
              "#ef4444",
              "flooded",
              "#f97316",
              "congested",
              "#eab308",
              "#10b981",
            ],
            "line-width": 4,
            "line-dasharray": [
              "match",
              ["get", "status"],
              "closed",
              ["literal", [2, 2]],
              ["literal", [1, 0]],
            ],
          },
        });
      });

      mapRef.current = map;

      return () => {
        map.remove();
        mapRef.current = null;
      };
      // Center and zoom are initial mount coordinates
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Update Transit Corridors on Map
    useEffect(() => {
      const map = mapRef.current;
      if (!map) return;

      const updateData = () => {
        const source = map.getSource(TACTICAL_CORRIDORS_SOURCE) as maplibregl.GeoJSONSource;
        if (!source) return;

        if (!layers.showCorridors) {
          source.setData({ type: "FeatureCollection", features: [] });
          return;
        }

        source.setData({
          type: "FeatureCollection",
          features: state.corridors.map((c) => ({
            type: "Feature",
            properties: {
              id: c.id,
              name: c.name,
              status: c.status,
              risk: c.inundation_risk_score,
            },
            geometry: {
              type: "LineString",
              coordinates: c.coordinates,
            },
          })),
        });
      };

      if (map.isStyleLoaded()) {
        updateData();
      } else {
        map.once("load", updateData);
      }
    }, [state.corridors, layers.showCorridors]);

    // Update Custom Markers (Sensors, Supply Nodes, Convoys)
    useEffect(() => {
      const map = mapRef.current;
      if (!map) return;

      // Clear existing markers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      // 1. USGS Streamgage Markers
      if (layers.showSensors) {
        state.sensors.forEach((sensor) => {
          const el = document.createElement("div");
          el.className = "group relative cursor-pointer flex items-center justify-center";
          
          const isCrit = sensor.status === "critical";
          const isWarn = sensor.status === "warning";
          const bgClass = isCrit
            ? "bg-destructive text-destructive-foreground ring-destructive/50"
            : isWarn
            ? "bg-amber-600 text-white ring-amber-500/50"
            : "bg-primary text-primary-foreground ring-primary/40";

          el.innerHTML = `
            <div class="relative flex items-center justify-center">
              <div class="relative inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${bgClass} ring-1 shadow-sm">
                ${sensor.reading} ${sensor.unit.split(" ")[0]}
              </div>
            </div>
          `;

          el.addEventListener("click", () => onSelectSensor?.(sensor));

          const marker = new maplibregl.Marker({ element: el })
            .setLngLat(sensor.coordinates)
            .addTo(map);

          markersRef.current.push(marker);
        });
      }

      // 2. Supply Nodes & Shelters Markers
      if (layers.showSupply) {
        state.supply_nodes.forEach((node) => {
          const el = document.createElement("div");
          el.className = "cursor-pointer flex items-center justify-center";
          const labelPrefix = node.type === "dpw_staging" ? "DPW" : node.type === "pump_station" ? "PUMP" : "SHELTER";
          
          el.innerHTML = `
            <div class="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-card text-foreground border border-border shadow-sm flex items-center gap-1">
              <span class="text-primary font-bold">[${labelPrefix}]</span>
              <span>${node.name.split(" ")[0]}</span>
            </div>
          `;

          el.addEventListener("click", () => onSelectNode?.(node));

          const marker = new maplibregl.Marker({ element: el })
            .setLngLat(node.coordinates)
            .addTo(map);

          markersRef.current.push(marker);
        });

        // 3. Convoys / Equipment Units Markers
        state.convoys.forEach((convoy) => {
          const el = document.createElement("div");
          el.className = "cursor-pointer flex items-center justify-center";
          el.innerHTML = `
            <div class="px-1.5 py-0.5 rounded bg-primary text-primary-foreground font-mono text-[10px] font-medium shadow-sm flex items-center gap-1">
              <span>UNIT:</span>
              <span>${convoy.callsign.split(" ")[1] || convoy.callsign}</span>
            </div>
          `;

          const marker = new maplibregl.Marker({ element: el })
            .setLngLat(convoy.coordinates)
            .addTo(map);

          markersRef.current.push(marker);
        });
      }
    }, [
      state.sensors,
      state.supply_nodes,
      state.convoys,
      layers.showSensors,
      layers.showSupply,
      onSelectSensor,
      onSelectNode,
    ]);

    return (
      <div className="relative w-full h-full">
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Overlay Flow Layers & Risk Heatmap from existing Engine */}
        {layers.showFlows && (
          <FlowLayer
            ref={flowLayerRef}
            map={mapRef.current}
            flowPaths={flowPaths}
          />
        )}
        {layers.showRiskZones && (
          <RiskHeatmap
            ref={riskHeatmapRef}
            map={mapRef.current}
            riskZones={riskZones}
          />
        )}
      </div>
    );
  }
);
