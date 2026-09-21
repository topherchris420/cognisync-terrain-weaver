import { ArrowLeftRight, MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { classifyFloodRisk, riskLabel } from "@/lib/absorption";
import { LAND_COVER_META, type AnalysisRecord, type LandCoverKey } from "@/lib/types";

const ORDER: LandCoverKey[] = [
  "vegetation",
  "soil",
  "water",
  "buildings",
  "pavement",
];

interface Props {
  a: AnalysisRecord;
  b: AnalysisRecord;
  onClose: () => void;
}

function coverPct(r: AnalysisRecord, key: LandCoverKey): number {
  const total =
    Object.values(r.land_cover ?? {}).reduce((x, y) => x + Number(y), 0) || 1;
  return (Number(r.land_cover?.[key] ?? 0) / total) * 100;
}

const riskBadge = (score: number) => {
  const risk = classifyFloodRisk(score);
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 text-xs font-medium",
        risk === "low"
          ? "border-primary/30 bg-primary/10 text-primary"
          : risk === "moderate"
          ? "border-warning/30 bg-warning/10 text-warning"
          : "border-destructive/30 bg-destructive/10 text-destructive"
      )}
    >
      {riskLabel(risk)} risk
    </span>
  );
};

/**
 * Side-by-side "tale of the tape" for two analyses — compare a site against
 * a benchmark district, or the same block before and after an intervention.
 */
export function SiteComparison({ a, b, onClose }: Props) {
  const scoreA = Number(a.absorption_score);
  const scoreB = Number(b.absorption_score);
  const delta = Math.round((scoreB - scoreA) * 10) / 10;

  const site = (r: AnalysisRecord, score: number, align: "left" | "right") => (
    <div className={cn(align === "right" && "text-right")}>
      <h3 className="truncate text-sm font-semibold">{r.name}</h3>
      <div
        className={cn(
          "mt-0.5 flex items-center gap-1 text-xs text-muted-foreground",
          align === "right" && "justify-end"
        )}
      >
        <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span className="truncate">
          {r.location_label ??
            `${Number(r.center_lat).toFixed(3)}, ${Number(r.center_lng).toFixed(3)}`}
        </span>
      </div>
      <div
        className={cn(
          "mt-2 flex items-center gap-2",
          align === "right" && "justify-end"
        )}
      >
        <span className="font-mono text-3xl font-bold">{score.toFixed(0)}</span>
        {riskBadge(score)}
      </div>
    </div>
  );

  return (
    <section
      className="panel relative mb-6 rounded-xl border border-primary/40 p-5"
      aria-label={`Comparing ${a.name} with ${b.name}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          <ArrowLeftRight className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
          Site comparison
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={onClose}
          aria-label="Close comparison"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-start gap-4">
        {site(a, scoreA, "left")}
        <div className="self-center rounded-full border border-border bg-background/60 px-2.5 py-1 font-mono text-sm font-semibold">
          <span
            className={cn(
              delta > 0
                ? "text-primary"
                : delta < 0
                ? "text-destructive"
                : "text-muted-foreground"
            )}
          >
            {delta > 0 ? `+${delta}` : delta}
          </span>
        </div>
        {site(b, scoreB, "right")}
      </div>

      {/* Per-class land-cover deltas */}
      <div className="mt-5 space-y-2.5">
        {ORDER.map((key) => {
          const pctA = coverPct(a, key);
          const pctB = coverPct(b, key);
          const diff = Math.round((pctB - pctA) * 10) / 10;
          const max = Math.max(pctA, pctB, 1);
          return (
            <div
              key={key}
              className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-xs"
            >
              <div className="flex items-center justify-end gap-2">
                <span className="font-mono tabular-nums">{pctA.toFixed(1)}%</span>
                <div className="h-1.5 w-full max-w-32 overflow-hidden rounded-full bg-muted/30">
                  <div
                    className="ml-auto h-full rounded-full"
                    style={{
                      width: `${(pctA / max) * 100}%`,
                      backgroundColor: LAND_COVER_META[key].token,
                      marginLeft: "auto",
                    }}
                  />
                </div>
              </div>
              <div className="w-32 text-center">
                <span className="font-medium">{LAND_COVER_META[key].label}</span>
                <span
                  className={cn(
                    "ml-1.5 font-mono",
                    diff > 0
                      ? "text-primary"
                      : diff < 0
                      ? "text-destructive"
                      : "text-muted-foreground"
                  )}
                >
                  {diff > 0 ? `+${diff}` : diff}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-full max-w-32 overflow-hidden rounded-full bg-muted/30">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(pctB / max) * 100}%`,
                      backgroundColor: LAND_COVER_META[key].token,
                    }}
                  />
                </div>
                <span className="font-mono tabular-nums">{pctB.toFixed(1)}%</span>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-[11px] text-muted-foreground">
        Deltas read left → right: how the second site differs from the first,
        in percentage points of land cover and absorption score.
      </p>
    </section>
  );
}
