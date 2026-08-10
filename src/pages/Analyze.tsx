import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Map as MLMap } from "maplibre-gl";

import { AppNav } from "@/components/AppNav";
import { MapView, type MapViewHandle } from "@/components/MapView";
import { MapEditor } from "@/components/MapEditor";
import { FlowLayer } from "@/components/FlowLayer";
import { RiskHeatmap } from "@/components/RiskHeatmap";
import { AnalyzingState } from "@/components/AnalyzingState";
import { Button } from "@/components/ui/button";
import { Link2 } from "lucide-react";

import { CommandBar } from "@/components/studio/CommandBar";
import { GroundPalette } from "@/components/studio/GroundPalette";
import { LiveMetrics } from "@/components/studio/LiveMetrics";
import { StormReadout } from "@/components/studio/StormReadout";
import { StormVeil } from "@/components/studio/StormVeil";
import { CatalystConstraint } from "@/components/studio/CatalystConstraint";
import { SiteDossier } from "@/components/studio/SiteDossier";

import { TemporalLens } from "@/components/catalyst/TemporalLens";
import { EpochVeil } from "@/components/catalyst/EpochVeil";
import { CatalystReveal } from "@/components/catalyst/CatalystReveal";
import { CompareRealities } from "@/components/catalyst/CompareRealities";
import { useCatalystUnlocked } from "@/hooks/use-catalyst";
import { useCinematicOnboarding } from "@/hooks/useCinematicOnboarding";
import { usePageTitle } from "@/hooks/use-page-title";

import {
  DEFAULT_TARGET_SCORE,
  projectFuture,
  solveForTarget,
  type Epoch,
  type FutureState,
} from "@/lib/catalyst";
import {
  assessScenario,
  EMPTY_SCENARIO,
  hasActiveInterventions,
  type InterventionKey,
  type Scenario,
  type ScenarioExport,
} from "@/lib/scenario";
import { riskLabel } from "@/lib/absorption";
import { reweightSimulation, runoffRatio } from "@/lib/storm";
import {
  boundsToSimBBox,
  estimateRunoffVolumeM3,
  MAX_SIMULATION_AREA_KM2,
} from "@/lib/simulation";
import {
  analysesToGeoJSON,
  bboxAreaKm2,
  downloadTextFile,
  exportFilename,
  parseBBox,
  type BBox,
} from "@/lib/geo";
import { supabase } from "@/integrations/supabase/client";
import type { SimulationRunParams } from "@/components/SimulationPanel";
import type { SimulationResponse } from "@/lib/simulation-types";
import type { AnalysisRecord } from "@/lib/types";
import type { GeocodeResult } from "@/lib/geocode";

const DEFAULT_VIEW = { lat: 40.758, lng: -73.985, zoom: 15 };
const STORM_MM = 50;
const CINEMATIC_BUDGET = 500_000;

/** Parse `?lat=&lng=&zoom=` into a validated viewport, or null if absent/invalid. */
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

/**
 * Mannahatta studio — the map is the interface.
 *
 * One sequence carries the whole product: read the ground, storm it as it
 * stands, change the ground, run the identical storm again, and hold the two
 * realities side by side. The old dashboard still exists in full, but it waits
 * inside the dossier until it is asked for.
 */
export default function Analyze() {
  usePageTitle("Studio");
  const mapRef = useRef<MapViewHandle>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const initialView = useMemo(
    () => viewFromParams(searchParams) ?? DEFAULT_VIEW,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const [view, setView] = useState(initialView);
  const [mapReady, setMapReady] = useState(false);
  const [mapInstance, setMapInstance] = useState<MLMap | null>(null);

  const [analyzing, setAnalyzing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<AnalysisRecord | null>(null);
  const [capturedTile, setCapturedTile] = useState<string | null>(null);
  const [locationLabel, setLocationLabel] = useState("");
  const [dossierOpen, setDossierOpen] = useState(false);

  const [scenario, setScenario] = useState<Scenario>(EMPTY_SCENARIO);
  const [activeIntervention, setActiveIntervention] = useState<InterventionKey | null>(null);
  const [scenarioExport, setScenarioExport] = useState<ScenarioExport | null>(null);

  const [simulating, setSimulating] = useState(false);
  const [stormActive, setStormActive] = useState(false);
  const [simResult, setSimResult] = useState<SimulationResponse | null>(null);
  const [rerunResult, setRerunResult] = useState<SimulationResponse | null>(null);

  const [catalystUnlocked, unlockCatalystNow] = useCatalystUnlocked();
  const [revealing, setRevealing] = useState(false);
  const [epoch, setEpoch] = useState<Epoch>("2026");
  const [comparing, setComparing] = useState(false);
  const [catalystFuture, setCatalystFuture] = useState<{
    scenario: Scenario;
    future: FutureState;
  } | null>(null);

  const cinematic = useCinematicOnboarding();
  const cinematicState = cinematic.state;

  const onUnlock = useCallback(() => {
    unlockCatalystNow();
    setRevealing(true);
  }, [unlockCatalystNow]);

  const changeEpoch = useCallback((next: Epoch) => {
    setEpoch(next);
    if (next !== "future") setComparing(false);
  }, []);

  const analyzedBBox: BBox | null = useMemo(
    () => (result ? parseBBox(result.bbox) : null),
    [result]
  );
  const areaM2 = useMemo(
    () => (analyzedBBox ? bboxAreaKm2(analyzedBBox) * 1e6 : 0),
    [analyzedBBox]
  );

  // Every edit to the ground is priced and scored immediately — the palette,
  // the metric cluster, and the storm readout all read this one object.
  const impact = useMemo(() => {
    if (!result || !hasActiveInterventions(scenario)) return null;
    return assessScenario(result.land_cover, scenario, areaM2);
  }, [result, scenario, areaM2]);

  const runoffBeforeM3 = useMemo(
    () =>
      result && analyzedBBox
        ? estimateRunoffVolumeM3(result.land_cover, analyzedBBox, STORM_MM)
        : 0,
    [result, analyzedBBox]
  );
  const runoffAfterM3 = useMemo(() => {
    if (!impact || !rerunResult) return null;
    return runoffBeforeM3 * runoffRatio(impact.baseScore, impact.projectedScore);
  }, [impact, rerunResult, runoffBeforeM3]);

  const simDisabledReason = useMemo(() => {
    if (!analyzedBBox) return null;
    const area = bboxAreaKm2(analyzedBBox);
    if (area > MAX_SIMULATION_AREA_KM2) {
      return `This view spans ${area.toFixed(0)} km² — zoom in to under ${MAX_SIMULATION_AREA_KM2} km² to simulate runoff.`;
    }
    return null;
  }, [analyzedBBox]);

  const onViewChange = useCallback(
    (v: { lat: number; lng: number; zoom: number }) => {
      setView(v);
      setSearchParams(
        { lat: v.lat.toFixed(5), lng: v.lng.toFixed(5), zoom: v.zoom.toFixed(1) },
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
      const { downloadPDFReport } = await import("@/lib/pdf-export");
      downloadPDFReport(result, scenarioExport ? { scenario: scenarioExport } : {});
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

  const resetScan = () => {
    setResult(null);
    setCapturedTile(null);
    setScenarioExport(null);
    setScenario(EMPTY_SCENARIO);
    setActiveIntervention(null);
    setSimResult(null);
    setRerunResult(null);
    setStormActive(false);
    setCatalystFuture(null);
    setComparing(false);
    setEpoch("2026");
    setDossierOpen(false);
  };

  /* ------------------------------------------------- read the ground ---- */

  const runAnalysis = useCallback(async () => {
    if (analyzing || !mapReady) return;
    setAnalyzing(true);
    setResult(null);
    setCapturedTile(null);
    setScenarioExport(null);
    setScenario(EMPTY_SCENARIO);
    setSimResult(null);
    setRerunResult(null);
    setStormActive(false);
    setCatalystFuture(null);
    setComparing(false);
    setEpoch("2026");

    try {
      const imageDataUrl = await mapRef.current?.captureImage();
      if (!imageDataUrl) {
        toast.error("Couldn't capture the map view. Try zooming or panning first.");
        return;
      }
      setCapturedTile(imageDataUrl);
      const bounds = mapRef.current?.getBounds() ?? null;
      const center = mapRef.current?.getCenter() ?? { lat: view.lat, lng: view.lng };
      const zoom = mapRef.current?.getZoom() ?? view.zoom;

      const { data, error } = await supabase.functions.invoke("analyze-terrain", {
        body: {
          name: locationLabel.trim() || "Untitled site",
          location_label: locationLabel.trim() || null,
          center_lat: center.lat,
          center_lng: center.lng,
          zoom,
          bbox: bounds,
          image_data_url: imageDataUrl,
        },
      });

      if (error) {
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
      toast.success("Ground read", {
        description: `Absorption score ${analysis.absorption_score}/100 · ${riskLabel(
          analysis.flood_risk
        )}`,
      });
    } catch (e) {
      console.error(e);
      toast.error("Unexpected error running analysis.");
    } finally {
      setAnalyzing(false);
    }
  }, [analyzing, mapReady, locationLabel, view.lat, view.lng, view.zoom]);

  /* ------------------------------------------------------ storm mode ---- */

  const runStorm = useCallback(
    async (params: SimulationRunParams = {
      rainfall_mm: STORM_MM,
      resolution: "medium",
      include_drainage: false,
    }) => {
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
      setStormActive(true);
      setRerunResult(null);
      try {
        const { data, error } = await supabase.functions.invoke("run-simulation", {
          body: {
            bbox: boundsToSimBBox(bounds),
            rainfall_mm: params.rainfall_mm,
            resolution: params.resolution,
            include_drainage: params.include_drainage,
          },
        });

        if (error) {
          console.error("run-simulation failed:", error);
          toast.error(
            error.message?.includes("429")
              ? "Rate limit hit. Please wait a moment and try again."
              : "Simulation failed — see console for details."
          );
          setStormActive(false);
          return;
        }

        const sim = data as SimulationResponse;
        if (!sim?.metadata) {
          toast.error("Simulation returned no result.");
          setStormActive(false);
          return;
        }
        setSimResult(sim);
        toast.success("Storm routed", {
          description: `${sim.flow_paths.length} flow paths and ${sim.risk_zones.length} risk zones over ${params.rainfall_mm} mm of rain.`,
        });
      } catch (e) {
        console.error(e);
        toast.error("Unexpected error running the simulation.");
        setStormActive(false);
      } finally {
        setSimulating(false);
      }
    },
    [simulating]
  );

  /**
   * The same storm, over redesigned ground.
   *
   * The DEM did not move, so the flow geometry is held from the measured run
   * and only the volumes are re-weighted by the scenario's runoff coefficient.
   * The readout states this plainly rather than implying a second solve.
   */
  const rerunStorm = useCallback(() => {
    if (!simResult || !impact) return;
    const ratio = runoffRatio(impact.baseScore, impact.projectedScore);
    setRerunResult(reweightSimulation(simResult, ratio));
    setStormActive(true);
  }, [simResult, impact]);

  /* ------------------------------------------------ cinematic first run - */

  const cineRef = useRef({ runAnalysis, runStorm, rerunStorm });
  cineRef.current = { runAnalysis, runStorm, rerunStorm };

  useEffect(() => {
    if (!cinematic.isActive) return;

    if (cinematicState === "FLYING_IN") {
      if (!mapReady) return;
      mapInstance?.flyTo({ center: [-74.006, 40.7128], zoom: 15, duration: 2400 });
      const t = setTimeout(() => {
        cinematic.advance("READING_GROUND");
        void cineRef.current.runAnalysis();
      }, 2600);
      return () => clearTimeout(t);
    }

    if (cinematicState === "READING_GROUND" && result) {
      const t = setTimeout(() => cinematic.advance("STORM_NOW"), 1200);
      return () => clearTimeout(t);
    }

    if (cinematicState === "STORM_NOW") {
      if (!simResult) {
        void cineRef.current.runStorm();
        return;
      }
      const t = setTimeout(() => cinematic.advance("REDESIGNING"), 2600);
      return () => clearTimeout(t);
    }

    if (cinematicState === "REDESIGNING" && result && areaM2 > 0) {
      const solved = solveForTarget(
        result.land_cover,
        DEFAULT_TARGET_SCORE,
        areaM2,
        CINEMATIC_BUDGET
      );
      setScenario(solved.scenario);
      setCatalystFuture({
        scenario: solved.scenario,
        future: projectFuture(result.land_cover, solved.scenario, areaM2),
      });
      unlockCatalystNow();
      const t = setTimeout(() => cinematic.advance("STORM_AGAIN"), 2400);
      return () => clearTimeout(t);
    }

    if (cinematicState === "STORM_AGAIN") {
      cineRef.current.rerunStorm();
      const t = setTimeout(() => {
        setEpoch("future");
        setComparing(true);
        cinematic.advance("COMPARING_REALITIES");
      }, 2600);
      return () => clearTimeout(t);
    }

    if (cinematicState === "COMPARING_REALITIES") {
      const t = setTimeout(() => cinematic.advance("FINISHED"), 5000);
      return () => clearTimeout(t);
    }
  }, [
    cinematicState,
    cinematic,
    mapReady,
    mapInstance,
    result,
    simResult,
    areaM2,
    unlockCatalystNow,
  ]);

  // A failed analysis mid-intro shouldn't leave the user staring at subtitles.
  useEffect(() => {
    if (cinematic.isActive && cinematicState === "READING_GROUND" && !analyzing && !result) {
      const t = setTimeout(() => cinematic.skip(), 1500);
      return () => clearTimeout(t);
    }
  }, [cinematic, cinematicState, analyzing, result]);

  /* -------------------------------------------------- 1609 map skin ----- */

  useEffect(() => {
    if (!mapInstance) return;
    const sourceId = "historical-tiles-source";
    const layerId = "historical-tiles-layer";
    // A period-styled topographic basemap standing in for pre-colonial terrain.
    // It is a *stylistic* skin, never a claim about 1609 geometry — the lens
    // labels it as reconstructed.
    const tileUrl =
      "https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}";

    const install = () => {
      if (!mapInstance.getSource(sourceId)) {
        mapInstance.addSource(sourceId, { type: "raster", tiles: [tileUrl], tileSize: 256 });
        mapInstance.addLayer({
          id: layerId,
          type: "raster",
          source: sourceId,
          paint: { "raster-opacity": 0, "raster-fade-duration": 600 },
        });
      }
      if (mapInstance.getLayer(layerId)) {
        mapInstance.setPaintProperty(layerId, "raster-opacity", epoch === "1609" ? 1 : 0);
      }
    };

    if (mapInstance.isStyleLoaded()) install();
    else mapInstance.once("load", install);
  }, [mapInstance, epoch]);

  const goTo = (r: GeocodeResult & { zoom?: number }) => {
    mapRef.current?.flyTo(r.lat, r.lng, r.zoom ?? 14);
    setLocationLabel(r.label);
  };

  const chromeHidden = cinematic.isActive || comparing;
  const editing = Boolean(result) && !comparing && (epoch === "2026" || epoch === "future");

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <AppNav />

      <main id="main" className="relative min-h-0 flex-1">
        <div className="absolute inset-0">
          <MapView
            ref={mapRef}
            initialCenter={[initialView.lng, initialView.lat]}
            initialZoom={initialView.zoom}
            onReady={(m) => {
              setMapReady(true);
              setMapInstance(m);
            }}
            onViewChange={onViewChange}
          />
        </div>

        <div
          className="vignette transition-opacity duration-1000"
          style={{ opacity: cinematic.isActive ? 1 : 0.35 }}
        />

        {/* Water on the ground — the base run, replaced by the re-weighted
            run once the same storm is played over the redesign. */}
        <RiskHeatmap map={mapInstance} riskZones={(rerunResult ?? simResult)?.risk_zones ?? []} />
        <FlowLayer map={mapInstance} flowPaths={(rerunResult ?? simResult)?.flow_paths ?? []} />

        <StormVeil active={stormActive && !comparing} />

        {editing && result && (
          <MapEditor
            map={mapInstance}
            bbox={result.bbox}
            cover={result.land_cover}
            onScenarioChange={setScenario}
            activeIntervention={activeIntervention}
          />
        )}

        {!comparing && <EpochVeil epoch={epoch} futureConfigured={Boolean(catalystFuture)} />}

        {catalystFuture && (
          <CompareRealities
            open={comparing && epoch === "future"}
            onClose={() => setComparing(false)}
            baseMap={mapInstance}
            currentScore={catalystFuture.future.impact.baseScore}
            futureScore={catalystFuture.future.impact.projectedScore}
            currentRisk={riskLabel(catalystFuture.future.impact.baseRisk)}
            futureRisk={riskLabel(catalystFuture.future.risk)}
            futureSimResult={rerunResult}
          />
        )}

        <CatalystReveal open={revealing} onDone={() => setRevealing(false)} />

        <CommandBar
          onGoTo={goTo}
          onAnalyze={runAnalysis}
          onStorm={() => runStorm()}
          onOpenDossier={() => setDossierOpen(true)}
          analyzing={analyzing}
          mapReady={mapReady}
          hasResult={Boolean(result)}
          storming={simulating}
          hidden={chromeHidden}
        />

        {result && (
          <>
            <GroundPalette
              active={activeIntervention}
              onSelect={setActiveIntervention}
              scenario={scenario}
              impact={impact}
              hidden={chromeHidden}
            />

            <LiveMetrics
              score={Number(result.absorption_score)}
              risk={result.flood_risk}
              impact={impact}
              runoffM3={simResult ? runoffBeforeM3 : null}
              projectedRunoffM3={runoffAfterM3}
              provenance="Land cover inferred from imagery · flow routed over a measured DEM"
              hidden={chromeHidden}
            />

            <StormReadout
              rainfallMm={STORM_MM}
              baseline={simResult}
              rerun={rerunResult}
              runoffBeforeM3={runoffBeforeM3}
              runoffAfterM3={runoffAfterM3}
              baseRisk={result.flood_risk}
              projectedRisk={impact?.projectedRisk ?? null}
              canRerun={Boolean(simResult && impact)}
              running={simulating}
              onRerun={rerunStorm}
              onCompare={() => {
                if (!catalystFuture && impact && result) {
                  setCatalystFuture({
                    scenario,
                    future: projectFuture(result.land_cover, scenario, areaM2),
                  });
                }
                setEpoch("future");
                setComparing(true);
              }}
              hidden={chromeHidden}
            />

            {epoch === "future" && catalystUnlocked && !comparing && (
              <CatalystConstraint
                cover={result.land_cover}
                areaM2={areaM2}
                solved={catalystFuture}
                onSolved={(next) => {
                  setCatalystFuture(next);
                  setScenario(next.scenario);
                }}
                hidden={cinematic.isActive}
              />
            )}

            <TemporalLens
              epoch={epoch}
              onChange={changeEpoch}
              unlocked={catalystUnlocked}
              className={cn(
                "absolute bottom-3 left-1/2 z-20 -translate-x-1/2 transition-opacity duration-700",
                chromeHidden ? "pointer-events-none opacity-0" : "opacity-100"
              )}
            />
          </>
        )}

        {/* Coordinates + share, the quietest thing on screen. */}
        <div
          className={cn(
            "absolute bottom-3 left-3 z-10 flex items-center gap-1.5 transition-opacity duration-700",
            chromeHidden ? "opacity-0" : "opacity-100"
          )}
        >
          <button
            onClick={copyShareLink}
            aria-label="Copy shareable link to this map view"
            className="rounded-md border border-border bg-background/85 p-1.5 text-muted-foreground backdrop-blur transition-colors hover:border-primary/50 hover:text-foreground"
          >
            <Link2 className="h-3.5 w-3.5" />
          </button>
          <div className="pointer-events-none rounded-md border border-border bg-background/85 px-3 py-1.5 font-mono text-xs text-muted-foreground backdrop-blur">
            {view.lat.toFixed(4)}, {view.lng.toFixed(4)} · z{view.zoom.toFixed(1)}
          </div>
        </div>

        {analyzing && (
          <div className="pointer-events-none absolute left-1/2 top-24 z-30 w-[22rem] max-w-[calc(100%-1.5rem)] -translate-x-1/2">
            <div className="pointer-events-auto rounded-xl border border-border bg-background/90 p-4 shadow-2xl backdrop-blur-xl">
              <AnalyzingState tile={capturedTile} />
            </div>
          </div>
        )}

        {cinematic.isActive && (
          <div className="pointer-events-none absolute inset-0 z-40 flex flex-col items-center justify-end pb-24">
            <div className="cinematic-glow rounded-full border border-border/50 bg-background/80 px-8 py-4 shadow-2xl backdrop-blur-xl">
              <p className="catalyst-serif text-center text-xl font-medium text-gradient">
                {cinematic.subtitle}
              </p>
            </div>
            <Button
              variant="ghost"
              className="pointer-events-auto mt-3 text-muted-foreground hover:text-foreground"
              onClick={cinematic.skip}
            >
              Skip intro
            </Button>
          </div>
        )}

        {result && (
          <SiteDossier
            open={dossierOpen}
            onOpenChange={setDossierOpen}
            result={result}
            capturedTile={capturedTile}
            analyzedBBox={analyzedBBox}
            scenario={scenario}
            activeIntervention={activeIntervention}
            onInterventionSelect={setActiveIntervention}
            onScenarioExport={setScenarioExport}
            simResult={rerunResult ?? simResult}
            simulating={simulating}
            simDisabledReason={simDisabledReason}
            onRunSimulation={runStorm}
            exporting={exporting}
            onExportPDF={exportPDF}
            onExportGeoJSON={exportGeoJSON}
            onNewScan={resetScan}
            catalyst={{ unlocked: catalystUnlocked, onUnlock }}
          />
        )}
      </main>
    </div>
  );
}
