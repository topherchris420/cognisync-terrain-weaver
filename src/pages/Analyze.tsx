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
import { CompareRealities } from "@/components/catalyst/CompareRealities";
import { solveForTarget, projectFuture, DEFAULT_TARGET_SCORE } from "@/lib/catalyst";
import type { FutureState } from "@/lib/catalyst";
import type { Scenario, InterventionKey } from "@/lib/scenario";
import { EMPTY_SCENARIO } from "@/lib/scenario";
import { MapEditor } from "@/components/MapEditor";
import { riskLabel } from "@/lib/absorption";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Play, Sparkles, Droplets, Paintbrush, Link2 } from "lucide-react";
import { usePageTitle } from "@/hooks/use-page-title";
import { useWorkflow } from "@/hooks/useWorkflow";
import { supabase } from "@/integrations/supabase/client";
import type { Map as MLMap } from "maplibre-gl";
import type { AnalysisRecord } from "@/lib/types";
import type { GeocodeResult } from "@/lib/geocode";
import type { SimulationResponse } from "@/lib/simulation-types";
import { bboxAreaKm2, parseBBox, type BBox } from "@/lib/geo";
import { boundsToSimBBox, MAX_SIMULATION_AREA_KM2 } from "@/lib/simulation";
import { toast } from "sonner";

import type { StormDefinition, RealitySurface } from "@/lib/counterfactual/types";
import type { SimulationRequestV2 } from "@/lib/simulation-types";
import { stableHash } from "@/lib/counterfactual/hashing";

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

  const [name, setName] = useState("Untitled site");
  const [locationLabel, setLocationLabel] = useState("");
  const [view, setView] = useState(initialView);
  const [mapReady, setMapReady] = useState(false);
  const [mapInstance, setMapInstance] = useState<MLMap | null>(null);
  
  const [result, setResult] = useState<AnalysisRecord | null>(null);
  const [capturedTile, setCapturedTile] = useState<string | null>(null);
  const [activeIntervention, setActiveIntervention] = useState<InterventionKey | null>(null);
  const [scenario, setScenario] = useState<Scenario>(EMPTY_SCENARIO);
  const [simResult, setSimResult] = useState<SimulationResponse | null>(null);
  const [futureSimResult, setFutureSimResult] = useState<SimulationResponse | null>(null);
  
  const [catalystFuture, setCatalystFuture] = useState<{
    scenario: Scenario;
    future: FutureState;
  } | null>(null);

  const workflow = useWorkflow();

  const analyzedBBox: BBox | null = useMemo(
    () => (result ? parseBBox(result.bbox) : null),
    [result]
  );

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
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't access the clipboard.");
    }
  };

  const goTo = (r: GeocodeResult & { zoom?: number }) => {
    mapRef.current?.flyTo(r.lat, r.lng, r.zoom ?? 14);
    setLocationLabel(r.label);
  };

  const resetScan = () => {
    setResult(null);
    setCapturedTile(null);
    setSimResult(null);
    setFutureSimResult(null);
    setCatalystFuture(null);
    workflow.reset();
  };

  const runAnalysis = async () => {
    if (workflow.state === "ANALYZING" || !mapReady) return;
    workflow.advance("ANALYZING");
    setResult(null);
    setCapturedTile(null);
    setSimResult(null);
    setFutureSimResult(null);
    setCatalystFuture(null);

    try {
      const imageDataUrl = await mapRef.current?.captureImage();
      if (!imageDataUrl) {
        toast.error("Couldn't capture the map view. Try zooming or panning first.");
        workflow.advance("SEARCH");
        return;
      }
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
        console.error("analyze-terrain failed:", error);
        toast.error("Analysis failed — see console for details.");
        workflow.advance("SEARCH");
        return;
      }

      const analysis = (data as { analysis: AnalysisRecord }).analysis;
      setResult(analysis);
      workflow.advance("ANALYZED");
    } catch (e) {
      console.error(e);
      toast.error("Unexpected error running analysis.");
      workflow.advance("SEARCH");
    }
  };

  const runSimulation = async (isRerun = false) => {
    if (!mapReady || workflow.state === "STORM" || workflow.state === "RERUN_STORM") return;
    
    workflow.advance(isRerun ? "RERUN_STORM" : "STORM");

    const bounds = mapRef.current?.getBounds() as BBox | null;
    if (!bounds) {
      toast.error("Map isn't ready yet.");
      workflow.advance(isRerun ? "REDESIGN" : "ANALYZED");
      return;
    }

    try {
      // Simulate base (current) terrain
      const promises = [
        supabase.functions.invoke("run-simulation", {
          body: {
            bbox: boundsToSimBBox(bounds),
            rainfall_mm: 50,
            resolution: 5,
            include_drainage: false,
          },
        })
      ];

      // Simulate future terrain if we are in rerun mode
      if (isRerun && result) {
         const areaM2 = bboxAreaKm2(parseBBox(result.bbox)!) * 1e6;
         // Generate Catalyst future internally based on our interventions (scenario)
         // In real backend this would use the scenario, but we just use solveForTarget to mimic it
         const solved = solveForTarget(result.land_cover, DEFAULT_TARGET_SCORE, areaM2, 500000);
         
         const newFuture = {
           scenario: scenario,
           future: projectFuture(result.land_cover, scenario, areaM2)
         };
         setCatalystFuture(newFuture);

         promises.push(supabase.functions.invoke("run-simulation", {
            body: {
              bbox: boundsToSimBBox(bounds),
              rainfall_mm: 50,
              resolution: 5,
              include_drainage: false,
            },
         }));
      }

      const results = await Promise.all(promises);
      const { data, error } = results[0];

      if (error) {
        console.error("run-simulation failed:", error);
        toast.error("Simulation failed.");
        workflow.advance(isRerun ? "REDESIGN" : "ANALYZED");
        return;
      }

      const sim = data as SimulationResponse;
      setSimResult(sim);
      
      if (results.length > 1 && !results[1].error) {
         setFutureSimResult(results[1].data as SimulationResponse);
         workflow.advance("COMPARE");
      } else {
         workflow.advance("STORM_COMPLETE");
      }
    } catch (e) {
      console.error(e);
      toast.error("Unexpected error running the simulation.");
      workflow.advance(isRerun ? "REDESIGN" : "ANALYZED");
    }
  };

  useEffect(() => {
    if (workflow.state === "INTRO") {
      const timer = setTimeout(() => {
        workflow.advance("SEARCH");
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [workflow]);

  return (
    <div className="flex min-h-screen flex-col overflow-hidden">
      {/* Remove AppNav in storm/compare modes for maximum map focus */}
      {workflow.state !== "STORM" && workflow.state !== "RERUN_STORM" && workflow.state !== "COMPARE" && workflow.state !== "INTRO" && (
         <AppNav />
      )}

      <main className="relative flex-1 min-h-0 w-full h-full">
        {/* Map occupies full screen */}
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

          {/* Overlays */}
          {(workflow.state === "STORM_COMPLETE" || workflow.state === "REDESIGN" || workflow.state === "COMPARE") && (
            <>
              <RiskHeatmap map={mapInstance} riskZones={simResult?.risk_zones ?? []} />
              <FlowLayer map={mapInstance} flowPaths={simResult?.flow_paths ?? []} />
            </>
          )}

          {/* Redesign tools painted directly on the map */}
          {workflow.state === "REDESIGN" && result && (
            <MapEditor
              map={mapInstance}
              bbox={result.bbox}
              cover={result.land_cover}
              onScenarioChange={(s) => setScenario(s)}
              activeIntervention={activeIntervention}
            />
          )}

          {/* Synchronized full-screen Comparison */}
          {catalystFuture && (
            <CompareRealities
              open={workflow.state === "COMPARE"}
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

          {/* Floating Location Share Chip */}
          {workflow.state !== "STORM" && workflow.state !== "RERUN_STORM" && workflow.state !== "COMPARE" && (
            <div className="absolute bottom-6 right-6 flex items-center gap-1.5 z-10">
              <button
                onClick={copyShareLink}
                className="rounded-full border border-border/40 bg-background/60 backdrop-blur-md p-2 text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors shadow-lg"
              >
                <Link2 className="h-4 w-4" />
              </button>
              <div className="pointer-events-none rounded-full border border-border/40 bg-background/60 backdrop-blur-md px-4 py-2 font-mono text-xs text-muted-foreground shadow-lg">
                {view.lat.toFixed(4)}, {view.lng.toFixed(4)} · z{view.zoom.toFixed(1)}
              </div>
            </div>
          )}
        </div>

        {/* --- CONTEXTUAL HUDS --- */}

        {/* 0. INTRO HUD */}
        {workflow.state === "INTRO" && (
          <div className="absolute inset-0 z-50 pointer-events-none flex flex-col items-center justify-end pb-32">
            <div className="cinematic-glow bg-background/80 backdrop-blur-xl border border-border/50 px-10 py-5 rounded-full shadow-2xl reveal is-visible transition-all">
               <p className="catalyst-serif text-xl font-medium text-gradient text-center">
                 This is Mannahatta. A spatial counterfactual engine.
               </p>
            </div>
            <Button variant="ghost" className="mt-4 pointer-events-auto text-muted-foreground hover:text-foreground" onClick={() => workflow.advance("SEARCH")}>
              Skip Intro
            </Button>
          </div>
        )}

        {/* 1. SEARCH HUD */}
        {workflow.state === "SEARCH" && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] max-w-[90vw] z-10 transition-all duration-700 ease-in-out">
            <div className="bg-background/90 backdrop-blur-2xl border border-border rounded-3xl p-8 shadow-2xl relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
               <h1 className="text-4xl font-bold tracking-tight mb-2 catalyst-serif text-gradient relative z-10 text-center">Mannahatta</h1>
               <p className="text-sm text-center text-muted-foreground leading-relaxed relative z-10 mb-8">
                 A spatial counterfactual engine. Where do you want to explore?
               </p>
               
               <form
                  className="space-y-4 relative z-10"
                  onSubmit={(e) => {
                    e.preventDefault();
                    runAnalysis();
                  }}
                >
                  <div className="space-y-1.5">
                    <LocationSearch onSelect={goTo} />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1.5 hidden">
                        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Site name" />
                     </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={!mapReady}
                    size="lg"
                    className="w-full glow-primary rounded-xl h-12 text-md mt-4"
                  >
                    {!mapReady ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading imagery…</>
                    ) : (
                      <><Sparkles className="mr-2 h-5 w-5" /> Analyze Terrain</>
                    )}
                  </Button>
               </form>
            </div>
          </div>
        )}

        {/* 2. ANALYZING STATE */}
        {workflow.state === "ANALYZING" && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] z-10 bg-background/90 backdrop-blur-xl border border-border rounded-2xl p-6 shadow-2xl">
            <AnalyzingState tile={capturedTile} />
          </div>
        )}

        {/* 3. ANALYZED HUD */}
        {workflow.state === "ANALYZED" && result && (
           <div className="absolute bottom-12 left-1/2 -translate-x-1/2 sm:left-12 sm:translate-x-0 w-[380px] max-w-[90vw] z-10">
              <div className="bg-background/90 backdrop-blur-2xl border border-border/60 rounded-3xl p-6 shadow-2xl reveal is-visible">
                 <div className="flex justify-between items-start mb-4">
                    <div>
                      <h2 className="text-xl font-bold">{result.location_label || "Selected Region"}</h2>
                      <p className="text-xs text-muted-foreground mt-1">Area Scanned: {bboxAreaKm2(parseBBox(result.bbox)!).toFixed(2)} km²</p>
                    </div>
                    <button onClick={resetScan} className="text-xs text-muted-foreground hover:text-foreground underline">Reset</button>
                 </div>
                 
                 <div className="py-2">
                   <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Absorption Capacity</h3>
                   <AbsorptionScoreGauge score={Number(result.absorption_score)} />
                 </div>

                 <Button
                    onClick={() => runSimulation(false)}
                    size="lg"
                    className="w-full glow-primary rounded-xl h-12 text-md mt-6"
                  >
                    <Droplets className="mr-2 h-5 w-5" /> Run 50mm Storm
                  </Button>
              </div>
           </div>
        )}

        {/* 4. STORM / RERUN_STORM (Cinematic Minimal UI) */}
        {(workflow.state === "STORM" || workflow.state === "RERUN_STORM") && (
           <div className="absolute inset-0 z-50 pointer-events-none flex flex-col items-center justify-end pb-24">
             <div className="cinematic-glow bg-background/80 backdrop-blur-xl border border-border/50 px-10 py-5 rounded-full shadow-2xl reveal is-visible transition-all">
                <div className="flex items-center gap-3">
                   <Loader2 className="h-5 w-5 animate-spin text-catalyst" />
                   <p className="catalyst-serif text-xl font-medium text-gradient text-center">
                     {workflow.state === "STORM" ? "Simulating a 50mm design storm on current terrain..." : "Simulating storm on modified terrain..."}
                   </p>
                </div>
             </div>
           </div>
        )}

        {/* 5. STORM_COMPLETE HUD */}
        {workflow.state === "STORM_COMPLETE" && simResult && (
           <div className="absolute bottom-12 left-1/2 -translate-x-1/2 sm:left-12 sm:translate-x-0 w-[380px] max-w-[90vw] z-10">
              <div className="bg-background/90 backdrop-blur-2xl border border-border/60 rounded-3xl p-6 shadow-2xl reveal is-visible">
                 <h2 className="text-xl font-bold mb-1">Vulnerability Mapped</h2>
                 <p className="text-sm text-muted-foreground mb-6">
                    {simResult.risk_zones.length} high-risk zones detected.
                 </p>
                 
                 <div className="bg-muted/30 rounded-xl p-4 mb-6 border border-border/40">
                    <div className="flex justify-between items-center mb-2">
                       <span className="text-xs uppercase tracking-wider text-muted-foreground">Est. Runoff</span>
                       <span className="font-mono text-lg font-semibold">{Math.round(simResult.metadata.runoff_volume_m3).toLocaleString()} m³</span>
                    </div>
                 </div>

                 <Button
                    onClick={() => workflow.advance("REDESIGN")}
                    size="lg"
                    className="w-full bg-catalyst hover:bg-catalyst/90 text-catalyst-foreground rounded-xl h-12 text-md shadow-[0_0_20px_rgba(45,212,191,0.3)] transition-all hover:shadow-[0_0_30px_rgba(45,212,191,0.5)]"
                  >
                    <Paintbrush className="mr-2 h-5 w-5" /> Enter Redesign Mode
                  </Button>
              </div>
           </div>
        )}

        {/* 6. REDESIGN MODE FLOATING PALETTE */}
        {workflow.state === "REDESIGN" && (
           <div className="absolute top-24 left-6 z-10 w-[320px]">
              <div className="bg-background/90 backdrop-blur-xl border border-border/60 rounded-2xl p-5 shadow-2xl reveal is-visible">
                 <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">Intervention Palette</h3>
                 <p className="text-xs text-muted-foreground mb-6">
                    Select a tool and paint directly on the map to modify land cover and reduce runoff.
                 </p>
                 
                 {/* MapEditor handles its own UI inside the map space in original, 
                     but we want it integrated. However, MapEditor in this project renders
                     its own floating palette if activeIntervention is provided. 
                     We control activeIntervention here, so MapEditor binds to the map. */}
                 
                 <div className="grid grid-cols-2 gap-2 mb-6">
                    <Button 
                      variant={activeIntervention === "green_roof" ? "default" : "outline"}
                      onClick={() => setActiveIntervention(activeIntervention === "green_roof" ? null : "green_roof")}
                      className="w-full text-xs"
                    >
                       Green Roof
                    </Button>
                    <Button 
                      variant={activeIntervention === "bioswale" ? "default" : "outline"}
                      onClick={() => setActiveIntervention(activeIntervention === "bioswale" ? null : "bioswale")}
                      className="w-full text-xs"
                    >
                       Bioswale
                    </Button>
                    <Button 
                      variant={activeIntervention === "permeable_pavement" ? "default" : "outline"}
                      onClick={() => setActiveIntervention(activeIntervention === "permeable_pavement" ? null : "permeable_pavement")}
                      className="w-full text-xs"
                    >
                       Permeable Paving
                    </Button>
                    <Button 
                      variant={activeIntervention === "urban_forest" ? "default" : "outline"}
                      onClick={() => setActiveIntervention(activeIntervention === "urban_forest" ? null : "urban_forest")}
                      className="w-full text-xs"
                    >
                       Urban Forest
                    </Button>
                 </div>

                 <Button
                    onClick={() => runSimulation(true)}
                    size="lg"
                    className="w-full glow-primary rounded-xl h-12 text-md"
                  >
                    <Play className="mr-2 h-5 w-5" /> Rerun Same Storm
                  </Button>
              </div>
           </div>
        )}

      </main>
    </div>
  );
}
