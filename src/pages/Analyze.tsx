import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AppNav } from "@/components/AppNav";
import { MapView, type MapViewHandle } from "@/components/MapView";
import { AbsorptionScoreGauge } from "@/components/AbsorptionScoreGauge";
import { LandCoverBreakdown } from "@/components/LandCoverBreakdown";
import { RecommendationsList } from "@/components/RecommendationsList";
import { ScenarioStudio } from "@/components/ScenarioStudio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  Play,
  Sparkles,
  MapPin,
  Info,
  Download,
  FileJson,
  Link2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { AnalysisRecord } from "@/lib/types";
import type { ScenarioExport } from "@/lib/scenario";
import {
  analysesToGeoJSON,
  downloadTextFile,
  exportFilename,
} from "@/lib/geo";
import { toast } from "sonner";

const PRESETS: Array<{ label: string; lat: number; lng: number; zoom: number }> = [
  { label: "Manhattan, NY", lat: 40.758, lng: -73.985, zoom: 15 },
  { label: "Jakarta, ID", lat: -6.2088, lng: 106.8456, zoom: 14 },
  { label: "Copenhagen, DK", lat: 55.6761, lng: 12.5683, zoom: 14 },
  { label: "Lagos, NG", lat: 6.5244, lng: 3.3792, zoom: 14 },
  { label: "Phoenix, AZ", lat: 33.4484, lng: -112.074, zoom: 14 },
];

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
  const [analyzing, setAnalyzing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<AnalysisRecord | null>(null);
  const [scenarioExport, setScenarioExport] = useState<ScenarioExport | null>(
    null
  );

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
    setScenarioExport(null);

    try {
      const imageDataUrl = await mapRef.current?.captureImage();
      if (!imageDataUrl) {
        toast.error("Couldn't capture the map view. Try zooming or panning first.");
        setAnalyzing(false);
        return;
      }
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

  // On small screens the results render below the fold — bring them into view.
  useEffect(() => {
    if (result && window.innerWidth < 1024) {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [result]);

  const jumpTo = (p: (typeof PRESETS)[number]) => {
    mapRef.current?.flyTo(p.lat, p.lng, p.zoom);
    setLocationLabel(p.label);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <AppNav />

      <main className="flex-1 grid gap-0 lg:grid-cols-[1fr_400px] min-h-0">
        {/* Map */}
        <div className="relative min-h-[420px] lg:min-h-0 border-b lg:border-b-0 lg:border-r border-border">
          <MapView
            ref={mapRef}
            initialCenter={[initialView.lng, initialView.lat]}
            initialZoom={initialView.zoom}
            onReady={() => setMapReady(true)}
            onViewChange={onViewChange}
          />

          {/* Floating chip: coords + share */}
          <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
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

          {/* Presets */}
          <div
            className="pointer-events-auto absolute top-3 left-3 flex flex-wrap gap-1.5 max-w-[calc(100%-8rem)]"
            role="group"
            aria-label="Preset locations"
          >
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => jumpTo(p)}
                aria-label={`Fly to ${p.label}`}
                className="rounded-full border border-border bg-background/85 backdrop-blur px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
              >
                <MapPin className="mr-1 inline h-3 w-3" aria-hidden="true" />
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Side panel */}
        <aside className="flex min-h-0 flex-col overflow-y-auto bg-background">
          <div className="border-b border-border p-5 panel">
            <h1 className="text-lg font-semibold">Run resilience scan</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Pan and zoom to your area of interest, then analyze the visible
              satellite tile.
            </p>

            <div className="mt-4 space-y-3">
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
                onClick={runAnalysis}
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
            </div>
          </div>

          <div
            ref={resultsRef}
            className="flex-1 space-y-6 p-5"
            aria-live="polite"
            aria-busy={analyzing}
          >
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

            {result && (
              <>
                <section>
                  <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Resilience score
                  </h2>
                  <AbsorptionScoreGauge score={Number(result.absorption_score)} />
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
                    onScenarioChange={setScenarioExport}
                  />
                </section>
              </>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
