import { Loader2, Download, FileJson, MapPin, Plus } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { AbsorptionScoreGauge } from "@/components/AbsorptionScoreGauge";
import { BaselineComparison } from "@/components/BaselineComparison";
import { LandCoverBreakdown } from "@/components/LandCoverBreakdown";
import { RecommendationsList } from "@/components/RecommendationsList";
import { ScenarioStudio } from "@/components/ScenarioStudio";
import {
  SimulationPanel,
  type SimulationRunParams,
} from "@/components/SimulationPanel";
import { CATALYST_LIMITS } from "@/lib/catalyst";
import type { InterventionKey, Scenario, ScenarioExport } from "@/lib/scenario";
import type { AnalysisRecord } from "@/lib/types";
import type { SimulationResponse } from "@/lib/simulation-types";
import type { BBox } from "@/lib/geo";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: AnalysisRecord;
  capturedTile: string | null;
  analyzedBBox: BBox | null;
  scenario: Scenario;
  activeIntervention: InterventionKey | null;
  onInterventionSelect: (key: InterventionKey) => void;
  onScenarioExport: (payload: ScenarioExport | null) => void;
  simResult: SimulationResponse | null;
  simulating: boolean;
  simDisabledReason: string | null;
  onRunSimulation: (params: SimulationRunParams) => void;
  exporting: boolean;
  onExportPDF: () => void;
  onExportGeoJSON: () => void;
  onNewScan: () => void;
  catalyst: { unlocked: boolean; onUnlock: () => void };
}

/**
 * The dashboard, demoted. Everything that used to crowd the map now waits
 * behind one button — the full report, unchanged, when it is actually wanted.
 */
export function SiteDossier({
  open,
  onOpenChange,
  result,
  capturedTile,
  analyzedBBox,
  scenario,
  activeIntervention,
  onInterventionSelect,
  onScenarioExport,
  simResult,
  simulating,
  simDisabledReason,
  onRunSimulation,
  exporting,
  onExportPDF,
  onExportGeoJSON,
  onNewScan,
  catalyst,
}: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto border-border bg-background/95 backdrop-blur-xl sm:max-w-md"
      >
        <SheetHeader className="text-left">
          <SheetTitle className="catalyst-serif text-2xl">{result.name}</SheetTitle>
          <SheetDescription className="flex items-center gap-1 text-xs">
            <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="truncate">
              {result.location_label ??
                `${Number(result.center_lat).toFixed(4)}, ${Number(result.center_lng).toFixed(4)}`}
            </span>
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-6 pb-10">
          {capturedTile && (
            <img
              src={capturedTile}
              alt={`Satellite tile analyzed for ${result.name}`}
              className="block aspect-video w-full rounded-lg border border-border object-cover"
            />
          )}

          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Resilience score
            </h2>
            <AbsorptionScoreGauge score={Number(result.absorption_score)} />
            <BaselineComparison
              score={Number(result.absorption_score)}
              className="mt-4"
              catalyst={catalyst}
            />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" className="gap-2" disabled={exporting} onClick={onExportPDF}>
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                PDF report
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={onExportGeoJSON}>
                <FileJson className="h-4 w-4" />
                GeoJSON
              </Button>
            </div>
            {result.ai_notes && (
              <p className="mt-3 text-sm text-muted-foreground">{result.ai_notes}</p>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Land cover composition
            </h2>
            <LandCoverBreakdown cover={result.land_cover} />
            <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
              Inferred by a vision model from the captured tile — tile-level
              shares, not per-parcel geometry. Treat as classification, not survey.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Adaptation recommendations
            </h2>
            <RecommendationsList items={result.recommendations} />
          </section>

          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Scenario detail
            </h2>
            <ScenarioStudio
              cover={result.land_cover}
              bbox={result.bbox}
              scenario={scenario}
              activeIntervention={activeIntervention}
              onInterventionSelect={onInterventionSelect}
              onScenarioExport={onScenarioExport}
            />
          </section>

          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Hydrological simulation
            </h2>
            <SimulationPanel
              landCover={result.land_cover}
              bbox={analyzedBBox}
              onRunSimulation={onRunSimulation}
              simulationResult={simResult ?? undefined}
              isLoading={simulating}
              disabledReason={simDisabledReason}
            />
          </section>

          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Assumptions &amp; limits
            </h2>
            <ul className="space-y-1.5 text-[11px] leading-snug text-muted-foreground">
              {CATALYST_LIMITS.map((limit) => (
                <li key={limit}>— {limit}</li>
              ))}
            </ul>
          </section>

          <Button variant="outline" size="sm" className="w-full gap-2" onClick={onNewScan}>
            <Plus className="h-4 w-4" />
            Start a new site
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}