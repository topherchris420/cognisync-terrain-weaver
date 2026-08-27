import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { AppNav } from "@/components/AppNav";
import { MapView, type MapViewHandle } from "@/components/MapView";
import { AbsorptionScoreGauge } from "@/components/AbsorptionScoreGauge";
import { LocationSearch } from "@/components/LocationSearch";
import { AnalyzingState } from "@/components/AnalyzingState";
import { FlowLayer } from "@/components/FlowLayer";
import { RiskHeatmap } from "@/components/RiskHeatmap";
import { LandCoverBreakdown } from "@/components/LandCoverBreakdown";
import { BaselineComparison } from "@/components/BaselineComparison";
import { RecommendationsList } from "@/components/RecommendationsList";
import { ScenarioStudio } from "@/components/ScenarioStudio";
import { CompareRealities } from "@/components/catalyst/CompareRealities";
import { solveForTarget, projectFuture, DEFAULT_TARGET_SCORE } from "@/lib/catalyst";
import type { FutureState } from "@/lib/catalyst";
import type { Scenario, InterventionKey, ScenarioExport } from "@/lib/scenario";
import { EMPTY_SCENARIO } from "@/lib/scenario";
import { MapEditor } from "@/components/MapEditor";
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

import type { StormDefinition, RealitySurface } from "@/lib/counterfactual/types";
import type { SimulationRequestV2 } from "@/lib/simulation-types";
import { stableHash } from "@/lib/counterfactual/hashing";
import {
  createStormSeal,
  checkStormDeterminism,
  type StormSeal,
  type DeterminismReport,
} from "@/lib/storm-identity";

const STORM_RAINFALL_MM = 50;
const STORM_RESOLUTION = "low" as const;

const DEFAULT_VIEW = { lat: 40.758, lng: -73.985, zoom: 15 };

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
  const [searchParams, setSearchParams] = useSearchParams();
  const initialView = useMemo(
    () => viewFromParams(searchParams) ?? DEFAULT_VIEW,
    []
  );

  const [name, setName] = useState("Lower Manhattan Watershed");
  const [locationLabel, setLocationLabel] = useState("Manhattan, NY");
  const [view, setView] = useState(initialView);
  const [mapReady, setMapReady] = useState(false);
  const [mapInstance, setMapInstance] = useState<MLMap | null>(null);
  
  const [result, setResult] = useState<AnalysisRecord | null>(null);
  const [capturedTile, setCapturedTile] = useState<string | null>(null);
  const [activeIntervention, setActiveIntervention] = useState<InterventionKey | null>(null);
  const [scenario, setScenario] = useState<Scenario>(EMPTY_SCENARIO);
  const [scenarioExport, setScenarioExport] = useState<ScenarioExport | null>(null);
  const [simResult, setSimResult] = useState<SimulationResponse | null>(null);
  const [futureSimResult, setFutureSimResult] = useState<SimulationResponse | null>(null);
  const [nowSeal, setNowSeal] = useState<StormSeal | null>(null);
  const [possibleSeal, setPossibleSeal] = useState<StormSeal | null>(null);

  // Layer visibility toggles
  const [showFlowVectors, setShowFlowVectors] = useState(true);
  const [showRiskHeatmap, setShowRiskHeatmap] = useState(true);

  // Workbench drawer state
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "simulation" | "mitigation" | "compare" | "export">("overview");

  // When an intervention tool becomes active, auto-collapse drawer for clear map view
  useEffect(() => {
    if (activeIntervention) {
      setDrawerOpen(false);
    }
  }, [activeIntervention]);

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

  const currentAreaKm2 = useMemo(() => {
    if (result) {
      const parsed = parseBBox(result.bbox);
      if (parsed) return bboxAreaKm2(parsed);
    }
    const bounds = mapRef.current?.getBounds();
    if (bounds) return bboxAreaKm2(bounds);
    return 0.85;
  }, [result, view]);

  const onViewChange = useCallback(
    (v: { lat: number; lng: number; zoom: number }) => {
      setView(v);
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
    setResult(null);
    setCapturedTile(null);
    setSimResult(null);
    setFutureSimResult(null);
    setCatalystFuture(null);
    setNowSeal(null);
    setPossibleSeal(null);
    setActiveIntervention(null);
    setScenario(EMPTY_SCENARIO);
    workflow.reset();
  };

  const runAnalysis = async () => {
    if (workflow.state === "ANALYZING" || !mapReady) return;
    workflow.advance("ANALYZING");
    setDrawerOpen(true);
    setActiveTab("overview");

    try {
      const imageDataUrl = await mapRef.current?.captureImage();
      if (!imageDataUrl) {
        toast.error("Couldn't capture map imagery. Try zooming or panning.");
        workflow.advance("SEARCH");
        return;
      }
      setCapturedTile(imageDataUrl);
      const bounds = mapRef.current?.getBounds() ?? null;

      const { data, error } = await supabase.functions.invoke("analyze-terrain", {
        body: {
          name: name.trim() || "Analyzed Site",
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
        toast.error("Analysis service temporarily unavailable.");
        workflow.advance("SEARCH");
        return;
      }

      const analysis = (data as { analysis: AnalysisRecord }).analysis;
      setResult(analysis);
      workflow.advance("ANALYZED");
      toast.success("Surface permeability analysis complete.");
    } catch (e) {
      console.error(e);
      toast.error("Unexpected error during analysis.");
      workflow.advance("SEARCH");
    }
  };

  const runSimulation = async (isRerun = false) => {
    if (!mapReady || workflow.state === "STORM" || workflow.state === "RERUN_STORM") return;
    
    workflow.advance(isRerun ? "RERUN_STORM" : "STORM");

    const bounds = mapRef.current?.getBounds() as BBox | null;
    if (!bounds) {
      toast.error("Map is initializing.");
      workflow.advance(isRerun ? "REDESIGN" : "ANALYZED");
      return;
    }

    try {
      const stormDefinition =
        nowSeal?.storm ?? buildStormDefinition(STORM_RAINFALL_MM, STORM_RESOLUTION);
      const seal = createStormSeal(stormDefinition);
      if (isRerun) {
        setPossibleSeal(seal);
      } else {
        setNowSeal(seal);
        setPossibleSeal(null);
      }

      const promises = [
        supabase.functions.invoke("run-simulation", {
          body: {
            bbox: boundsToSimBBox(bounds),
            rainfall_mm: stormDefinition.rainfallDepthMm,
            resolution: stormDefinition.resolution,
            include_drainage: stormDefinition.includeDrainage,
          },
        })
      ];

      if (isRerun && result) {
        const areaM2 = bboxAreaKm2(parseBBox(result.bbox)!) * 1e6;
        const newFuture = {
          scenario: scenario,
          future: projectFuture(result.land_cover, scenario, areaM2)
        };
        setCatalystFuture(newFuture);

        promises.push(supabase.functions.invoke("run-simulation", {
          body: {
            bbox: boundsToSimBBox(bounds),
            rainfall_mm: stormDefinition.rainfallDepthMm,
            resolution: stormDefinition.resolution,
            include_drainage: stormDefinition.includeDrainage,
          },
        }));
      }

      const results = await Promise.all(promises);
      const { data, error } = results[0];

      if (error) {
        console.error("run-simulation failed:", error);
        toast.error("Hydrologic simulation failed.");
        workflow.advance(isRerun ? "REDESIGN" : "ANALYZED");
        return;
      }

      const sim = data as SimulationResponse;
      setSimResult(sim);
      setActiveTab("simulation");
      
      if (results.length > 1 && !results[1].error) {
        setFutureSimResult(results[1].data as SimulationResponse);
        workflow.advance("COMPARE");
        setActiveTab("compare");
        toast.success("Counterfactual simulation complete.");
      } else {
        workflow.advance("STORM_COMPLETE");
        toast.success("50mm Design Storm modeled.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Error executing hydrodynamic simulation.");
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
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background text-foreground">
      {/* 1. Permanent Professional Workstation Topbar */}
      <AppNav />

      {/* 2. Main GIS Viewport Area */}
      <div className="relative flex-1 min-h-0 w-full overflow-hidden">
        {/* Full-bleed Map Canvas */}
        <div className="absolute inset-0 w-full h-full">
          <MapView
            ref={mapRef}
            initialCenter={[initialView.lng, initialView.lat]}
            initialZoom={initialView.zoom}
            onReady={() => {
              setMapReady(true);
              setMapInstance(mapRef.current?.getMap() ?? null);
            }}
            onViewChange={onViewChange}
          />

          {/* Hydrologic Inundation and Flow Vector Layers */}
          {simResult && showRiskHeatmap && (
            <RiskHeatmap map={mapInstance} riskZones={simResult.risk_zones ?? []} />
          )}
          {simResult && showFlowVectors && (
            <FlowLayer map={mapInstance} flowPaths={simResult.flow_paths ?? []} />
          )}

          {/* Interactive Direct Map Editor for Mitigations */}
          {workflow.state === "REDESIGN" && result && (
            <MapEditor
              map={mapInstance}
              bbox={result.bbox}
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
          absorptionScore={result ? Number(result.absorption_score) : 58.4}
          locationName={locationLabel || name}
        />

        <CommandPalette
          onSelectCity={(city) => goTo(city)}
          onRunSimulation={() => runSimulation(false)}
          onExportPdf={handleExportPDF}
        />

        {/* 3. Top Floating Location Toolbar & Presets Bar */}
        <div className="absolute top-4 left-4 right-4 md:left-6 md:right-auto z-30 flex flex-col md:flex-row items-stretch md:items-center gap-2 max-w-2xl">
          <div className="w-full md:w-80 shadow-lg rounded-lg bg-card/95 backdrop-blur-md border border-border">
            <LocationSearch onSelect={goTo} />
          </div>

          {/* Quick Watershed Jump Bookmarks */}
          <div className="hidden sm:flex items-center gap-1.5 overflow-x-auto p-1 rounded-lg bg-card/90 backdrop-blur-md border border-border shadow-md">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 flex items-center gap-1">
              <Compass className="h-3 w-3" /> Bookmarks:
            </span>
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => goTo(p)}
                className="px-2 py-1 rounded text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors whitespace-nowrap"
              >
                {p.label.split(",")[0]}
              </button>
            ))}
          </div>
        </div>

        {/* 4. Live Bottom-Right GPS Status Readout */}
        <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2">
          <button
            onClick={copyShareLink}
            title="Copy coordinate link"
            className="flex items-center gap-1.5 rounded-md border border-border bg-card/90 backdrop-blur-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shadow-md"
          >
            <Link2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Share</span>
          </button>
          <div className="rounded-md border border-border bg-card/90 backdrop-blur-md px-3 py-1.5 font-mono text-xs text-muted-foreground shadow-md">
            {view.lat.toFixed(4)}°N, {view.lng.toFixed(4)}°W · z{view.zoom.toFixed(1)}
          </div>
        </div>

        {/* 5. Analysis Execution Floating Card (When no result is yet computed) */}
        {!result && workflow.state !== "ANALYZING" && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 w-full max-w-md px-4">
            <div className="panel rounded-xl border border-border p-5 shadow-2xl backdrop-blur-md">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 text-primary border border-primary/30">
                    <Layers className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold">{locationLabel || "Target Region"}</h2>
                    <p className="text-xs text-muted-foreground">Area: {currentAreaKm2.toFixed(2)} km²</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-muted text-muted-foreground">
                  Ready to Scan
                </span>
              </div>

              <Button
                onClick={runAnalysis}
                disabled={!mapReady}
                className="w-full rounded-lg h-11 text-sm font-medium"
              >
                {!mapReady ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Initializing satellite imagery…</>
                ) : (
                  <><Droplets className="mr-2 h-4 w-4 text-accent" /> Scan Surface Permeability</>
                )}
              </Button>
            </div>
          </div>
        )}

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
                {workflow.state === "STORM" ? "Simulating 50mm / 2-hr design storm hydrograph…" : "Simulating mitigated watershed response…"}
              </span>
            </div>
          </div>
        )}

        {/* 8. Docked Collapsible Workbench Drawer (When Analysis Results Exist) */}
        {result && (
          <aside
            aria-label="Urban Resilience Workbench"
            className={cn(
              "absolute top-0 bottom-0 left-0 z-30 w-full sm:w-[460px] md:w-[480px] border-r border-border bg-card/95 backdrop-blur-xl shadow-2xl flex flex-col transition-transform duration-300 ease-in-out",
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
                    {bboxAreaKm2(parseBBox(result.bbox)!).toFixed(2)} km² · {Math.round(bboxAreaKm2(parseBBox(result.bbox)!) * 100)} ha
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
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
                    <Droplets className="h-4 w-4" /> Run 50mm Storm Simulation
                  </Button>
                </div>
              )}

              {/* TAB 2: STORMWATER RUNOFF SIMULATION */}
              {activeTab === "simulation" && (
                <div className="space-y-6">
                  <div className="panel rounded-xl border border-border p-4 space-y-4">
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Design Storm Hydrograph
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        50 mm depth · 60-minute duration · Uniform spatial distribution
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
                        {/* Simulation Metrics Grid */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-lg border border-border bg-background/50 p-3">
                            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                              Est. Runoff Volume
                            </span>
                            <div className="mt-1 font-mono text-xl font-bold">
                              {Math.round(simResult.metadata.runoff_volume_m3 ?? 0).toLocaleString()} m³
                            </div>
                          </div>
                          <div className="rounded-lg border border-border bg-background/50 p-3">
                            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                              Infiltrated Volume
                            </span>
                            <div className="mt-1 font-mono text-xl font-bold text-primary">
                              {Math.round((currentAreaKm2 * 1e6 * 0.05) - (simResult.metadata.runoff_volume_m3 ?? 0)).toLocaleString()} m³
                            </div>
                          </div>
                          <div className="rounded-lg border border-border bg-background/50 p-3">
                            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                              Risk Inundation Zones
                            </span>
                            <div className="mt-1 font-mono text-xl font-bold text-warning">
                              {simResult.risk_zones.length} zones
                            </div>
                          </div>
                          <div className="rounded-lg border border-border bg-background/50 p-3">
                            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                              Flow Path Vectors
                            </span>
                            <div className="mt-1 font-mono text-xl font-bold text-accent">
                              {simResult.flow_paths.length} vectors
                            </div>
                          </div>
                        </div>

                        {/* Layer Visibility Controls */}
                        <div className="border-t border-border/60 pt-3 space-y-2">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Map Visualization Layers
                          </span>
                          <div className="flex items-center justify-between text-xs py-1">
                            <span className="text-foreground">Inundation Risk Heatmap</span>
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
                            <span className="text-foreground">Flow Vectors (Animated)</span>
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
                      onScenarioExport={setScenarioExport}
                    />

                    <Button
                      onClick={() => runSimulation(true)}
                      className="w-full rounded-lg h-11 text-sm font-medium gap-2"
                    >
                      <Play className="h-4 w-4" /> Rerun Storm on Mitigated Surface
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
                        Side-by-side verification of water absorption gains under identical storm conditions.
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
                            <span>Peak Stormwater Retention</span>
                            <span className="font-mono font-semibold text-foreground">
                              {Math.round(catalystFuture.future.impact.addedRetentionM3).toLocaleString()} m³/yr
                            </span>
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Estimated Investment</span>
                            <span className="font-mono font-semibold text-foreground">
                              ${Math.round(catalystFuture.future.impact.capexUSD).toLocaleString()}
                            </span>
                          </div>
                        </div>

                        <Button
                          onClick={() => workflow.advance("COMPARE")}
                          className="w-full rounded-lg h-10 text-xs font-medium gap-2"
                        >
                          <Compass className="h-4 w-4" /> Open Split-Screen Comparison
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
      </div>
    </div>
  );
}
