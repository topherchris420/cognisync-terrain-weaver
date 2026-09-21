import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { AppNav } from "@/components/AppNav";
import { MapView, type MapViewHandle } from "@/components/MapView";
import { AbsorptionScoreGauge } from "@/components/AbsorptionScoreGauge";
import { LocationSearch } from "@/components/LocationSearch";
import { AnalyzingState } from "@/components/AnalyzingState";
import { FlowLayer } from "@/components/FlowLayer";
import { FloodVolumeLayer } from "@/components/FloodVolumeLayer";
import { RiskHeatmap } from "@/components/RiskHeatmap";
import { LandCoverBreakdown } from "@/components/LandCoverBreakdown";
import { BaselineComparison } from "@/components/BaselineComparison";
import { Historical1609Panel } from "@/components/historical/Historical1609Panel";
import { useWelikia1609 } from "@/hooks/useWelikia1609";
import { EraRasterLayer } from "@/components/historical/EraRasterLayer";
import { EraTimeline } from "@/components/historical/EraTimeline";
import { EraCompare } from "@/components/historical/EraCompare";
import { DEFAULT_ERA_ID, getEra } from "@/lib/historical/eras";
import { RecommendationsList } from "@/components/RecommendationsList";
import { ScenarioStudio } from "@/components/ScenarioStudio";
import { CompareRealities } from "@/components/catalyst/CompareRealities";
import { solveForTarget, projectFuture, DEFAULT_TARGET_SCORE } from "@/lib/catalyst";
import type { FutureState } from "@/lib/catalyst";
import type { Scenario, InterventionKey, ScenarioExport } from "@/lib/scenario";
import { EMPTY_SCENARIO, hasActiveInterventions } from "@/lib/scenario";
import { MapEditor, type MapEditorHandle } from "@/components/MapEditor";
import { riskLabel } from "@/lib/absorption";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  Play,
  Droplets,
  Paintbrush,
  Link2,
  MapPin,
  FileText,
  FileSpreadsheet,
  FileJson,
  Layers,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  RotateCcw,
  ArrowRight,
  Sliders,
  BarChart3,
  Waves,
  ShieldCheck,
  Compass,
  Mountain,
} from "lucide-react";
import { usePageTitle } from "@/hooks/use-page-title";
import { useWorkflow } from "@/hooks/useWorkflow";
import { supabase } from "@/integrations/supabase/client";
import type { Map as MLMap } from "maplibre-gl";
import type { AnalysisRecord } from "@/lib/types";
import { PRESETS, type GeocodeResult } from "@/lib/geocode";
import type { SimulationResponse } from "@/lib/simulation-types";
import {
  bboxAreaKm2,
  parseBBox,
  analysesToCSV,
  analysesToGeoJSON,
  downloadTextFile,
  exportFilename,
  type BBox,
} from "@/lib/geo";
import { boundsToSimBBox } from "@/lib/simulation";
import { generatePDFReport } from "@/lib/pdf-export";
import { toast } from "sonner";
import { TacticalHUD } from "@/components/tactical/TacticalHUD";
import { CommandPalette } from "@/components/tactical/CommandPalette";
import { DetectionOverlay } from "@/components/tactical/DetectionOverlay";
import { ExampleStorm } from "@/components/analyze/ExampleStorm";
import { EXAMPLE_ANALYSIS } from "@/lib/example-analysis";
import "@/styles/atlas.css";
import { AnalysisLaunchPanel } from "@/components/analyze/AnalysisLaunchPanel";

import type { StormDefinition, RealitySurface } from "@/lib/counterfactual/types";
import type { SimulationRequestV2 } from "@/lib/simulation-types";
import { stableHash } from "@/lib/counterfactual/hashing";
import {
  createStormSeal,
  checkStormDeterminism,
  type StormSeal,
  type DeterminismReport,
} from "@/lib/storm-identity";
import { StormTelemetryReadout } from "@/components/studio/StormTelemetryReadout";
import { StormHydrograph } from "@/components/studio/StormHydrograph";
import { WaterBalanceMeter } from "@/components/studio/WaterBalanceMeter";
import { buildRealitySurface } from "@/lib/counterfactual/modifiers";
import {
  LOCAL_GRID,
  runLocalStorm,
} from "@/lib/hydrology";
import type { InterventionFeature } from "@/lib/counterfactual/types";

const STORM_RAINFALL_MM = 50;
const STORM_RESOLUTION = "medium" as const;

const SURFACE_PROVENANCE = [
  {
    sourceId: "mannahatta-land-cover",
    title: "Classified satellite land cover",
    agency: "Mannahatta",
    url: "https://github.com/topherchris420/cognisync-terrain-weaver",
    accessedAt: "2026-09-21T00:00:00.000Z",
    confidence: "medium" as const,
    status: "derived" as const,
    caveats: [
      "Unmodified cells use the composite Rational Method runoff coefficient for the classified mix.",
      "Drawn interventions raise retention only on overlaying grid cells.",
    ],
  },
];

const DEFAULT_VIEW = { lat: 40.7075, lng: -74.009, zoom: 15 };

export function buildStormDefinition(
  rainfallDepthMm: number,
  resolution: "low" | "medium" | "high"
): StormDefinition {
  const definition = {
    rainfallDepthMm,
    durationMinutes: 60,
    distribution: "uniform" as const,
    resolution,
    includeDrainage: false as const,
  };
  const hash = stableHash(definition);
  return {
    id: `storm:${hash}`,
    ...definition,
    hash,
  };
}

export function buildRealitySimulationRequest(
  bbox: SimulationRequestV2["bbox"],
  storm: StormDefinition,
  surface: RealitySurface,
  expectedElevationHash?: string
): SimulationRequestV2 {
  return {
    bbox,
    storm,
    surface: {
      id: surface.id,
      surfaceHash: surface.surfaceHash,
      baselineLayerHash: surface.baselineLayerHash,
      modifiers: surface.modifiers,
      provenance: surface.provenance,
    },
    ...(expectedElevationHash ? { expectedElevationHash } : {}),
  };
}

function viewFromParams(params: URLSearchParams) {
  const rawLat = params.get("lat");
  const rawLng = params.get("lng");
  if (!rawLat || !rawLng) return null;
  const lat = Number(rawLat);
  const lng = Number(rawLng);
  const zoom = Number(params.get("zoom") || NaN);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return {
    lat,
    lng,
    zoom: Number.isFinite(zoom) ? Math.min(19, Math.max(2, zoom)) : DEFAULT_VIEW.zoom,
  };
}

export default function Analyze() {
  usePageTitle("Analyze");
  const mapRef = useRef<MapViewHandle>(null);
  const editorRef = useRef<MapEditorHandle>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const initialView = useMemo(
    () => viewFromParams(searchParams) ?? DEFAULT_VIEW,
    [searchParams]
  );

  const [name, setName] = useState("Lower Manhattan Watershed");
  const [viewportArea, setViewportArea] = useState(0);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [locationLabel, setLocationLabel] = useState(viewFromParams(searchParams) ? "Shared map view" : "Lower Manhattan, NY");
  const [view, setView] = useState(initialView);
  const [mapReady, setMapReady] = useState(false);
  const [mapInstance, setMapInstance] = useState<MLMap | null>(null);
  
  const [result, setResult] = useState<AnalysisRecord | null>(null);
  const isExample = result?.status === "example";
  const [capturedTile, setCapturedTile] = useState<string | null>(null);
  const [activeIntervention, setActiveIntervention] = useState<InterventionKey | null>(null);
  const [interventionFeatures, setInterventionFeatures] = useState<InterventionFeature[]>([]);
  const [terrainEnabled, setTerrainEnabled] = useState(false);
  const [terrainExaggeration, setTerrainExaggeration] = useState<number>(6.0);
  const [stormRainfallMm, setStormRainfallMm] = useState(STORM_RAINFALL_MM);
  const [stormResolution, setStormResolution] = useState<"low" | "medium" | "high">(STORM_RESOLUTION);
  const [simWarnings, setSimWarnings] = useState<string[]>([]);
  const [scenario, setScenario] = useState<Scenario>(EMPTY_SCENARIO);
  const [scenarioExport, setScenarioExport] = useState<ScenarioExport | null>(null);
  const [simResult, setSimResult] = useState<SimulationResponse | null>(null);
  const [futureSimResult, setFutureSimResult] = useState<SimulationResponse | null>(null);
  const [nowSeal, setNowSeal] = useState<StormSeal | null>(null);
  const [possibleSeal, setPossibleSeal] = useState<StormSeal | null>(null);

  // Layer visibility toggles
  const [showFlowVectors, setShowFlowVectors] = useState(true);
  const [showRiskHeatmap, setShowRiskHeatmap] = useState(true);
  const [eraId, setEraId] = useState<string>(DEFAULT_ERA_ID);
  const [compareEras, setCompareEras] = useState(false);

  // Workbench drawer state
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "simulation" | "mitigation" | "compare" | "export">("overview");

  // When an intervention tool becomes active, auto-collapse drawer for clear map view
  useEffect(() => {
    if (activeIntervention) {
      setDrawerOpen(false);
    }
  }, [activeIntervention]);

  // The launch panel advertises this accelerator. Keep it unavailable while
  // typing and route through runAnalysis so every normal guard still applies.
  useEffect(() => {
    const handleLaunchShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.matches("input, textarea, select, [contenteditable='true']");
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && !isTyping) {
        event.preventDefault();
        void runAnalysis();
      }
    };
    window.addEventListener("keydown", handleLaunchShortcut);
    return () => window.removeEventListener("keydown", handleLaunchShortcut);
  });

  // Global escape key handler to cancel drawing or close open modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (activeIntervention) {
          setActiveIntervention(null);
          toast.info("Drawing cancelled");
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeIntervention]);

  const determinism: DeterminismReport | null = useMemo(
    () => (nowSeal && possibleSeal ? checkStormDeterminism(nowSeal, possibleSeal) : null),
    [nowSeal, possibleSeal]
  );
  
  const [catalystFuture, setCatalystFuture] = useState<{
    scenario: Scenario;
    future: FutureState;
  } | null>(null);

  const workflow = useWorkflow();

  const analyzedBBox: BBox | null = useMemo(
    () => (result ? parseBBox(result.bbox) : null),
    [result]
  );

  /** Real 1609 cover for the analyzed site, or an explicit "not surveyed" state. */
  const welikia1609 = useWelikia1609(analyzedBBox);


  const currentAreaKm2 = analyzedBBox ? bboxAreaKm2(analyzedBBox) : viewportArea;

  // Keep the report's extent visible even when the camera moves elsewhere.
  useEffect(() => {
    if (!mapInstance || !result || !analyzedBBox) return;
    const hasStyle = () => {
      try { return Boolean(!mapInstance.getStyle || mapInstance.getStyle()); } catch { return false; }
    };
    if (!hasStyle() || !mapInstance.isStyleLoaded()) return;
    const id = "atlas-analysis-footprint";
    try {
      if (mapInstance.getSource(id)) return;
      mapInstance.addSource(id, { type: "geojson", data: analysesToGeoJSON([result]) });
      mapInstance.addLayer({
        id,
        type: "line",
        source: id,
        paint: { "line-color": "#bdd394", "line-width": 2, "line-dasharray": [3, 2] },
      });
    } catch {
      // Ignore layer additions if style was destroyed
    }
    return () => {
      if (!hasStyle()) return;
      try {
        if (mapInstance.getLayer(id)) mapInstance.removeLayer(id);
        if (mapInstance.getSource(id)) mapInstance.removeSource(id);
      } catch {
        // Ignore layer removals if style was destroyed
      }
    };
  }, [mapInstance, result, analyzedBBox]);

  // Resizing the dock changes the actual captured footprint as well as the canvas.
  useEffect(() => {
    if (!mapInstance) return;
    const observer = new ResizeObserver(() => mapInstance.resize());
    observer.observe(mapInstance.getContainer());
    return () => observer.disconnect();
  }, [mapInstance]);

  const onViewChange = useCallback(
    (v: { lat: number; lng: number; zoom: number }) => {
      setView(v);
      const bounds = mapRef.current?.getBounds();
      if (bounds) setViewportArea(bboxAreaKm2(bounds));
      setSearchParams(
        {
          lat: v.lat.toFixed(5),
          lng: v.lng.toFixed(5),
          zoom: v.zoom.toFixed(1),
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const copyShareLink = async () => {
    const url = new URL(window.location.href);
    url.searchParams.set("lat", view.lat.toFixed(5));
    url.searchParams.set("lng", view.lng.toFixed(5));
    url.searchParams.set("zoom", view.zoom.toFixed(1));
    try {
      await navigator.clipboard.writeText(url.toString());
      toast.success("Location link copied to clipboard");
    } catch {
      toast.error("Couldn't access clipboard.");
    }
  };

  const goTo = (r: GeocodeResult & { zoom?: number }) => {
    mapRef.current?.flyTo(r.lat, r.lng, r.zoom ?? 14);
    setLocationLabel(r.label);
    setName(r.label.split(",")[0] || "Custom Watershed");
  };

  const resetScan = () => {
    setAnalysisError(null);
    setResult(null);
    setCapturedTile(null);
    setScenarioExport(null);
    setActiveTab("overview");
    setSimResult(null);
    setFutureSimResult(null);
    setCatalystFuture(null);
    setNowSeal(null);
    setPossibleSeal(null);
    setActiveIntervention(null);
    setInterventionFeatures([]);
    setSimWarnings([]);
    setScenario(EMPTY_SCENARIO);
    workflow.reset();
  };

  const openExample = () => {
    resetScan();
    setResult(EXAMPLE_ANALYSIS);
    setName(EXAMPLE_ANALYSIS.name);
    setLocationLabel(EXAMPLE_ANALYSIS.location_label!);
    mapRef.current?.fitBounds(parseBBox(EXAMPLE_ANALYSIS.bbox)!);
    setDrawerOpen(true);
    workflow.advance("ANALYZED");
  };

  const runAnalysis = async () => {
    if (["ANALYZING", "STORM", "RERUN_STORM"].includes(workflow.state) || !mapReady) return;
    setAnalysisError(null);
    resetScan();
    workflow.advance("ANALYZING");
    setDrawerOpen(true);
    setActiveTab("overview");

    try {
      const imageDataUrl = await mapRef.current?.captureImage();
      if (!imageDataUrl) {
        setAnalysisError("Couldn’t capture imagery. Pan or zoom the map, then try again.");
        workflow.advance("SEARCH");
        return;
      }
      setCapturedTile(imageDataUrl);
      const bounds = mapRef.current?.getBounds() ?? null;

      const { data, error } = await supabase.functions.invoke("analyze-terrain", {
        body: {
          name: isExample ? "Lower Manhattan Watershed" : name.trim() || "Analyzed Site",
          location_label: locationLabel.trim() || null,
          center_lat: view.lat,
          center_lng: view.lng,
          zoom: view.zoom,
          bbox: bounds,
          image_data_url: imageDataUrl,
        },
      });

      if (error) {
        console.error("analyze-terrain failed:", error);
        setAnalysisError("The analysis service is unavailable. Try again, or explore the example below.");
        workflow.advance("SEARCH");
        return;
      }

      const analysis = (data as { analysis: AnalysisRecord }).analysis;
      setResult(analysis);
      workflow.advance("ANALYZED");
      toast.success("Surface permeability analysis complete.");
    } catch (e) {
      console.error(e);
      setAnalysisError("The scan could not finish. Try again, or explore the example below.");
      workflow.advance("SEARCH");
    }
  };

  const runSimulation = async (isRerun = false) => {
    if (!result) return;
    if (workflow.state === "STORM" || workflow.state === "RERUN_STORM") return;

    const bounds = analyzedBBox ?? (mapRef.current?.getBounds() as BBox | null);
    if (!bounds) {
      toast.error("No study extent is available yet.");
      return;
    }

    if (
      isRerun &&
      !hasActiveInterventions(scenario) &&
      interventionFeatures.length === 0
    ) {
      toast.error("Draw a green-infrastructure polygon before rerunning the storm.");
      setActiveTab("mitigation");
      return;
    }

    workflow.advance(isRerun ? "RERUN_STORM" : "STORM");
    setDrawerOpen(true);

    try {
      const extent = boundsToSimBBox(bounds);
      const stormDefinition =
        nowSeal?.storm ?? buildStormDefinition(stormRainfallMm, stormResolution);
      const seal = createStormSeal(stormDefinition);
      if (isRerun) {
        setPossibleSeal(seal);
      } else {
        setNowSeal(seal);
        setPossibleSeal(null);
        setFutureSimResult(null);
      }

      const size = LOCAL_GRID[stormDefinition.resolution];
      const nowSurface = buildRealitySurface({
        id: "now",
        baselineLayerHash: "landcover:classified",
        bbox: extent,
        rows: size,
        cols: size,
        features: [],
        provenance: SURFACE_PROVENANCE,
        warnings: [],
      });

      const nowRun = await runLocalStorm({
        bbox: extent,
        rainfallDepthMm: stormDefinition.rainfallDepthMm,
        durationMinutes: stormDefinition.durationMinutes,
        resolution: stormDefinition.resolution,
        landCover: result.land_cover,
        modifiers: nowSurface.modifiers,
        surfaceId: "now",
        stormHash: stormDefinition.hash,
        surfaceHash: nowSurface.surfaceHash,
      });
      setSimResult(nowRun);
      setSimWarnings(nowRun.warnings);

      if (isRerun) {
        const possibleSurface = buildRealitySurface({
          id: "possible",
          baselineLayerHash: "landcover:classified",
          bbox: extent,
          rows: size,
          cols: size,
          features: interventionFeatures,
          provenance: SURFACE_PROVENANCE,
          warnings: [],
        });
        const possibleRun = await runLocalStorm({
          bbox: extent,
          rainfallDepthMm: stormDefinition.rainfallDepthMm,
          durationMinutes: stormDefinition.durationMinutes,
          resolution: stormDefinition.resolution,
          landCover: result.land_cover,
          modifiers: possibleSurface.modifiers,
          surfaceId: "possible",
          stormHash: stormDefinition.hash,
          surfaceHash: possibleSurface.surfaceHash,
          expectedElevationHash: nowRun.elevationHash,
        });
        setFutureSimResult(possibleRun);
        const areaM2 = bboxAreaKm2(bounds) * 1e6;
        setCatalystFuture({
          scenario,
          future: projectFuture(result.land_cover, scenario, areaM2),
        });
        workflow.advance("COMPARE");
        setActiveTab("compare");
        toast.success(
          possibleRun.waterBalance.runoffM3 < nowRun.waterBalance.runoffM3
            ? "Same storm, less runoff on the mitigated surface."
            : "Counterfactual storm complete."
        );
      } else {
        workflow.advance("STORM_COMPLETE");
        setActiveTab("simulation");
        toast.success(
          `${stormDefinition.rainfallDepthMm} mm design storm routed on ${nowRun.elevationStatus} terrain.`
        );
      }
    } catch (e) {
      console.error(e);
      toast.error("Hydrologic simulation failed.");
      workflow.advance(isRerun ? "REDESIGN" : "ANALYZED");
    }
  };

  const handleExportPDF = () => {
    if (!result) return;
    try {
      const doc = generatePDFReport(result, {
        includeMapImage: Boolean(capturedTile),
        scenario: scenarioExport ?? undefined,
      });
      doc.save(exportFilename(`${name || "resilience-report"}`, "pdf"));
      toast.success("PDF Resilience Dossier generated.");
    } catch (e) {
      console.error(e);
      toast.error("Error generating PDF dossier.");
    }
  };

  const handleExportGeoJSON = () => {
    if (!result) return;
    downloadTextFile(
      exportFilename(name || "mannahatta-site", "geojson"),
      JSON.stringify(analysesToGeoJSON([result]), null, 2),
      "application/geo+json"
    );
    toast.success("GeoJSON boundary exported.");
  };

  const handleExportCSV = () => {
    if (!result) return;
    downloadTextFile(
      exportFilename(name || "mannahatta-site", "csv"),
      analysesToCSV([result]),
      "text/csv"
    );
    toast.success("CSV attribute table exported.");
  };

  return (
    <div className="atlas-app flex h-dvh w-full flex-col overflow-hidden bg-background text-foreground">
      {/* 1. Permanent Professional Workstation Topbar */}
      <AppNav />

      {/* 2. Main GIS Viewport Area */}
      <main id="main" className={cn("atlas-workspace relative flex-1 min-h-0 w-full overflow-hidden", (!result || drawerOpen) && "atlas-workspace--docked")}>
        {/* Full-bleed Map Canvas */}
        <div className="atlas-map absolute inset-0 h-full">
          <MapView
            ref={mapRef}
            initialCenter={[initialView.lng, initialView.lat]}
            initialZoom={initialView.zoom}
            terrainEnabled={terrainEnabled}
            terrainExaggeration={terrainExaggeration}
            onReady={() => {
              setMapReady(true);
              const bounds = mapRef.current?.getBounds();
              if (bounds) setViewportArea(bboxAreaKm2(bounds));
              setMapInstance(mapRef.current?.getMap() ?? null);
            }}
            onViewChange={onViewChange}
          />

          {/* Era layer for the selected point on the timeline */}
          {eraId !== "today" && (
            <EraRasterLayer map={mapInstance} era={getEra(eraId)} />
          )}

          {/* Historical timeline: 1609 → today → projected future */}
          <div className="absolute right-4 top-3 z-30 max-w-[calc(100vw-2rem)]">
            <EraTimeline
              eraId={eraId}
              onChange={setEraId}
              onCompare={() => setCompareEras(true)}
              center={{ lat: view.lat, lng: view.lng }}
            />
          </div>

          <EraCompare
            open={compareEras}
            onClose={() => setCompareEras(false)}
            center={{ lat: view.lat, lng: view.lng }}
            zoom={view.zoom}
          />

          {/* Hydrologic Inundation and Flow Vector Layers */}
          {simResult && showRiskHeatmap && (
            <RiskHeatmap map={mapInstance} riskZones={simResult.risk_zones ?? []} />
          )}
          {simResult && showFlowVectors && (
            <FlowLayer
              map={mapInstance}
              flowPaths={simResult.flow_paths ?? []}
              relief={terrainEnabled}
            />
          )}
          {simResult && terrainEnabled && showRiskHeatmap && (
            <FloodVolumeLayer
              map={mapInstance}
              riskZones={simResult.risk_zones ?? []}
            />
          )}

          {/* Interactive Direct Map Editor for Mitigations */}
          {workflow.state === "REDESIGN" && result && (
            <MapEditor
              ref={editorRef}
              map={mapInstance}
              bbox={result.bbox}
              features={interventionFeatures}
              onChange={setInterventionFeatures}
              cover={result.land_cover}
              onScenarioChange={(s) => setScenario(s)}
              activeIntervention={activeIntervention}
            />
          )}

          {/* Floating On-Map Drawing Mode Action Banner */}
          {workflow.state === "REDESIGN" && activeIntervention && (
            <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 w-full max-w-lg px-4">
              <div className="panel rounded-xl border border-accent/60 bg-card/95 p-4 shadow-2xl backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in slide-in-from-top-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/20 text-accent border border-accent/40">
                    <Paintbrush className="h-5 w-5 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-accent">
                      Drawing Mode Active
                    </h3>
                    <p className="text-xs text-foreground font-medium">
                      Click points on map to sketch area. Double-click or press <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono border">Esc</kbd> when finished.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActiveIntervention(null)}
                    className="h-8 text-xs flex-1 sm:flex-none"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setActiveIntervention(null);
                      setDrawerOpen(true);
                    }}
                    className="h-8 text-xs flex-1 sm:flex-none gap-1 bg-accent text-accent-foreground hover:bg-accent/90"
                  >
                    Done Drawing
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Split-Screen Comparative Mode */}
          {catalystFuture && workflow.state === "COMPARE" && (
            <CompareRealities
              open={true}
              onClose={() => workflow.advance("REDESIGN")}
              baseMap={mapInstance}
              currentScore={catalystFuture.future.impact.baseScore}
              futureScore={catalystFuture.future.impact.projectedScore}
              currentRisk={riskLabel(catalystFuture.future.impact.baseRisk)}
              futureRisk={riskLabel(catalystFuture.future.risk)}
              futureSimResult={futureSimResult}
              baseSimResult={simResult}
            />
          )}

          {/* Target Detection Overlay */}
          <DetectionOverlay
            riskZones={simResult?.risk_zones ?? []}
            flowPaths={simResult?.flow_paths ?? []}
          />
        </div>

        {/* Tactical Military HUD & Spatial Command Palette */}
        <TacticalHUD
          lat={view.lat}
          lng={view.lng}
          zoom={view.zoom}
          surfaceAreaKm2={currentAreaKm2}
          absorptionScore={result ? Number(result.absorption_score) : undefined}
          locationName={locationLabel || name}
        />

        <CommandPalette
          onSelectCity={(city) => goTo(city)}
          onRunSimulation={() => runSimulation(false)}
          onExportPdf={handleExportPDF}
        />

        <div className="atlas-map-heading">
          <span className="atlas-eyebrow">Resilience atlas / study area</span>
          <p>{result ? result.location_label : locationLabel || "Custom map view"}</p>
        </div>
        {!result && workflow.state !== "ANALYZING" && (
          <aside className="atlas-intro" aria-label="Start a resilience study">
            <div>
              <span className="atlas-eyebrow text-primary">Fieldwork for a changing planet</span>
              <h1>A better future <br />starts with <br /><em>the ground.</em></h1>
              <p className="atlas-intro-copy">See how your city absorbs rain.<br />Explore the changes that could help it absorb more.</p>
            </div>
            <div className="atlas-search">
              <label htmlFor="location-search" className="atlas-eyebrow">01 / Find your place</label>
              <LocationSearch onSelect={goTo} />
              <div className="atlas-presets">
                {PRESETS.slice(0, 3).map((preset) => <button key={preset.label} type="button" onClick={() => goTo(preset)}>{preset.label.split(",")[0]} <ArrowRight size={11} aria-hidden="true" /></button>)}
              </div>
            </div>
            <div className="atlas-intro-action">
              <span className="atlas-eyebrow">02 / Read the landscape</span>
              {analysisError && <p role="alert" className="my-3 rounded border border-destructive/40 bg-destructive/10 p-3 text-xs leading-relaxed">{analysisError}</p>}
              <AnalysisLaunchPanel location={locationLabel || name} areaKm2={currentAreaKm2} mapReady={mapReady} onAnalyze={runAnalysis} onExample={openExample} />
            </div>
            <div className="atlas-process"><span>Land cover</span><ArrowRight size={12} /><span>Rainfall</span><ArrowRight size={12} /><span>Possibilities</span></div>
          </aside>
        )}

        {/* 4. Live Bottom-Right GPS Status Readout */}
        <div className="atlas-map-status absolute bottom-9 right-4 z-20 flex flex-col items-end gap-2">
          {nowSeal && (
            <StormTelemetryReadout
              seal={nowSeal}
              rerunSeal={possibleSeal}
              report={determinism}
            />
          )}
          {terrainEnabled && (
            <p className="max-w-[18rem] rounded-md border border-border bg-card/90 px-3 py-1.5 text-right text-[10px] leading-snug text-muted-foreground shadow-md backdrop-blur-md">
              {simResult
                ? "Pitched relief and buildings. Flood columns follow modeled depth, scaled with the terrain."
                : "Pitched relief and buildings. The vertical scale eases as you zoom into the block."}
            </p>
          )}
          <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTerrainEnabled((value) => !value)}
            title={
              terrainEnabled
                ? "Return to a flat overhead view"
                : "Pitch the map to show relief, buildings, and flood depth"
            }
            aria-pressed={terrainEnabled}
            className={cn(
              "flex items-center gap-1.5 rounded-md border bg-card/90 backdrop-blur-md px-3 py-1.5 text-xs hover:text-foreground hover:bg-muted transition-colors shadow-md",
              terrainEnabled
                ? "border-primary/50 text-foreground"
                : "border-border text-muted-foreground"
            )}
          >
            <Mountain className={cn("h-3.5 w-3.5", terrainEnabled && "text-primary")} />
            <span className="hidden sm:inline">
              {terrainEnabled ? `3D on (${terrainExaggeration.toFixed(1)}x)` : "3D terrain"}
            </span>
          </button>
          {terrainEnabled && (
            <div className="flex items-center gap-1 rounded-md border border-border bg-card/90 backdrop-blur-md p-1 shadow-md text-xs">
              {[3.5, 6.0, 10.0].map((exag) => (
                <button
                  key={exag}
                  type="button"
                  onClick={() => setTerrainExaggeration(exag)}
                  className={cn(
                    "px-2 py-0.5 rounded font-mono text-[11px] transition-colors",
                    terrainExaggeration === exag
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                  title={`Set 3D relief exaggeration to ${exag.toFixed(1)}x`}
                >
                  {exag.toFixed(1)}x
                </button>
              ))}
            </div>
          )}
          <button
            onClick={copyShareLink}
            title="Copy coordinate link"
            className="flex items-center gap-1.5 rounded-md border border-border bg-card/90 backdrop-blur-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shadow-md"
          >
            <Link2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Share</span>
          </button>
          <div className="rounded-md border border-border bg-card/90 backdrop-blur-md px-3 py-1.5 font-mono text-xs text-muted-foreground shadow-md">
            {Math.abs(view.lat).toFixed(4)}°{view.lat >= 0 ? "N" : "S"}, {Math.abs(view.lng).toFixed(4)}°{view.lng >= 0 ? "E" : "W"} · z{view.zoom.toFixed(1)}
          </div>
          </div>
        </div>

        {/* 6. Active Scanning Progress Modal */}
        {workflow.state === "ANALYZING" && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 w-[400px] max-w-[90vw]">
            <div className="panel rounded-xl border border-border p-6 shadow-2xl">
              <AnalyzingState tile={capturedTile} />
            </div>
          </div>
        )}

        {/* 7. Active Simulation Banner */}
        {(workflow.state === "STORM" || workflow.state === "RERUN_STORM") && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40">
            <div className="panel rounded-full border border-primary/40 bg-card/95 px-6 py-3 shadow-2xl backdrop-blur-md flex items-center gap-3">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm font-medium text-foreground">
                {workflow.state === "STORM" ? "Simulating 50 mm / 60-minute design storm…" : "Simulating mitigated watershed response…"}
              </span>
            </div>
          </div>
        )}

        {/* 8. Docked Collapsible Workbench Drawer (When Analysis Results Exist) */}
        {result && (
          <aside
            aria-label="Urban Resilience Workbench"
            hidden={!drawerOpen}
            className={cn(
              "atlas-results absolute top-0 bottom-0 left-0 z-30 border-r border-border bg-card flex flex-col",
              drawerOpen ? "translate-x-0" : "-translate-x-full"
            )}
          >
            {/* Workbench Drawer Header */}
            <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-muted/40 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-primary/15 text-primary border border-primary/30">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold truncate leading-tight">
                    {result.location_label || result.name}
                  </h2>
                  <p className="text-[11px] font-mono text-muted-foreground truncate">
                    {currentAreaKm2.toFixed(2)} km² · {Math.round(currentAreaKm2 * 100)} ha
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetScan}
                  disabled={["ANALYZING", "STORM", "RERUN_STORM"].includes(workflow.state)}
                  className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1"
                  title="Reset and clear analysis"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setDrawerOpen(false)}
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  title="Collapse sidebar"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {isExample && <div className="atlas-example-notice"><strong>Illustrative example</strong><span>Explore the tools with sample data. Not a site assessment.</span></div>}
            {/* Workbench Navigation Tabs */}
            <div className="border-b border-border bg-card px-2 shrink-0">
              <Tabs
                value={activeTab}
                onValueChange={(val) => setActiveTab(val as typeof activeTab)}
                className="w-full"
              >
                <TabsList className="grid grid-cols-5 h-9 bg-transparent p-0">
                  <TabsTrigger
                    value="overview"
                    className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
                  >
                    Overview
                  </TabsTrigger>
                  <TabsTrigger
                    value="simulation"
                    className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
                  >
                    Storm Sim
                  </TabsTrigger>
                  <TabsTrigger
                    value="mitigation"
                    className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
                  >
                    Mitigation
                  </TabsTrigger>
                  <TabsTrigger
                    value="compare"
                    className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
                  >
                    Compare
                  </TabsTrigger>
                  <TabsTrigger
                    value="export"
                    className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
                  >
                    Export
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Tab Contents Scroll Area */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* TAB 1: OVERVIEW & LAND COVER */}
              {activeTab === "overview" && (
                <div className="space-y-6">
                  {isExample && <p className="text-xs leading-relaxed text-muted-foreground">{result.ai_notes}</p>}
                  {/* Absorption Score Gauge */}
                  <div className="panel rounded-xl border border-border p-4">
                    <AbsorptionScoreGauge score={Number(result.absorption_score)} />
                  </div>

                  {/* 5-Class Land Cover Composition Breakdown */}
                  <div className="panel rounded-xl border border-border p-4">
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
                      Land-Cover Classification & Hydrologic Weights
                    </h3>
                    <LandCoverBreakdown cover={result.land_cover} />
                  </div>

                  {/* Pre-development Baseline Comparison */}
                  <BaselineComparison score={Number(result.absorption_score)} />

                  {/* Observed 1609 land cover for this ground, where surveyed */}
                  <Historical1609Panel
                    state={welikia1609}
                    presentScore={Number(result.absorption_score)}
                  />

                  {/* Prioritized Climate Adaptation Recommendations */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Prioritized Interventions
                    </h3>
                    <RecommendationsList items={result.recommendations ?? []} />
                  </div>

                  {/* Quick Action to Trigger Simulation */}
                  <Button
                    onClick={() => {
                      setActiveTab("simulation");
                      runSimulation(false);
                    }}
                    className="w-full rounded-lg h-11 text-sm font-medium gap-2"
                  >
                    <Droplets className="h-4 w-4" /> Route {stormRainfallMm} mm design storm
                  </Button>
                </div>
              )}

              {/* TAB 2: STORMWATER RUNOFF SIMULATION */}
              {activeTab === "simulation" && isExample && analyzedBBox && (
                <ExampleStorm cover={result.land_cover} bbox={analyzedBBox} />
              )}
              {activeTab === "simulation" && (
                <div className="space-y-6">
                  <div className="panel rounded-xl border border-border p-4 space-y-4">
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Design Storm Hydrograph
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {stormRainfallMm} mm depth · 60-minute duration · D8 flow on{" "}
                        {simResult?.metadata.elevation_status === "observed"
                          ? "observed Terrarium terrain"
                          : simResult
                            ? "illustrative terrain"
                            : "Terrarium DEM with land-cover retention"}
                      </p>
                    </div>

                    {!simResult ? (
                      <Button
                        onClick={() => runSimulation(false)}
                        disabled={workflow.state === "STORM"}
                        className="w-full rounded-lg h-11 text-sm font-medium gap-2"
                      >
                        <Play className="h-4 w-4" /> Execute Simulation
                      </Button>
                    ) : (
                      <div className="space-y-4 pt-2">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-lg border border-border bg-background/50 p-3">
                            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                              Runoff volume
                            </span>
                            <div className="mt-1 font-mono text-xl font-bold">
                              {Math.round(simResult.metadata.runoff_volume_m3 ?? 0).toLocaleString()} m³
                            </div>
                          </div>
                          <div className="rounded-lg border border-border bg-background/50 p-3">
                            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                              Infiltrated volume
                            </span>
                            <div className="mt-1 font-mono text-xl font-bold text-primary">
                              {Math.round(
                                simResult.metadata.infiltrated_volume_m3 ??
                                  Math.max(
                                    0,
                                    (simResult.metadata.rainfall_volume_m3 ?? 0) -
                                      (simResult.metadata.runoff_volume_m3 ?? 0)
                                  )
                              ).toLocaleString()} m³
                            </div>
                          </div>
                          <div className="rounded-lg border border-border bg-background/50 p-3">
                            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                              Peak discharge
                            </span>
                            <div className="mt-1 font-mono text-xl font-bold text-warning">
                              {(simResult.metadata.peak_discharge_m3s ?? 0).toFixed(1)} m³/s
                            </div>
                          </div>
                          <div className="rounded-lg border border-border bg-background/50 p-3">
                            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                              Flow paths
                            </span>
                            <div className="mt-1 font-mono text-xl font-bold text-accent">
                              {simResult.flow_paths.length} vectors
                            </div>
                          </div>
                        </div>

                        {simResult.metadata.hydrograph &&
                          simResult.metadata.hydrograph.length > 1 && (
                            <StormHydrograph
                              series={simResult.metadata.hydrograph}
                              peakM3s={simResult.metadata.peak_discharge_m3s ?? 0}
                            />
                          )}

                        {simResult.metadata.rainfall_volume_m3 != null && (
                          <WaterBalanceMeter
                            balance={{
                              rainfallM3: simResult.metadata.rainfall_volume_m3,
                              infiltratedM3: simResult.metadata.infiltrated_volume_m3 ?? 0,
                              storedM3: simResult.metadata.stored_volume_m3 ?? 0,
                              runoffM3: simResult.metadata.runoff_volume_m3 ?? 0,
                              closureErrorM3: 0,
                            }}
                          />
                        )}

                        {simWarnings.length > 0 && (
                          <p className="text-[11px] leading-relaxed text-muted-foreground">
                            {simWarnings[0]}
                          </p>
                        )}

                        <div className="border-t border-border/60 pt-3 space-y-2">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Map visualization layers
                          </span>
                          <div className="flex items-center justify-between text-xs py-1">
                            <span className="text-foreground">Inundation risk heatmap</span>
                            <button
                              type="button"
                              onClick={() => setShowRiskHeatmap(!showRiskHeatmap)}
                              className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                            >
                              {showRiskHeatmap ? <Eye className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4" />}
                              <span>{showRiskHeatmap ? "Visible" : "Hidden"}</span>
                            </button>
                          </div>
                          <div className="flex items-center justify-between text-xs py-1">
                            <span className="text-foreground">Flow vectors (animated)</span>
                            <button
                              type="button"
                              onClick={() => setShowFlowVectors(!showFlowVectors)}
                              className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                            >
                              {showFlowVectors ? <Eye className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4" />}
                              <span>{showFlowVectors ? "Visible" : "Hidden"}</span>
                            </button>
                          </div>
                        </div>

                        <Button
                          onClick={() => {
                            workflow.advance("REDESIGN");
                            setActiveTab("mitigation");
                          }}
                          className="w-full rounded-lg h-10 text-xs font-medium gap-2"
                        >
                          <Paintbrush className="h-4 w-4" /> Open Mitigation Studio
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: GREEN INFRASTRUCTURE MITIGATION STUDIO */}
              {activeTab === "mitigation" && (
                <div className="space-y-6">
                  <div className="panel rounded-xl border border-border p-4 space-y-4">
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Green Infrastructure Design
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        Select interventions to model permeable retrofits and calculate runoff reduction.
                      </p>
                    </div>

                    <ScenarioStudio
                      cover={result.land_cover}
                      bbox={result.bbox}
                      scenario={scenario}
                      activeIntervention={activeIntervention}
                      onInterventionSelect={(key) => {
                        setActiveIntervention(activeIntervention === key ? null : key);
                        if (workflow.state !== "REDESIGN") {
                          workflow.advance("REDESIGN");
                        }
                      }}
                      onClearDrawings={() => editorRef.current?.clear()}
                      onScenarioExport={setScenarioExport}
                    />

                    <Button
                      onClick={() => runSimulation(true)}
                      className="w-full rounded-lg h-11 text-sm font-medium gap-2"
                    >
                      <Play className="h-4 w-4" /> Rerun the same storm on the mitigated surface
                    </Button>
                  </div>
                </div>
              )}

              {/* TAB 4: SCENARIO COMPARISON */}
              {activeTab === "compare" && (
                <div className="space-y-6">
                  <div className="panel rounded-xl border border-border p-4 space-y-4">
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Baseline vs. Mitigated Comparison
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {isExample
                          ? "The same sealed storm is routed over illustrative land cover, then over your drawn interventions."
                          : "The same sealed storm and terrain are routed over the current surface and the mitigated surface."}
                      </p>
                    </div>

                    {catalystFuture ? (
                      <div className="space-y-3 pt-2">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-lg border border-border bg-background/50 p-3">
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Baseline Score</span>
                            <div className="font-mono text-2xl font-bold">{catalystFuture.future.impact.baseScore.toFixed(0)}</div>
                            <span className="text-xs text-muted-foreground">{riskLabel(catalystFuture.future.impact.baseRisk)}</span>
                          </div>
                          <div className="rounded-lg border border-border bg-background/50 p-3">
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Mitigated Score</span>
                            <div className="font-mono text-2xl font-bold text-primary">
                              {catalystFuture.future.impact.projectedScore.toFixed(0)}
                            </div>
                            <span className="text-xs text-primary font-medium">
                              +{Math.round(catalystFuture.future.impact.scoreDelta)} pts
                            </span>
                          </div>
                        </div>

                        <div className="rounded-lg border border-border bg-background/50 p-3">
                          <div className="flex justify-between text-xs text-muted-foreground mb-1">
                            <span>Added Retention</span>
                            <span className="font-mono font-semibold text-foreground">
                              {Math.round(catalystFuture.future.impact.addedRetentionM3).toLocaleString()} m³/yr
                            </span>
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground mb-1">
                            <span>Estimated Investment</span>
                            <span className="font-mono font-semibold text-foreground">
                              ${Math.round(catalystFuture.future.impact.capexUSD).toLocaleString()}
                            </span>
                          </div>
                          {simResult?.metadata.runoff_volume_m3 != null &&
                            futureSimResult?.metadata.runoff_volume_m3 != null && (
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Routed storm runoff</span>
                                <span className="font-mono font-semibold text-foreground">
                                  {Math.round(simResult.metadata.runoff_volume_m3).toLocaleString()} →{" "}
                                  {Math.round(futureSimResult.metadata.runoff_volume_m3).toLocaleString()} m³
                                </span>
                              </div>
                            )}
                        </div>

                        <Button
                          onClick={() => workflow.advance("COMPARE")}
                          className="w-full rounded-lg h-10 text-xs font-medium gap-2"
                        >
                          <Compass className="h-4 w-4" /> Open split-screen comparison
                        </Button>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground py-4 text-center">
                        Configure interventions in the Mitigation tab and rerun the simulation to view comparative metrics.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 5: EXPORT & REPORTS */}
              {activeTab === "export" && (
                <div className="space-y-4">
                  <div className="panel rounded-xl border border-border p-4 space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Export Analysis Data & Reports
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Download publication-ready resilience dossiers and geospatial layer data for policy, GIS, and civil engineering workflows.
                    </p>

                    <div className="space-y-2 pt-2">
                      <Button
                        variant="outline"
                        onClick={handleExportPDF}
                        className="w-full justify-start gap-2.5 h-11 text-xs"
                      >
                        <FileText className="h-4 w-4 text-primary" />
                        <div className="text-left">
                          <div className="font-medium">Download PDF Resilience Dossier</div>
                          <div className="text-[10px] text-muted-foreground">Formatted report with charts and recommendations</div>
                        </div>
                      </Button>

                      <Button
                        variant="outline"
                        onClick={handleExportGeoJSON}
                        className="w-full justify-start gap-2.5 h-11 text-xs"
                      >
                        <FileJson className="h-4 w-4 text-accent" />
                        <div className="text-left">
                          <div className="font-medium">Export GeoJSON Feature Layers</div>
                          <div className="text-[10px] text-muted-foreground">Spatial boundary and land-cover polygons for QGIS/ArcGIS</div>
                        </div>
                      </Button>

                      <Button
                        variant="outline"
                        onClick={handleExportCSV}
                        className="w-full justify-start gap-2.5 h-11 text-xs"
                      >
                        <FileSpreadsheet className="h-4 w-4 text-warning" />
                        <div className="text-left">
                          <div className="font-medium">Export Attribute Table (CSV)</div>
                          <div className="text-[10px] text-muted-foreground">Tabular percentages and hydrologic scores</div>
                        </div>
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}

        {/* Expand Sidebar Tab Handle (when drawer is collapsed) */}
        {result && !drawerOpen && (
          <button
            onClick={() => setDrawerOpen(true)}
            className="absolute top-20 left-0 z-30 flex items-center gap-1.5 rounded-r-lg border border-l-0 border-border bg-card/95 px-3 py-2 text-xs font-medium text-foreground shadow-xl hover:bg-muted transition-colors backdrop-blur-md"
            title="Open Analysis Panel"
          >
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span>Analysis Panel</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </main>
    </div>
  );
}
