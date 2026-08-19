import { useState, useRef, useCallback } from "react";
import {
  ShieldAlert,
  Radio,
  Navigation,
  Truck,
  CloudLightning,
  Layers,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GovCloudBadge } from "./GovCloudBadge";
import { TacticalLayerControls, type TacticalLayersState } from "./TacticalLayerControls";
import { TelemetrySensorsPanel } from "./TelemetrySensorsPanel";
import { CorridorSafetyRouter } from "./CorridorSafetyRouter";
import { SupplyChainMatrix } from "./SupplyChainMatrix";
import { IncidentAlertFeed } from "./IncidentAlertFeed";
import { TacticalMapView, type TacticalMapViewHandle } from "./TacticalMapView";
import { useTacticalStream } from "@/lib/tactical/stream";
import type { IoTSensor, SupplyNode, TransitCorridor, TacticalCOPState } from "@/lib/tactical/types";
import type { FlowPath, RiskZone } from "@/lib/simulation-types";

interface TacticalCOPProps {
  initialCenter?: [number, number]; // [lng, lat]
  flowPaths?: FlowPath[];
  riskZones?: RiskZone[];
  locationLabel?: string;
}

export function TacticalCOP({
  initialCenter = [-74.006, 40.7128],
  flowPaths = [],
  riskZones = [],
  locationLabel = "Sector Manhattan (Operational Grid)",
}: TacticalCOPProps) {
  const mapRef = useRef<TacticalMapViewHandle>(null);

  const [layers, setLayers] = useState<TacticalLayersState>({
    showSensors: true,
    showCorridors: true,
    showSupply: true,
    showFlows: true,
    showRiskZones: true,
  });

  const [activeTab, setActiveTab] = useState<"telemetry" | "transit" | "supply">("telemetry");
  const [selectedSensor, setSelectedSensor] = useState<IoTSensor | null>(null);
  const [selectedNode, setSelectedNode] = useState<SupplyNode | null>(null);
  const [selectedCorridor, setSelectedCorridor] = useState<TransitCorridor | null>(null);

  const {
    state,
    auditLog,
    dispatchResupply,
    acknowledgeAlert,
    setWeatherIntensity,
  } = useTacticalStream({
    centerLat: initialCenter[1],
    centerLng: initialCenter[0],
    flowPaths,
    riskZones,
  });

  const handleSelectSensor = useCallback((sensor: IoTSensor) => {
    setSelectedSensor(sensor);
    mapRef.current?.flyTo(sensor.coordinates[0], sensor.coordinates[1], 16);
  }, []);

  const handleSelectNode = useCallback((node: SupplyNode) => {
    setSelectedNode(node);
    mapRef.current?.flyTo(node.coordinates[0], node.coordinates[1], 16);
  }, []);

  const handleSelectCorridor = useCallback((corridor: TransitCorridor) => {
    setSelectedCorridor(corridor);
    if (corridor.coordinates.length > 0) {
      const mid = corridor.coordinates[Math.floor(corridor.coordinates.length / 2)];
      mapRef.current?.flyTo(mid[0], mid[1], 15);
    }
  }, []);

  return (
    <div className="relative w-full h-[calc(100vh-3.5rem)] bg-background flex flex-col overflow-hidden font-sans select-none">
      {/* Tactical Top Bar */}
      <div className="h-12 border-b border-border/80 bg-background/95 backdrop-blur-xl px-4 flex items-center justify-between gap-4 z-20">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
            </span>
            <span className="font-mono font-bold text-xs uppercase tracking-wider text-foreground">
              EOC TACTICAL COP
            </span>
          </div>

          <Badge variant="outline" className="text-[11px] font-mono border-border/60 bg-muted/20 text-muted-foreground hidden sm:inline-flex">
            {locationLabel}
          </Badge>
        </div>

        {/* Tactical Controls & Weather Toggle */}
        <div className="flex items-center gap-2.5">
          <div className="hidden lg:flex items-center gap-1.5 bg-muted/20 px-2 py-1 rounded-md border border-border/50">
            <CloudLightning className="h-3.5 w-3.5 text-sky-400" />
            <span className="text-[11px] font-mono text-muted-foreground">Scenario:</span>
            <Select
              value={state.weather_intensity}
              onValueChange={(v) => setWeatherIntensity(v as TacticalCOPState["weather_intensity"])}
            >
              <SelectTrigger className="h-6 text-xs font-mono border-none bg-transparent shadow-none px-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="font-mono text-xs">
                <SelectItem value="normal">Baseline Calm</SelectItem>
                <SelectItem value="tropical_storm">Tropical Storm</SelectItem>
                <SelectItem value="cloudburst_50mm">50mm Cloudburst</SelectItem>
                <SelectItem value="cat_4_hurricane">Cat 4 Hurricane</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <GovCloudBadge auditLog={auditLog} />
        </div>
      </div>

      {/* Main Tactical Cockpit Area */}
      <div className="relative flex-1 flex overflow-hidden">
        {/* Tactical Map Canvas */}
        <div className="relative flex-1 h-full">
          <TacticalMapView
            ref={mapRef}
            state={state}
            layers={layers}
            flowPaths={flowPaths}
            riskZones={riskZones}
            center={initialCenter}
            onSelectSensor={handleSelectSensor}
            onSelectNode={handleSelectNode}
            onSelectCorridor={handleSelectCorridor}
          />

          {/* Floating Layer Controls (Top Left of Map) */}
          <div className="absolute top-3 left-3 z-10">
            <TacticalLayerControls layers={layers} onChange={setLayers} />
          </div>

          {/* Floating Incident Alert Feed (Bottom of Map) */}
          <div className="absolute bottom-3 left-3 right-3 md:right-auto md:w-[480px] z-10 p-3 rounded-xl border border-border/80 bg-background/90 backdrop-blur-xl shadow-2xl">
            <IncidentAlertFeed
              alerts={state.alerts}
              onAcknowledge={acknowledgeAlert}
            />
          </div>
        </div>

        {/* Right Tactical Intelligence Workbench */}
        <div className="w-full md:w-[380px] lg:w-[420px] h-full border-l border-border/80 bg-background/95 backdrop-blur-xl flex flex-col z-10 shadow-2xl">
          <div className="p-3 border-b border-border/60">
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as typeof activeTab)}
              className="w-full"
            >
              <TabsList className="grid grid-cols-3 h-8 bg-muted/40 p-0.5">
                <TabsTrigger value="telemetry" className="text-xs font-mono gap-1">
                  <Radio className="h-3 w-3" />
                  Sensors
                </TabsTrigger>
                <TabsTrigger value="transit" className="text-xs font-mono gap-1">
                  <Navigation className="h-3 w-3" />
                  Transit
                </TabsTrigger>
                <TabsTrigger value="supply" className="text-xs font-mono gap-1">
                  <Truck className="h-3 w-3" />
                  Supply
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="flex-1 p-3 overflow-hidden">
            {activeTab === "telemetry" && (
              <TelemetrySensorsPanel
                sensors={state.sensors}
                selectedSensorId={selectedSensor?.id}
                onSelectSensor={handleSelectSensor}
              />
            )}

            {activeTab === "transit" && (
              <CorridorSafetyRouter
                corridors={state.corridors}
                selectedCorridorId={selectedCorridor?.id}
                onSelectCorridor={handleSelectCorridor}
              />
            )}

            {activeTab === "supply" && (
              <SupplyChainMatrix
                nodes={state.supply_nodes}
                convoys={state.convoys}
                selectedNodeId={selectedNode?.id}
                onSelectNode={handleSelectNode}
                onDispatch={dispatchResupply}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
