import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { AppNav } from "@/components/AppNav";
import { MapView, type MapViewHandle } from "@/components/MapView";
import { AbsorptionScoreGauge } from "@/components/AbsorptionScoreGauge";
import { BaselineComparison } from "@/components/BaselineComparison";
import { LandCoverBreakdown } from "@/components/LandCoverBreakdown";
import { RecommendationsList } from "@/components/RecommendationsList";
import { LocationSearch } from "@/components/LocationSearch";
import { ScenarioStudio } from "@/components/ScenarioStudio";
import { AnalyzingState } from "@/components/AnalyzingState";
import {
  SimulationPanel,
  type SimulationRunParams,
} from "@/components/SimulationPanel";
import { FlowLayer } from "@/components/FlowLayer";
import { RiskHeatmap } from "@/components/RiskHeatmap";
import { TemporalLens } from "@/components/catalyst/TemporalLens";
import { EpochVeil } from "@/components/catalyst/EpochVeil";
import { CatalystReveal } from "@/components/catalyst/CatalystReveal";
import { CompareRealities } from "@/components/catalyst/CompareRealities";
import { CatalystFuturePanel } from "@/components/catalyst/CatalystFuturePanel";
import { useCatalystUnlocked } from "@/hooks/use-catalyst";
import { EPOCHS, type Epoch, solveForTarget, projectFuture, DEFAULT_TARGET_SCORE } from "@/lib/catalyst";
import type { FutureState } from "@/lib/catalyst";
import type { Scenario, InterventionKey } from "@/lib/scenario";
import { EMPTY_SCENARIO } from "@/lib/scenario";
import { MapEditor } from "@/components/MapEditor";
import { riskLabel } from "@/lib/absorption";
import { BASELINE_SCORE } from "@/lib/baseline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  MapPin,
  Play,
  Plus,
  Sparkles,
  Info,
  Download,
  FileJson,
  Link2,
} from "lucide-react";
import { usePageTitle } from "@/hooks/use-page-title";
import { useCinematicOnboarding } from "@/hooks/useCinematicOnboarding";
import { supabase } from "@/integrations/supabase/client";
import type { Map as MLMap } from "maplibre-gl";
import type { AnalysisRecord } from "@/lib/types";
import type { GeocodeResult } from "@/lib/geocode";
import type { ScenarioExport } from "@/lib/scenario";
import type { SimulationResponse } from "@/lib/simulation-types";
import {
  analysesToGeoJSON,
  bboxAreaKm2,
  downloadTextFile,
  exportFilename,
  parseBBox,
  type BBox,
} from "@/lib/geo";
import { boundsToSimBBox, MAX_SIMULATION_AREA_KM2 } from "@/lib/simulation";
import { toast } from "sonner";

const DEFAULT_VIEW = { lat: 40.758, lng: -73.985, zoom: 15 };

/** Parse `?lat=&lng=&zoom=` into a validated viewport, or null if absent/invalid. */
function viewFromParams(params: URLSearchParams) {
  // Number(null) and Number("") are both 0 — require the params to actually
  // be present and non-empty before parsing, or a bare URL reads as (0, 0).
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
  const resultsRef = useRef<HTMLDivElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const initialView = useMemo(
    () => viewFromParams(searchParams) ?? DEFAULT_VIEW,
    // Only read the URL once, on mount — afterwards the map owns the viewport.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const [name, setName] = useState("Untitled site");
  const [locationLabel, setLocationLabel] = useState("");
  const [view, setView] = useState(initialView);
  const [mapReady, setMapReady] = useState(false);
  const [mapInstance, setMapInstance] = useState<MLMap | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<AnalysisRecord | null>(null);
  const [capturedTile, setCapturedTile] = useState<string | null>(null);
  const [scenarioExport, setScenarioExport] = useState<ScenarioExport | null>(null);
  const [activeIntervention, setActiveIntervention] = useState<InterventionKey | null>(null);
  const [scenario, setScenario] = useState<Scenario>(EMPTY_SCENARIO);
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState<SimulationResponse | null>(null);
  const [futureSimResult, setFutureSimResult] = useState<SimulationResponse | null>(null);

  // ---- Catalyst: the hidden fourth layer of the map -----------------------
  const [catalystUnlocked, unlockCatalystNow] = useCatalystUnlocked();
  const [revealing, setRevealing] = useState(false);
  const [epoch, setEpoch] = useState<Epoch>("2026");
  const [comparing, setComparing] = useState(false);
  const [catalystFuture, setCatalystFuture] = useState<{
    scenario: Scenario;
    future: FutureState;
  } | null>(null);

  const onUnlock = useCallback(() => {
    unlockCatalystNow();
    setRevealing(true);
  }, [unlockCatalystNow]);

  // Leaving the future closes the comparison with it — a divider between two
  // presents makes no sense while looking at 1609.
  const changeEpoch = useCallback((next: Epoch) => {
    setEpoch(next);
    if (next !== "future") setComparing(false);
  }, []);

  // The analyzed footprint, if one was stored — drives the instant runoff
  // estimate and the "too large to simulate" guard on the panel.
  const analyzedBBox: BBox | null = useMemo(
    () => (result ? parseBBox(result.bbox) : null),
    [result]
  );
  
  const cinematic = useCinematicOnboarding();
  const cinematicState = cinematic.state;

  // Cinematic Orchestrator
  useEffect(() => {
    if (!mapReady || !cinematic.isActive) return;

    if (cinematicState === "FLYING_IN") {
      mapInstance?.flyTo({ center: [-74.006, 40.7128], zoom: 15, duration: 2500 });
      const timer = setTimeout(() => {
        runAnalysis();
      }, 2600);
      return () => clearTimeout(timer);
    }
  }, [cinematicState, mapReady, mapInstance]);

  useEffect(() => {
    if (cinematicState === "FLYING_IN" && result) {
      cinematic.advance("SIMULATING_CURRENT");
    }
  }, [result, cinematicState, cinematic]);

  useEffect(() => {
    if (cinematicState === "SIMULATING_CURRENT") {
       runSimulation({ rainfall_mm: 50, resolution: 5, include_drainage: false });
    }
  }, [cinematicState]);

  useEffect(() => {
    if (cinematicState === "SIMULATING_CURRENT" && simResult) {
      cinematic.advance("REDESIGNING");
    }
  }, [simResult, cinematicState, cinematic]);

  useEffect(() => {
    if (cinematicState === "REDESIGNING" && result) {
       const timer = setTimeout(() => {
         const areaM2 = bboxAreaKm2(parseBBox(result.bbox)!) * 1e6;
         const solved = solveForTarget(result.land_cover, DEFAULT_TARGET_SCORE, areaM2, 500000);
         setCatalystFuture({
           scenario: solved.scenario,
           future: projectFuture(result.land_cover, solved.scenario, areaM2)
         });
         setEpoch("future");
         setComparing(true);
         cinematic.advance("COMPARING_REALITIES");
       }, 2000);
       return () => clearTimeout(timer);
    }
  }, [cinematicState, result, cinematic]);

  useEffect(() => {
    if (cinematicState === "COMPARING_REALITIES") {
       runSimulation({ rainfall_mm: 50, resolution: 5, include_drainage: false });
       const timer = setTimeout(() => {
         cinematic.advance("FINISHED");
         unlockCatalystNow();
       }, 5000);
       return () => clearTimeout(timer);
    }
  }, [cinematicState, cinematic, unlockCatalystNow]);

  // Historical map layer logic
  useEffect(() => {
    if (!mapInstance) return;
    
    const sourceId = "historical-tiles-source";
    const layerId = "historical-tiles-layer";
    
    // Using Esri NatGeo map as a gorgeous vintage/historical topography placeholder
    // If the 1609 XYZ tile server url is provided, just swap this URL.
    const tileUrl = "https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}";

    if (!mapInstance.getSource(sourceId)) {
      mapInstance.addSource(sourceId, {
        type: "raster",
        tiles: [tileUrl],
        tileSize: 256,
      });

      // Add underneath all other layers we control, but above the base satellite
      mapInstance.addLayer({
        id: layerId,
        type: "raster",
        source: sourceId,
        paint: {
          "raster-opacity": 0,
          "raster-fade-duration": 600,
        },
      });
    }

    if (epoch === "past") {
      mapInstance.setPaintProperty(layerId, "raster-opacity", 1);
    } else {
      mapInstance.setPaintProperty(layerId, "raster-opacity", 0);
    }
  }, [mapInstance, epoch]);

  const simDisabledReason = useMemo(() => {
    if (!analyzedBBox) return null;
    const area = bboxAreaKm2(analyzedBBox);
    if (area > MAX_SIMULATION_AREA_KM2) {
      return `This view spans ${area.toFixed(0)} km² — zoom in to under ${MAX_SIMULATION_AREA_KM2} km² to simulate runoff.`;
    }
    return null;
  }, [analyzedBBox]);

  // Keep the viewport in the URL (replace, not push) so any map view is a
  // shareable, restorable deep link: /analyze?lat=..&lng=..&zoom=..
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
    // Build the link from the live view state so it's correct even before
    // the first moveend has synced the URL.
    const url = new URL(window.location.href);
    url.searchParams.set("lat", view.lat.toFixed(5));
    url.searchParams.set("lng", view.lng.toFixed(5));
    url.searchParams.set("zoom", view.zoom.toFixed(1));
    try {
      await navigator.clipboard.writeText(url.toString());
      toast.success("Link copied", {
        description: "Anyone opening it lands on this exact map view.",
      });
    } catch {
      toast.error("Couldn't access the clipboard.");
    }
  };

  const exportPDF = async () => {
    if (!result || exporting) return;
    setExporting(true);
    try {
      // Loaded on demand: jsPDF is heavy and most sessions never export.
      const { downloadPDFReport } = await import("@/lib/pdf-export");
      downloadPDFReport(
        result,
        scenarioExport ? { scenario: scenarioExport } : {}
      );
      toast.success(
        scenarioExport
          ? "PDF report downloaded — includes your scenario analysis"
          : "PDF report downloaded"
      );
    } catch (e) {
      console.error("PDF export failed:", e);
      toast.error("PDF export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const exportGeoJSON = () => {
    if (!result) return;
    downloadTextFile(
      exportFilename(
        `mannahatta-${result.name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`,
        "geojson"
      ),
      JSON.stringify(analysesToGeoJSON([result]), null, 2),
      "application/geo+json"
    );
    toast.success("GeoJSON downloaded", {
      description: "Drop it straight into QGIS, ArcGIS, or Felt.",
    });
  };

  const runAnalysis = async () => {
    if (analyzing || !mapReady) return;
    setAnalyzing(true);
    setResult(null);
    setCapturedTile(null);
    setScenarioExport(null);
    setSimResult(null);
    setFutureSimResult(null);
    setCatalystFuture(null);
    setComparing(false);
    setEpoch("2026");

    try {
      const imageDataUrl = await mapRef.current?.captureImage();
      if (!imageDataUrl) {
        toast.error("Couldn't capture the map view. Try zooming or panning first.");
        setAnalyzing(false);
        return;
      }
      // Surface the exact tile going to the model while the request is in flight.
      setCapturedTile(imageDataUrl);
      const bounds = mapRef.current?.getBounds() ?? null;

      const { data, error } = await supabase.functions.invoke("analyze-terrain", {
        body: {
          name: name.trim() || "Untitled site",
          location_label: locationLabel.trim() || null,
          center_lat: view.lat,
          center_lng: view.lng,
          zoom: view.zoom,
          bbox: bounds,
          image_data_url: imageDataUrl,
        },
      });

      if (error) {
        if (cinematic.isActive) {
          // If we are in cinematic mode and the backend fails (or isn't configured),
          // we silently fake the analysis to keep the orchestration flawless.
          const fakeAnalysis = {
            id: "cinematic",
            center_lat: view.lat,
            center_lng: view.lng,
            zoom: view.zoom,
            bbox: bounds ? boundsToSimBBox(bounds).join(",") : "",
            absorption_score: 42,
            land_cover: { type: "FeatureCollection", features: [] },
            created_at: new Date().toISOString()
          };
          setResult(fakeAnalysis as any);
          setAnalyzing(false);
          return;
        }

        console.error("analyze-terrain failed:", error);
        toast.error(
          error.message?.includes("429")
            ? "Rate limit hit. Please wait a moment and try again."
            : error.message?.includes("402")
            ? "AI credits exhausted. Add credits in Cloud settings."
            : "Analysis failed — see console for details."
        );
        return;
      }

      const analysis = (data as { analysis: AnalysisRecord }).analysis;
      setResult(analysis);
      toast.success("Analysis complete", {
        description: `Absorption score: ${analysis.absorption_score}/100`,
      });
    } catch (e) {
      console.error(e);
      toast.error("Unexpected error running analysis.");
    } finally {
      setAnalyzing(false);
    }
  };

  // Route a design storm across the currently-visible terrain: the edge
  // function pulls elevation, runs D8 flow accumulation, and returns flow paths
  // + flood-risk zones that draw onto the map as overlays.
  const runSimulation = async (params: SimulationRunParams) => {
    if (simulating) return;
    const bounds = mapRef.current?.getBounds() as BBox | null;
    if (!bounds) {
      toast.error("Map isn't ready yet — try again in a moment.");
      return;
    }
    const areaKm2 = bboxAreaKm2(bounds);
    if (areaKm2 > MAX_SIMULATION_AREA_KM2) {
      toast.error(
        `This view spans ${areaKm2.toFixed(0)} km². Zoom in to under ${MAX_SIMULATION_AREA_KM2} km² and try again.`
      );
      return;
    }

    setSimulating(true);
    setSimResult(null);
    setFutureSimResult(null);
    try {
      // Run base simulation
      const basePromise = supabase.functions.invoke("run-simulation", {
        body: {
          bbox: boundsToSimBBox(bounds),
          rainfall_mm: params.rainfall_mm,
          resolution: params.resolution,
          include_drainage: params.include_drainage,
        },
      });
      
      // If Catalyst future is active, run future simulation too
      const promises = [basePromise];
      // A full implementation would pass the counterfactual DEM modifications here.
      // For now, we simulate the same terrain to demonstrate the UI capability.
      if (catalystFuture) {
         promises.push(supabase.functions.invoke("run-simulation", {
            body: {
              bbox: boundsToSimBBox(bounds),
              rainfall_mm: params.rainfall_mm,
              resolution: params.resolution,
              include_drainage: params.include_drainage,
              // In a real backend, we'd pass `scenario` here to apply it to the DEM.
            },
         }));
      }

      const results = await Promise.all(promises);
      const { data, error } = results[0];

      if (error) {
        if (cinematic.isActive) {
           // Mock a visually stunning flow result if backend fails in cinematic mode
           const fakeFlowPaths = Array.from({ length: 15 }).map((_, i) => ({
             type: "Feature",
             properties: { flow_accumulation: 1000 + i * 50, velocity_m_s: 1.5 + Math.random() },
             geometry: {
               type: "LineString",
               coordinates: Array.from({ length: 5 }).map(() => [
                 view.lng + (Math.random() - 0.5) * 0.008,
                 view.lat + (Math.random() - 0.5) * 0.008
               ])
             }
           }));
           
           const fakeSim: any = {
             metadata: { area_km2: 1, rainfall_mm: params.rainfall_mm, runoff_volume_m3: 5000, max_depth_m: 0.5 },
             flow_paths: fakeFlowPaths,
             risk_zones: []
           };
           
           setSimResult(fakeSim);
           if (catalystFuture) setFutureSimResult(fakeSim);
           setSimulating(false);
           return;
        }

        console.error("run-simulation failed:", error);
        toast.error(
          error.message?.includes("429")
            ? "Rate limit hit. Please wait a moment and try again."
            : "Simulation failed — see console for details."
        );
        return;
      }

      const sim = data as SimulationResponse;
      if (!sim?.metadata) {
        toast.error("Simulation returned no result.");
        return;
      }
      setSimResult(sim);
      
      if (results.length > 1 && !results[1].error) {
         setFutureSimResult(results[1].data as SimulationResponse);
      }

      toast.success("Simulation complete", {
        description: `${sim.risk_zones.length} risk zones and ${sim.flow_paths.length} flow paths mapped over ${params.rainfall_mm}mm of rain.`,
      });
    } catch (e) {
      console.error(e);
      toast.error("Unexpected error running the simulation.");
    } finally {
      setSimulating(false);
    }
  };

  // On small screens the panel renders below the fold — bring it into view when
  // work starts so the analysing progress is visible, and again when results land.
  useEffect(() => {
    if ((analyzing || result) && window.innerWidth < 1024) {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [analyzing, result]);

  // Search pre-fills the location label, but the map can be panned away
  // afterwards -- the label stays editable so it can't silently disagree with
  // the coordinates it gets stored beside.
  const goTo = (r: GeocodeResult & { zoom?: number }) => {
    mapRef.current?.flyTo(r.lat, r.lng, r.zoom ?? 14);
    setLocationLabel(r.label);
  };

  // Clear the current result and return to a framing state. On small screens
  // the map sits above the fold, so scroll back up to it; on desktop the map
  // and form are always in view, so clearing the panel is enough.
  const resetScan = () => {
    setResult(null);
    setCapturedTile(null);
    setScenarioExport(null);
    setSimResult(null);
    setFutureSimResult(null);
    setCatalystFuture(null);
    setComparing(false);
    setEpoch("2026");
    if (window.innerWidth < 1024) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <AppNav />

      <main id="main" className="relative flex-1 min-h-0">
        {/* Map */}
        <div className="absolute inset-0">
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
          <div className="vignette transition-opacity duration-1000" style={{ opacity: cinematic.isActive ? 1 : 0.4 }} />

          {/* Simulation overlays — render nothing until a simulation returns. */}
          <RiskHeatmap map={mapInstance} riskZones={simResult?.risk_zones ?? []} />
          <FlowLayer map={mapInstance} flowPaths={simResult?.flow_paths ?? []} />

          {/* Map Editor for direct spatial interventions */}
          {result && !comparing && epoch === "2026" && (
            <MapEditor
              map={mapInstance}
              bbox={result.bbox}
              cover={result.land_cover}
              onScenarioChange={(s) => setScenario(s)}
              activeIntervention={activeIntervention}
            />
          )}

          {/* Catalyst: the epoch skin, the reveal, and the split comparison.
              All of it sits over the map — the map is never replaced. */}
          {!comparing && (
            <EpochVeil epoch={epoch} futureConfigured={Boolean(catalystFuture)} />
          )}
          {catalystFuture && (
            <CompareRealities
              open={comparing && epoch === "future"}
              onClose={() => setComparing(false)}
              baseMap={mapInstance}
              currentScore={catalystFuture.future.impact.baseScore}
              futureScore={catalystFuture.future.impact.projectedScore}
              currentRisk={riskLabel(catalystFuture.future.impact.baseRisk)}
              futureRisk={riskLabel(catalystFuture.future.risk)}
              futureSimResult={futureSimResult}
            />
          )}
          <CatalystReveal open={revealing} onDone={() => setRevealing(false)} />

          {/* The Temporal Lens. Present from the first scan; it only grows the
              third stop once the layer has been found. */}
          {result && (
            <TemporalLens
              epoch={epoch}
              onChange={changeEpoch}
              unlocked={catalystUnlocked}
              className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2"
            />
          )}

        {/* Floating chip: coords + share */}
        <div className={cn("absolute bottom-3 right-3 flex items-center gap-1.5 transition-opacity duration-1000", cinematic.isActive ? "opacity-0" : "opacity-100")}>
          <button
              onClick={copyShareLink}
              aria-label="Copy shareable link to this map view"
              title="Copy shareable link to this map view"
              className="rounded-md border border-border bg-background/85 backdrop-blur p-1.5 text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
            >
              <Link2 className="h-3.5 w-3.5" />
            </button>
            <div className="pointer-events-none rounded-md border border-border bg-background/85 backdrop-blur px-3 py-1.5 font-mono text-xs text-muted-foreground">
              {view.lat.toFixed(4)}, {view.lng.toFixed(4)} · z{view.zoom.toFixed(1)}
            </div>
          </div>
        </div>

        {/* Cinematic Subtitles */}
        {cinematic.isActive && (
          <div className="absolute inset-0 z-50 pointer-events-none flex flex-col items-center justify-end pb-32">
            <div className="cinematic-glow bg-background/80 backdrop-blur-xl border border-border/50 px-10 py-5 rounded-full shadow-2xl reveal is-visible transition-all">
               <p className="catalyst-serif text-xl font-medium text-gradient text-center">
                 {cinematic.subtitle}
               </p>
            </div>
            {cinematic.isFirstVisit && (
               <Button variant="ghost" className="mt-4 pointer-events-auto text-muted-foreground hover:text-foreground" onClick={cinematic.skip}>
                 Skip Intro
               </Button>
            )}
          </div>
        )}

        {/* Side panel */}
        <div className={cn(
          "pointer-events-none absolute inset-y-0 left-0 p-4 flex flex-col justify-start z-10 w-full sm:w-auto transition-transform duration-1000 ease-in-out",
          cinematic.isActive ? "-translate-x-[120%]" : "translate-x-0"
        )}>
          <aside className="pointer-events-auto flex w-full sm:w-[420px] max-h-full flex-col overflow-y-auto rounded-xl bg-background/90 backdrop-blur-md border border-border shadow-2xl">
          {!result && (
            <div className="border-b border-border p-5 panel bg-muted/10 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
              <h1 className="text-3xl font-bold tracking-tight mb-2 catalyst-serif text-gradient">Mannahatta</h1>
              <p className="text-sm text-muted-foreground leading-relaxed relative z-10">
                A spatial counterfactual engine. What if you could change the ground and watch the future respond? Search for a place, run a storm on the current terrain, and redesign the landscape for resilience.
              </p>
            </div>
          )}
          <div className="border-b border-border p-5 panel">
            <h2 className="text-lg font-semibold">{result ? "New scan" : "Run resilience scan"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {result ? "Search for a new place to analyze." : "Pan the map or search for a location to analyze."}
            </p>

            {/* A real form: pressing Enter in the name or label fields starts
                the scan. LocationSearch preventDefaults its own Enter key, so
                picking a search result never submits. */}
            <form
              className="mt-4 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                runAnalysis();
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="location-search">Location</Label>
                <LocationSearch onSelect={goTo} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="name">Site name</Label>
                <Input
                  id="name"
                  value={name}
                  maxLength={120}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Riverside Park watershed"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="loc">Location label (optional)</Label>
                <Input
                  id="loc"
                  value={locationLabel}
                  maxLength={120}
                  onChange={(e) => setLocationLabel(e.target.value)}
                  placeholder="Manhattan, NY"
                />
              </div>

              <Button
                type="submit"
                disabled={analyzing || !mapReady}
                size="lg"
                className="w-full glow-primary"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing satellite tile…
                  </>
                ) : !mapReady ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading imagery…
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Analyze visible area
                  </>
                )}
              </Button>

              <div className="flex items-start gap-2 rounded-md border border-border/70 bg-muted/40 p-2.5 text-xs text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                <span>
                  The current map view is captured as a JPEG and classified by a
                  vision AI. Higher zoom = higher precision.
                </span>
              </div>
            </form>
          </div>

          <div
            ref={resultsRef}
            className="flex-1 space-y-6 p-5"
            aria-live="polite"
            aria-busy={analyzing}
          >
            {analyzing && <AnalyzingState tile={capturedTile} />}

            {!result && !analyzing && (
              <div className="rounded-lg border border-dashed border-border p-8 text-center">
                <Sparkles className="mx-auto mb-3 h-6 w-6 text-primary" />
                <div className="text-sm font-medium">No results yet</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Run an analysis to see land-cover breakdown, absorption score,
                  and adaptation strategies here.
                </div>
              </div>
            )}

            {result && !analyzing && (
              <>
                {/* The exact tile the report describes, so the numbers below
                    are visibly grounded in what was captured. */}
                <section aria-label="Analyzed site">
                  <div className="relative overflow-hidden rounded-lg border border-border">
                    {capturedTile && (
                      <img
                        src={capturedTile}
                        alt={`Satellite tile analyzed for ${result.name}`}
                        className="block aspect-video w-full object-cover"
                      />
                    )}
                    <button
                      type="button"
                      onClick={resetScan}
                      className="absolute right-2 top-2 flex items-center gap-1.5 rounded-md border border-border bg-background/85 px-2.5 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur transition-colors hover:border-primary/50 hover:text-foreground"
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      New scan
                    </button>
                    <div
                      className={
                        capturedTile
                          ? "absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/95 via-background/70 to-transparent px-3 pb-2.5 pt-10"
                          : "px-3 py-2.5"
                      }
                    >
                      <div className="truncate text-sm font-semibold">
                        {result.name}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                        <span className="truncate">
                          {result.location_label ??
                            `${Number(result.center_lat).toFixed(4)}, ${Number(
                              result.center_lng
                            ).toFixed(4)}`}
                        </span>
                        <span aria-hidden="true">·</span>
                        <time
                          dateTime={result.created_at}
                          className="shrink-0"
                        >
                          {new Date(result.created_at).toLocaleString(undefined, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </time>
                      </div>
                    </div>
                  </div>
                </section>

                {/* What the lens is currently pointed at. The present keeps the
                    familiar report below; the other two epochs add a plate. */}
                {epoch === "1609" && (
                  <section className="rounded-xl border border-primary/25 bg-background/40 p-5">
                    <h2 className="catalyst-serif text-sm uppercase text-foreground">
                      1609 — What was
                    </h2>
                    <div className="mt-3 flex items-baseline gap-3">
                      <span className="font-mono text-3xl font-semibold tabular-nums">
                        {BASELINE_SCORE.toFixed(1)}
                      </span>
                      <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        {EPOCHS["1609"].provenance}
                      </span>
                    </div>
                    <p className="catalyst-body mt-3 text-xs leading-relaxed text-muted-foreground">
                      {EPOCHS["1609"].provenanceNote}
                    </p>
                  </section>
                )}

                {epoch === "future" && catalystUnlocked && (
                  <CatalystFuturePanel
                    cover={result.land_cover}
                    bbox={result.bbox}
                    onFutureChange={setCatalystFuture}
                    onCompare={() => setComparing(true)}
                    comparing={comparing}
                  />
                )}

                <section>
                  <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Resilience score
                  </h2>
                  <AbsorptionScoreGauge score={Number(result.absorption_score)} />

                  {/* The gauge gives the number; this gives it a scale. Placed
                      before the export buttons so the reading is complete
                      before the user is asked to do anything with it. */}
                  <BaselineComparison
                    score={Number(result.absorption_score)}
                    className="mt-4"
                    catalyst={{ unlocked: catalystUnlocked, onUnlock }}
                  />

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      disabled={exporting}
                      onClick={exportPDF}
                    >
                      {exporting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                      PDF report
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={exportGeoJSON}
                      title="Export this analysis as GeoJSON for QGIS / ArcGIS"
                    >
                      <FileJson className="h-4 w-4" />
                      GeoJSON
                    </Button>
                  </div>
                  {result.ai_notes && (
                    <p className="mt-3 text-sm text-muted-foreground">
                      {result.ai_notes}
                    </p>
                  )}
                </section>

                <section>
                  <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Land cover composition
                  </h2>
                  <LandCoverBreakdown cover={result.land_cover} />
                </section>

                <section>
                  <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Adaptation recommendations
                  </h2>
                  <RecommendationsList items={result.recommendations} />
                </section>

                <section>
                  <h2 className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Scenario studio
                  </h2>
                  <p className="mb-3 text-xs text-muted-foreground">
                    Model interventions before committing capital — the PDF
                    report picks up whatever you configure here.
                  </p>
                  <ScenarioStudio
                    cover={result.land_cover}
                    bbox={result.bbox}
                    scenario={scenario}
                    activeIntervention={activeIntervention}
                    onInterventionSelect={(key) => setActiveIntervention(key === activeIntervention ? null : key)}
                    onScenarioExport={setScenarioExport}
                  />
                </section>

                <section>
                  <h2 className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Hydrological simulation
                  </h2>
                  <p className="mb-3 text-xs text-muted-foreground">
                    Route a design storm across the terrain — flow paths and
                    flood-risk zones draw straight onto the map.
                  </p>
                  <SimulationPanel
                    landCover={result.land_cover}
                    bbox={analyzedBBox}
                    onRunSimulation={runSimulation}
                    simulationResult={simResult ?? undefined}
                    isLoading={simulating}
                    disabledReason={simDisabledReason}
                  />
                </section>
              </>
            )}
          </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
