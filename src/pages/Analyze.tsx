import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
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
import { StormComparison } from "@/components/StormComparison";
import { ScenarioStudio } from "@/components/ScenarioStudio";
import { CompareRealities } from "@/components/catalyst/CompareRealities";
import { solveForTarget, projectFuture, DEFAULT_TARGET_SCORE } from "@/lib/catalyst";
import type { FutureState } from "@/lib/catalyst";
import type { Scenario, InterventionKey, ScenarioExport } from "@/lib/scenario";
import { EMPTY_SCENARIO, hasActiveInterventions } from "@/lib/scenario";
import { MapEditor, type MapEditorHandle } from "@/components/MapEditor";
import { riskLabel } from "@/lib/absorption";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  Play,
  Droplets,
  Paintbrush,
  Link2,
  FileText,
  FileSpreadsheet,
  FileJson,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  ArrowRight,
  ShieldCheck,
  Compass,
  Mountain,
  Check,
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
import { boundsToSimBBox, estimateRunoffVolumeM3 } from "@/lib/simulation";
import { generatePDFReport } from "@/lib/pdf-export";
import { toast } from "sonner";
import { TacticalHUD } from "@/components/tactical/TacticalHUD";
import { CommandPalette } from "@/components/tactical/CommandPalette";
import { StormRain } from "@/components/analyze/StormRain";
import { MapKey } from "@/components/analyze/MapKey";
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
  const workbenchScrollRef = useRef<HTMLDivElement>(null);

  // Each tab is its own page of the study; arriving mid-scroll from the last
  // one hides its heading and its first control.
  useEffect(() => {
    if (workbenchScrollRef.current) workbenchScrollRef.current.scrollTop = 0;
  }, [activeTab]);

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
      const target = event.target instanceof Element ? event.target : null;
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
  const requestGeneration = useRef(0);
  const pendingRequest = useRef<"analysis" | "storm" | null>(null);
  const invalidateRequests = useCallback(() => {
    requestGeneration.current += 1;
    pendingRequest.current = null;
  }, []);
  useEffect(() => invalidateRequests, [invalidateRequests]);

  const invalidateFuture = () => {
    if (pendingRequest.current === "storm") {
      invalidateRequests();
      workflow.advance("REDESIGN");
    }
    setFutureSimResult(null);
    setPossibleSeal(null);
    setCatalystFuture(null);
    setScenarioExport(null);
  };

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
    invalidateRequests();
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
    if (pendingRequest.current || !mapReady) return;
    setAnalysisError(null);
    resetScan();
    const generation = requestGeneration.current;
    pendingRequest.current = "analysis";
    workflow.advance("ANALYZING");
    setDrawerOpen(true);
    setActiveTab("overview");

    try {
      const bounds = mapRef.current?.getBounds() ?? null;
      const imageDataUrl = await mapRef.current?.captureImage();
      if (generation !== requestGeneration.current) return;
      if (!imageDataUrl) {
        setAnalysisError("Couldn’t capture imagery. Pan or zoom the map, then try again.");
        workflow.advance("SEARCH");
        return;
      }
      setCapturedTile(imageDataUrl);
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

      if (generation !== requestGeneration.current) return;
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
      if (generation !== requestGeneration.current) return;
      console.error(e);
      setAnalysisError("The scan could not finish. Try again, or explore the example below.");
      workflow.advance("SEARCH");
    } finally {
      if (generation === requestGeneration.current) pendingRequest.current = null;
    }
  };

  const runSimulation = async (isRerun = false) => {
    if (!result || pendingRequest.current) return;

    const bounds = analyzedBBox ?? (mapRef.current?.getBounds() as BBox | null);
    if (!bounds) {
      toast.error("No study extent is available yet.");
      return;
    }

    if (
      isRerun &&
      !interventionFeatures.some((feature) => feature.eligibility.eligible && feature.eligibility.validAreaM2 > 0)
    ) {
      toast.error("Draw a green-infrastructure polygon before rerunning the storm.");
      setActiveTab("mitigation");
      return;
    }

    const generation = requestGeneration.current;
    pendingRequest.current = "storm";
    setFutureSimResult(null);
    setPossibleSeal(null);
    setCatalystFuture(null);
    workflow.advance(isRerun ? "RERUN_STORM" : "STORM");
    setDrawerOpen(true);

    try {
      const extent = boundsToSimBBox(bounds);
      const stormDefinition =
        nowSeal?.storm ?? buildStormDefinition(stormRainfallMm, stormResolution);
      const seal = createStormSeal(stormDefinition);

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
      if (generation !== requestGeneration.current) return;

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
        if (generation !== requestGeneration.current) return;
        const areaM2 = bboxAreaKm2(bounds) * 1e6;
        const future = projectFuture(result.land_cover, scenario, areaM2);
        setSimResult(nowRun);
        setSimWarnings([...nowRun.warnings, ...possibleRun.warnings]);
        setNowSeal(seal);
        setPossibleSeal(seal);
        setFutureSimResult(possibleRun);
        setCatalystFuture({ scenario, future });
        workflow.advance("COMPARE");
        setActiveTab("compare");
        toast.success(
          possibleRun.waterBalance.runoffM3 < nowRun.waterBalance.runoffM3
            ? "Same storm, less runoff on the mitigated surface."
            : "Counterfactual storm complete."
        );
      } else {
        setSimResult(nowRun);
        setSimWarnings(nowRun.warnings);
        setNowSeal(seal);
        workflow.advance("STORM_COMPLETE");
        setActiveTab("simulation");
        toast.success(
          `${stormDefinition.rainfallDepthMm} mm design storm routed on ${nowRun.elevationStatus} terrain.`
        );
      }
    } catch (e) {
      if (generation !== requestGeneration.current) return;
      console.error(e);
      setPossibleSeal(null);
      setFutureSimResult(null);
      setCatalystFuture(null);
      toast.error("Hydrologic simulation failed. No new comparison was saved.");
      workflow.advance(isRerun ? "REDESIGN" : "ANALYZED");
    } finally {
      if (generation === requestGeneration.current) pendingRequest.current = null;
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
      <main id="main" className={cn("atlas-workspace relative flex-1 min-h-0 w-full overflow-hidden", (!result || (drawerOpen && workflow.state !== "COMPARE")) && "atlas-workspace--docked", workflow.state === "COMPARE" && "atlas-workspace--comparing")}>
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
          <div className="atlas-era-controls absolute right-4 top-3 z-30 max-w-[calc(100vw-2rem)]">
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
              onChange={(features) => { invalidateFuture(); setInterventionFeatures(features); }}
              cover={result.land_cover}
              onScenarioChange={(s) => { invalidateFuture(); setScenario(s); }}
              onDraftFeedback={(feedback) => {
                if (feedback && !feedback.eligible) toast.error("This drawing cannot be modeled.", { description: feedback.caveats.join(" ") || "Draw within the analyzed footprint." });
                else if (feedback?.invalidAreaM2 && feedback.invalidAreaM2 > 0.01) toast.info("Only the eligible part of this drawing is included.");
              }}
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
                      Click points, then click the first point to finish. <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono border">Esc</kbd> cancels.
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

          <StormRain
            raining={workflow.state === "STORM" || workflow.state === "RERUN_STORM"}
            rainfallMm={nowSeal?.storm.rainfallDepthMm ?? stormRainfallMm}
          />

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

        <MapKey
          place={(result ? result.location_label : locationLabel) || "Custom map view"}
          lat={view.lat}
          lng={view.lng}
          showFlow={Boolean(simResult && showFlowVectors && simResult.flow_paths.length > 0)}
          showPonding={Boolean(simResult && showRiskHeatmap && (simResult.risk_zones?.length ?? 0) > 0)}
          rainfallMm={simResult ? nowSeal?.storm.rainfallDepthMm : undefined}
        />
        {!result && workflow.state !== "ANALYZING" && (
          <aside className="atlas-intro" aria-label="Start a resilience study">
            <p className="atlas-intro-node" aria-hidden="true">
              {Math.abs(view.lat).toFixed(4)}° {view.lat >= 0 ? "N" : "S"} · {Math.abs(view.lng).toFixed(4)}° {view.lng >= 0 ? "E" : "W"} · z{view.zoom.toFixed(1)}
            </p>
            <div>
              <h1>A better future <br />starts with <br /><em>the ground.</em></h1>
              <p className="atlas-intro-copy">See how your city absorbs rain.{" "}<br />Explore the changes that could help it absorb more.</p>
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
              <Button variant="outline" onClick={resetScan}>Cancel analysis</Button>
            </div>
          </div>
        )}

        {/* 7. Active Simulation Banner */}
        {(workflow.state === "STORM" || workflow.state === "RERUN_STORM") && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40">
            <div className="panel rounded-full border border-primary/40 bg-card/95 px-6 py-3 shadow-2xl backdrop-blur-md flex items-center gap-3">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm font-medium text-foreground">
                {workflow.state === "STORM"
                  ? `Routing ${nowSeal?.storm.rainfallDepthMm ?? stormRainfallMm} mm of rain downhill…`
                  : "Routing the same storm over your redesign…"}
              </span>
            </div>
          </div>
        )}

        {/* 8. Docked Collapsible Workbench Drawer (When Analysis Results Exist) */}
        {result && (
          <aside
            aria-label="Urban Resilience Workbench"
            hidden={!drawerOpen || workflow.state === "COMPARE"}
            className={cn(
              "atlas-results absolute top-0 bottom-0 left-0 z-30 border-r border-border bg-card flex flex-col",
              drawerOpen ? "translate-x-0" : "-translate-x-full"
            )}
          >
            <div className="atlas-results-head">
              <div className="min-w-0">
                <h2 className="atlas-results-title">{result.location_label || result.name}</h2>
                <p className="atlas-results-meta">
                  {currentAreaKm2.toFixed(2)} km² · {Math.round(currentAreaKm2 * 100)} ha
                  {simResult ? ` · ${simResult.metadata.elevation_status === "observed" ? "observed" : "illustrative"} terrain` : ""}
                </p>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetScan}
                  className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1"
                  title="Reset and clear analysis"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDrawerOpen(false)}
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  title="Collapse panel"
                  aria-label="Collapse panel"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {isExample && <div className="atlas-example-notice"><strong>Illustrative example</strong><span>Explore the tools with sample data. Not a site assessment.</span></div>}

            <Tabs
              value={activeTab}
              onValueChange={(val) => setActiveTab(val as typeof activeTab)}
              className="atlas-steps shrink-0"
            >
              <TabsList className="atlas-steps-list">
                {([
                  { value: "overview", label: "Overview", done: true },
                  { value: "simulation", label: "Storm", done: Boolean(simResult) },
                  { value: "mitigation", label: "Mitigation", done: interventionFeatures.some((f) => f.eligibility.eligible) },
                  { value: "compare", label: "Compare", done: Boolean(catalystFuture) },
                  { value: "export", label: "Export", done: false },
                ] as const).map((step) => (
                  <TabsTrigger key={step.value} value={step.value} className="atlas-step" data-done={step.done || undefined}>
                    <span className="atlas-step-mark" aria-hidden="true">
                      {step.done && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                    </span>
                    {step.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <div ref={workbenchScrollRef} className="atlas-results-body flex-1 overflow-y-auto">
              {activeTab === "overview" && (
                <div className="atlas-tab">
                  {isExample && <p className="atlas-section-note">{result.ai_notes}</p>}

                  <section className="atlas-section atlas-section--lead">
                    <AbsorptionScoreGauge score={Number(result.absorption_score)} />
                  </section>

                  <BaselineComparison score={Number(result.absorption_score)} className="atlas-section" />

                  <section className="atlas-section" aria-labelledby="land-cover-title">
                    <h3 id="land-cover-title" className="atlas-section-title">What the ground is made of</h3>
                    <p className="atlas-section-note mb-4">Classified land cover and the hydrologic weight each class carries.</p>
                    <LandCoverBreakdown cover={result.land_cover} />
                  </section>

                  <Historical1609Panel
                    state={welikia1609}
                    presentScore={Number(result.absorption_score)}
                  />

                  <section className="atlas-section" aria-labelledby="recs-title">
                    <h3 id="recs-title" className="atlas-section-title mb-4">Where to start</h3>
                    <RecommendationsList items={result.recommendations ?? []} />
                  </section>

                  <div className="atlas-tab-footer">
                    <Button
                      onClick={() => {
                        setActiveTab("simulation");
                        runSimulation(false);
                      }}
                      disabled={workflow.state === "STORM" || workflow.state === "RERUN_STORM"}
                      className="atlas-primary w-full h-11 text-sm font-medium gap-2"
                    >
                      <Droplets className="h-4 w-4" /> Route {nowSeal?.storm.rainfallDepthMm ?? stormRainfallMm} mm design storm
                    </Button>
                  </div>
                </div>
              )}

              {activeTab === "simulation" && (
                <div className="atlas-tab">
                  <section className="atlas-section atlas-section--lead" aria-labelledby="storm-title">
                    <h3 id="storm-title" className="atlas-section-title">Where does the rain go?</h3>
                    <p className="atlas-section-note">
                      One hour of uniform rain, routed cell to cell down the steepest slope (D8) on{" "}
                      {simResult?.metadata.elevation_status === "observed"
                        ? "observed Terrarium terrain"
                        : simResult
                          ? "illustrative terrain"
                          : "Terrarium elevation"}
                      , with land cover setting how much each cell holds back.
                    </p>

                    <div className="atlas-control mt-5">
                      <label htmlFor="storm-rainfall" className="atlas-control-label">
                        <span>Rainfall depth</span>
                        <span className="atlas-control-value">
                          {nowSeal?.storm.rainfallDepthMm ?? stormRainfallMm}
                          <small>mm</small>
                        </span>
                      </label>
                      <input
                        id="storm-rainfall"
                        type="range"
                        min="5"
                        max="200"
                        step="5"
                        value={nowSeal?.storm.rainfallDepthMm ?? stormRainfallMm}
                        disabled={Boolean(nowSeal) || workflow.state === "STORM" || workflow.state === "RERUN_STORM"}
                        onChange={(event) => setStormRainfallMm(Number(event.target.value))}
                        className="atlas-range"
                        style={{ "--fill": `${(((nowSeal?.storm.rainfallDepthMm ?? stormRainfallMm) - 5) / 195) * 100}%` } as CSSProperties}
                      />
                      <div className="atlas-range-ticks" aria-hidden="true"><span>5 mm</span><span>200 mm</span></div>
                    </div>

                    <div className="atlas-control mt-5">
                      <span className="atlas-control-label" id="storm-resolution-label">Terrain resolution</span>
                      <div role="radiogroup" aria-labelledby="storm-resolution-label" className="atlas-segmented">
                        {(["low", "medium", "high"] as const).map((level) => (
                          <button
                            key={level}
                            type="button"
                            role="radio"
                            aria-checked={stormResolution === level}
                            disabled={Boolean(nowSeal) || workflow.state === "STORM" || workflow.state === "RERUN_STORM"}
                            onClick={() => setStormResolution(level)}
                          >
                            {level.charAt(0).toUpperCase() + level.slice(1)}
                            <small>{LOCAL_GRID[level]}²</small>
                          </button>
                        ))}
                      </div>
                    </div>

                    {analyzedBBox && (() => {
                      const depth = nowSeal?.storm.rainfallDepthMm ?? stormRainfallMm;
                      const rainVolume = bboxAreaKm2(analyzedBBox) * 1e6 * depth / 1000;
                      const estimate = estimateRunoffVolumeM3(result.land_cover, depth, analyzedBBox);
                      return (
                        <dl className="atlas-stats atlas-stats--estimate mt-5" aria-live="polite">
                          <div><dt>Rain on the site</dt><dd>{Math.round(rainVolume).toLocaleString()}<small>m³</small></dd></div>
                          <div><dt>Estimated runoff</dt><dd className="text-primary" data-testid="storm-estimate-runoff">{Math.round(estimate).toLocaleString()}<small>m³</small></dd></div>
                        </dl>
                      );
                    })()}
                    <p className="atlas-section-note mt-3">
                      Rational Method estimate: rainfall × area × weighted runoff coefficient. Routing adds the terrain: where the water travels, and where it collects.
                    </p>
                    {nowSeal && <p className="atlas-section-note mt-2">Storm settings are sealed so the redesign faces the same storm. Reset the study to choose another.</p>}

                    {!simResult && (
                      <Button
                        onClick={() => runSimulation(false)}
                        disabled={workflow.state === "STORM"}
                        className="atlas-primary mt-5 w-full h-11 text-sm font-medium gap-2"
                      >
                        {workflow.state === "STORM" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                        {workflow.state === "STORM" ? "Routing storm…" : `Route ${stormRainfallMm} mm storm`}
                      </Button>
                    )}
                  </section>

                  {simResult && (
                    <>
                      <section className="atlas-section" aria-labelledby="storm-result-title">
                        <h3 id="storm-result-title" className="atlas-section-title">What the storm did</h3>
                        <dl className="atlas-stats mt-4">
                          <div>
                            <dt>Runoff</dt>
                            <dd>{Math.round(simResult.metadata.runoff_volume_m3 ?? 0).toLocaleString()}<small>m³</small></dd>
                          </div>
                          <div>
                            <dt>Infiltrated</dt>
                            <dd className="text-primary">
                              {Math.round(
                                simResult.metadata.infiltrated_volume_m3 ??
                                  Math.max(
                                    0,
                                    (simResult.metadata.rainfall_volume_m3 ?? 0) -
                                      (simResult.metadata.runoff_volume_m3 ?? 0)
                                  )
                              ).toLocaleString()}<small>m³</small>
                            </dd>
                          </div>
                          <div>
                            <dt>Peak discharge</dt>
                            <dd>{(simResult.metadata.peak_discharge_m3s ?? 0).toFixed(1)}<small>m³/s</small></dd>
                          </div>
                          <div>
                            <dt>Flow paths</dt>
                            <dd>{simResult.flow_paths.length}<small>routed</small></dd>
                          </div>
                        </dl>

                        {simResult.metadata.hydrograph &&
                          simResult.metadata.hydrograph.length > 1 && (
                            <StormHydrograph
                              series={simResult.metadata.hydrograph}
                              peakM3s={simResult.metadata.peak_discharge_m3s ?? 0}
                            />
                          )}

                        {simResult.metadata.rainfall_volume_m3 != null && (
                          <WaterBalanceMeter
                            className="mt-6"
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
                          <p className="atlas-section-note mt-4">{simWarnings[0]}</p>
                        )}
                      </section>

                      <section className="atlas-section" aria-labelledby="layers-title">
                        <h3 id="layers-title" className="atlas-section-title">On the map</h3>
                        <div className="atlas-toggles mt-3">
                          <label className="atlas-toggle">
                            <span className="atlas-toggle-swatch atlas-toggle-swatch--pond" aria-hidden="true" />
                            <span className="flex-1">
                              Ponding depth
                              <small>Where routed water collects</small>
                            </span>
                            <Switch checked={showRiskHeatmap} onCheckedChange={setShowRiskHeatmap} aria-label="Show ponding depth" />
                          </label>
                          <label className="atlas-toggle">
                            <span className="atlas-toggle-swatch atlas-toggle-swatch--flow" aria-hidden="true" />
                            <span className="flex-1">
                              Flow paths
                              <small>Animated, source to outlet</small>
                            </span>
                            <Switch checked={showFlowVectors} onCheckedChange={setShowFlowVectors} aria-label="Show flow paths" />
                          </label>
                        </div>
                      </section>

                      <div className="atlas-tab-footer">
                        <Button
                          onClick={() => {
                            workflow.advance("REDESIGN");
                            setActiveTab("mitigation");
                          }}
                          className="atlas-primary w-full h-11 text-sm font-medium gap-2"
                        >
                          <Paintbrush className="h-4 w-4" /> Redesign the ground
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {activeTab === "mitigation" && (
                <div className="atlas-tab">
                  <section className="atlas-section atlas-section--lead" aria-labelledby="mitigation-title">
                    <h3 id="mitigation-title" className="atlas-section-title mb-2">Give the water somewhere to go</h3>

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
                  </section>

                  <section className="atlas-section">
                    <p className="atlas-section-note mb-4">
                      Explore rainfall sensitivity with a land-cover estimate, then route the same storm to compare drawn geometry with D8 terrain flow.
                    </p>
                    <StormComparison cover={result.land_cover} scenario={scenario} areaM2={currentAreaKm2 * 1e6} />
                  </section>

                  <div className="atlas-tab-footer">
                    <Button
                      disabled={workflow.state === "STORM" || workflow.state === "RERUN_STORM"}
                      onClick={() => runSimulation(true)}
                      className="atlas-primary w-full h-11 text-sm font-medium gap-2"
                    >
                      {workflow.state === "RERUN_STORM" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                      Rerun the same storm on the redesign
                    </Button>
                  </div>
                </div>
              )}

              {activeTab === "compare" && (
                <div className="atlas-tab">
                  <section className="atlas-section atlas-section--lead" aria-labelledby="compare-title">
                    <h3 id="compare-title" className="atlas-section-title">Same storm, two grounds</h3>
                    <p className="atlas-section-note">
                      {isExample
                        ? "The same sealed storm is routed over illustrative land cover, then over your drawn interventions."
                        : "The same sealed storm and terrain are routed over the current surface and the mitigated surface."}
                    </p>

                    {catalystFuture ? (
                      <>
                        <div className="atlas-versus mt-5">
                          <div>
                            <span>Today</span>
                            <strong>{catalystFuture.future.impact.baseScore.toFixed(0)}</strong>
                            <em>{riskLabel(catalystFuture.future.impact.baseRisk)} risk</em>
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          <div data-future>
                            <span>Redesigned</span>
                            <strong>{catalystFuture.future.impact.projectedScore.toFixed(0)}</strong>
                            <em>+{Math.round(catalystFuture.future.impact.scoreDelta)} pts</em>
                          </div>
                        </div>

                        <dl className="atlas-ledger mt-5">
                          {simResult?.metadata.runoff_volume_m3 != null &&
                            futureSimResult?.metadata.runoff_volume_m3 != null && (
                              <div>
                                <dt>Routed storm runoff</dt>
                                <dd>
                                  {Math.round(simResult.metadata.runoff_volume_m3).toLocaleString()} → {Math.round(futureSimResult.metadata.runoff_volume_m3).toLocaleString()} m³
                                </dd>
                              </div>
                            )}
                          <div>
                            <dt>Added retention</dt>
                            <dd>{Math.round(catalystFuture.future.impact.addedRetentionM3).toLocaleString()} m³/yr</dd>
                          </div>
                          <div>
                            <dt>Estimated investment</dt>
                            <dd>${Math.round(catalystFuture.future.impact.capexUSD).toLocaleString()}</dd>
                          </div>
                        </dl>

                        <Button
                          onClick={() => workflow.advance("COMPARE")}
                          className="atlas-primary mt-6 w-full h-11 text-sm font-medium gap-2"
                        >
                          <Compass className="h-4 w-4" /> Open split-screen comparison
                        </Button>
                      </>
                    ) : (
                      <div className="atlas-empty mt-5">
                        <p>Nothing to compare yet.</p>
                        <p>Draw at least one intervention in Mitigation, then rerun the same storm on the redesign.</p>
                        <Button variant="outline" size="sm" className="mt-4" onClick={() => setActiveTab("mitigation")}>
                          Go to Mitigation
                        </Button>
                      </div>
                    )}
                  </section>
                </div>
              )}

              {activeTab === "export" && (
                <div className="atlas-tab">
                  <section className="atlas-section atlas-section--lead" aria-labelledby="export-title">
                    <h3 id="export-title" className="atlas-section-title">Take the study with you</h3>
                    <p className="atlas-section-note">
                      Resilience dossiers and geospatial layers for policy, GIS, and civil engineering workflows.
                      {isExample ? " Example exports are labelled as illustrative." : ""}
                    </p>

                    <div className="atlas-exports mt-5">
                      <button type="button" onClick={handleExportPDF}>
                        <FileText className="h-4 w-4" aria-hidden="true" />
                        <span>
                          <strong>PDF resilience dossier</strong>
                          <small>Formatted report with charts and recommendations</small>
                        </span>
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button type="button" onClick={handleExportGeoJSON}>
                        <FileJson className="h-4 w-4" aria-hidden="true" />
                        <span>
                          <strong>GeoJSON feature layers</strong>
                          <small>Study boundary and land-cover attributes for QGIS or ArcGIS</small>
                        </span>
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button type="button" onClick={handleExportCSV}>
                        <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
                        <span>
                          <strong>Attribute table (CSV)</strong>
                          <small>Tabular percentages and hydrologic scores</small>
                        </span>
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </section>
                </div>
              )}
            </div>
          </aside>
        )}

        {/* Expand Sidebar Tab Handle (when drawer is collapsed) */}
        {result && !drawerOpen && workflow.state !== "COMPARE" && (
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
