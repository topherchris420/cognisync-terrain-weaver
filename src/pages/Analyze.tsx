import { useRef, useState } from "react";
import { AppNav } from "@/components/AppNav";
import { MapView, type MapViewHandle } from "@/components/MapView";
import { AbsorptionScoreGauge } from "@/components/AbsorptionScoreGauge";
import { LandCoverBreakdown } from "@/components/LandCoverBreakdown";
import { RecommendationsList } from "@/components/RecommendationsList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Play, Sparkles, MapPin, Info, Download, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { AnalysisRecord } from "@/lib/types";
import { toast } from "sonner";
import { downloadPDFReport } from "@/lib/pdf-export";

const PRESETS: Array<{ label: string; lat: number; lng: number; zoom: number }> = [
  { label: "Manhattan, NY", lat: 40.758, lng: -73.985, zoom: 15 },
  { label: "Jakarta, ID", lat: -6.2088, lng: 106.8456, zoom: 14 },
  { label: "Copenhagen, DK", lat: 55.6761, lng: 12.5683, zoom: 14 },
  { label: "Lagos, NG", lat: 6.5244, lng: 3.3792, zoom: 14 },
  { label: "Phoenix, AZ", lat: 33.4484, lng: -112.074, zoom: 14 },
];

export default function Analyze() {
  const mapRef = useRef<MapViewHandle>(null);
  const [name, setName] = useState("Untitled site");
  const [locationLabel, setLocationLabel] = useState("");
  const [view, setView] = useState({ lat: 40.758, lng: -73.985, zoom: 15 });
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisRecord | null>(null);

  const runAnalysis = async () => {
    if (analyzing) return;
    setAnalyzing(true);
    setResult(null);

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
          name: name || "Untitled site",
          location_label: locationLabel || null,
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
            initialCenter={[view.lng, view.lat]}
            initialZoom={view.zoom}
            onViewChange={setView}
          />

          {/* Floating chip: coords */}
          <div className="pointer-events-none absolute bottom-3 right-3 rounded-md border border-border bg-background/85 backdrop-blur px-3 py-1.5 font-mono text-xs text-muted-foreground">
            {view.lat.toFixed(4)}, {view.lng.toFixed(4)} · z{view.zoom.toFixed(1)}
          </div>

          {/* Presets */}
          <div className="pointer-events-auto absolute top-3 left-3 flex flex-wrap gap-1.5 max-w-[calc(100%-8rem)]">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => jumpTo(p)}
                className="rounded-full border border-border bg-background/85 backdrop-blur px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
              >
                <MapPin className="mr-1 inline h-3 w-3" />
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
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Riverside Park watershed"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="loc">Location label (optional)</Label>
                <Input
                  id="loc"
                  value={locationLabel}
                  onChange={(e) => setLocationLabel(e.target.value)}
                  placeholder="Manhattan, NY"
                />
              </div>

              <Button
                onClick={runAnalysis}
                disabled={analyzing}
                size="lg"
                className="w-full glow-primary"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing satellite tile…
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

          <div className="flex-1 space-y-6 p-5">
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
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-3 gap-2"
                    onClick={() => {
                      downloadPDFReport(result);
                      toast.success("PDF report downloaded");
                    }}
                  >
                    <Download className="h-4 w-4" />
                    Export PDF Report
                  </Button>
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
              </>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
