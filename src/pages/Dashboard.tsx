import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AppNav } from "@/components/AppNav";
import { SiteComparison } from "@/components/SiteComparison";
import { supabase } from "@/integrations/supabase/client";
import type { AnalysisRecord } from "@/lib/types";
import { classifyFloodRisk, riskColor, riskLabel } from "@/lib/absorption";
import {
  analysesToCSV,
  analysesToGeoJSON,
  downloadTextFile,
  exportFilename,
} from "@/lib/geo";
import {
  MapPin,
  ArrowRight,
  ArrowUpRight,
  ArrowLeftRight,
  FileJson,
  FileSpreadsheet,
  GaugeCircle,
  Sparkles,
  Search,
  AlertTriangle,
  RotateCcw,
  Activity,
  Droplets,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { LAND_COVER_META, type LandCoverKey } from "@/lib/types";
import { usePageTitle } from "@/hooks/use-page-title";

const ORDER: LandCoverKey[] = [
  "vegetation",
  "soil",
  "water",
  "buildings",
  "pavement",
];

type SortKey = "newest" | "score-desc" | "score-asc";

const SORTERS: Record<SortKey, (a: AnalysisRecord, b: AnalysisRecord) => number> = {
  newest: (a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  "score-desc": (a, b) => Number(b.absorption_score) - Number(a.absorption_score),
  "score-asc": (a, b) => Number(a.absorption_score) - Number(b.absorption_score),
};

async function fetchAnalyses(signal: AbortSignal): Promise<AnalysisRecord[]> {
  // Bound each attempt so a stalled connection surfaces the error/retry UI
  // instead of leaving the feed on skeletons forever.
  const { data, error } = await supabase
    .from("analyses")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50)
    .abortSignal(AbortSignal.any([signal, AbortSignal.timeout(15_000)]));
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as AnalysisRecord[];
}

export default function Dashboard() {
  usePageTitle("Dashboard");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [compareMode, setCompareMode] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const {
    data: rows,
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["analyses"],
    queryFn: ({ signal }) => fetchAnalyses(signal),
  });

  const stats = useMemo(() => {
    if (!rows || rows.length === 0) return null;
    const scores = rows
      .map((r) => Number(r.absorption_score))
      .sort((a, b) => a - b);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const mid = Math.floor(scores.length / 2);
    const median =
      scores.length % 2 === 0 ? (scores[mid - 1] + scores[mid]) / 2 : scores[mid];
    const highRisk = rows.filter(
      (r) => classifyFloodRisk(Number(r.absorption_score)) === "high"
    ).length;
    const lowRisk = rows.filter(
      (r) => classifyFloodRisk(Number(r.absorption_score)) === "low"
    ).length;
    // Ten-point buckets for the portfolio score distribution.
    const bins = Array.from({ length: 10 }, () => 0);
    for (const s of scores) bins[Math.min(9, Math.max(0, Math.floor(s / 10)))]++;
    return { total: rows.length, avg, median, highRisk, lowRisk, bins };
  }, [rows]);

  const toggleCompareMode = () => {
    setCompareMode((on) => !on);
    setCompareIds([]);
  };

  const toggleSelected = (id: string) => {
    setCompareIds((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length >= 2
        ? [prev[1], id]
        : [...prev, id]
    );
  };

  const comparePair = useMemo(() => {
    if (!rows || compareIds.length !== 2) return null;
    const a = rows.find((r) => r.id === compareIds[0]);
    const b = rows.find((r) => r.id === compareIds[1]);
    return a && b ? ([a, b] as const) : null;
  }, [rows, compareIds]);

  const exportFeed = (format: "geojson" | "csv", records: AnalysisRecord[]) => {
    if (records.length === 0) return;
    if (format === "geojson") {
      downloadTextFile(
        exportFilename("mannahatta-sites", "geojson"),
        JSON.stringify(analysesToGeoJSON(records), null, 2),
        "application/geo+json"
      );
    } else {
      downloadTextFile(
        exportFilename("mannahatta-sites", "csv"),
        analysesToCSV(records),
        "text/csv"
      );
    }
    toast.success(
      `Exported ${records.length} ${records.length === 1 ? "site" : "sites"} as ${format.toUpperCase()}`,
      {
        description:
          format === "geojson"
            ? "Footprint polygons + attributes, ready for QGIS / ArcGIS."
            : "Flat attribute table for spreadsheets and BI tools.",
      }
    );
  };

  const visible = useMemo(() => {
    if (!rows) return [];
    const q = query.trim().toLowerCase();
    const filtered = q
      ? rows.filter(
          (r) =>
            r.name.toLowerCase().includes(q) ||
            (r.location_label ?? "").toLowerCase().includes(q)
        )
      : rows;
    return [...filtered].sort(SORTERS[sort]);
  }, [rows, query, sort]);

  return (
    <div className="flex min-h-screen flex-col">
      <AppNav />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-6 md:py-12">
        <header className="mb-8 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold">
              Analysis dashboard
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Public feed of urban resilience scans generated by the platform.
            </p>
          </div>
          <Button asChild>
            <Link to="/analyze">
              New analysis
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </header>

        {/* Summary stats */}
        {stats && (
          <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              {
                icon: Activity,
                label: "Total scans",
                value: String(stats.total),
                tint: "text-accent",
              },
              {
                icon: GaugeCircle,
                label: "Avg absorption",
                value: stats.avg.toFixed(1),
                tint: "text-primary",
              },
              {
                icon: Droplets,
                label: "High flood risk",
                value: String(stats.highRisk),
                tint: "text-destructive",
              },
              {
                icon: ShieldCheck,
                label: "Low flood risk",
                value: String(stats.lowRisk),
                tint: "text-primary",
              },
            ].map(({ icon: Icon, label, value, tint }) => (
              <div
                key={label}
                className="panel rounded-xl border border-border p-4"
              >
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Icon className={cn("h-3.5 w-3.5", tint)} aria-hidden="true" />
                  {label}
                </div>
                <div className="mt-1.5 font-mono text-2xl font-semibold">
                  {value}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Portfolio score distribution */}
        {stats && stats.total >= 3 && (
          <div className="panel mb-8 rounded-xl border border-border p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-semibold uppercase tracking-widest">
                Score distribution
              </span>
              <span>
                median{" "}
                <span className="font-mono font-semibold text-foreground">
                  {stats.median.toFixed(1)}
                </span>
              </span>
            </div>
            <div
              className="mt-3 flex h-16 items-end gap-1"
              role="img"
              aria-label={`Histogram of absorption scores across ${stats.total} sites`}
            >
              {stats.bins.map((count, i) => {
                const max = Math.max(...stats.bins, 1);
                const bandStart = i * 10;
                // Tint each bucket by the model's own banding (a 10-wide bucket
                // can straddle a boundary; its midpoint is the least-wrong
                // representative). Hardcoded cutoffs here once disagreed with
                // classifyFloodRisk, tinting whole buckets the wrong risk.
                const bucketRisk = classifyFloodRisk(bandStart + 5);
                return (
                  <div
                    key={i}
                    className="flex h-full flex-1 items-end"
                    title={`${bandStart}–${bandStart + 9}: ${count} ${count === 1 ? "site" : "sites"}`}
                  >
                    <div
                      className={cn(
                        "w-full rounded-t-sm transition-all",
                        bucketRisk === "low"
                          ? "bg-primary/70"
                          : bucketRisk === "moderate"
                          ? "bg-warning/60"
                          : "bg-destructive/60",
                        count === 0 && "bg-muted/30"
                      )}
                      style={{
                        height: `${count === 0 ? 4 : Math.max(10, (count / max) * 100)}%`,
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="mt-1.5 flex justify-between font-mono text-[10px] text-muted-foreground">
              <span>0</span>
              <span>50</span>
              <span>100</span>
            </div>
          </div>
        )}

        {/* Controls */}
        {rows && rows.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by site name or location…"
                className="pl-9"
                aria-label="Search analyses"
              />
            </div>
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger className="w-[190px]" aria-label="Sort analyses">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="score-desc">Highest score</SelectItem>
                <SelectItem value="score-asc">Lowest score</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant={compareMode ? "default" : "outline"}
              size="sm"
              className="gap-2"
              onClick={toggleCompareMode}
              aria-pressed={compareMode}
            >
              <ArrowLeftRight className="h-4 w-4" />
              Compare
            </Button>
            <div className="flex items-center gap-1.5" role="group" aria-label="Export the feed">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => exportFeed("geojson", visible)}
                title="Export the visible sites as GeoJSON (QGIS / ArcGIS)"
              >
                <FileJson className="h-4 w-4" />
                GeoJSON
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => exportFeed("csv", visible)}
                title="Export the visible sites as CSV"
              >
                <FileSpreadsheet className="h-4 w-4" />
                CSV
              </Button>
            </div>
          </div>
        )}

        {/* Compare-mode hint */}
        {compareMode && !comparePair && (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-accent/40 bg-accent/10 px-4 py-2.5 text-sm text-accent">
            <ArrowLeftRight className="h-4 w-4 shrink-0" aria-hidden="true" />
            Select two sites to compare them side by side
            {compareIds.length === 1 && " — one selected, pick another"}.
          </div>
        )}

        {/* Side-by-side comparison */}
        {comparePair && (
          <SiteComparison
            a={comparePair[0]}
            b={comparePair[1]}
            onClose={() => setCompareIds([])}
          />
        )}

        {/* Loading skeletons */}
        {isPending && (
          <div
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
            role="status"
            aria-label="Loading analyses"
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border p-5">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="mt-2 h-3.5 w-1/2" />
                <Skeleton className="mt-5 h-2 w-full rounded-full" />
                <div className="mt-4 flex justify-between">
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-5 w-16" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {isError && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-12 text-center">
            <AlertTriangle className="mx-auto mb-3 h-6 w-6 text-destructive" />
            <h2 className="text-lg font-semibold">Couldn't load the feed</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {error instanceof Error ? error.message : "Unknown error"}
            </p>
            <Button
              variant="outline"
              className="mt-6 gap-2"
              onClick={() => refetch()}
            >
              <RotateCcw className="h-4 w-4" />
              Retry
            </Button>
          </div>
        )}

        {/* Empty feed */}
        {rows && rows.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-12 text-center">
            <Sparkles className="mx-auto mb-3 h-6 w-6 text-primary" />
            <h2 className="text-lg font-semibold">No analyses yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Be the first to scan a site and populate the public feed.
            </p>
            <Button asChild className="mt-6">
              <Link to="/analyze">Run first analysis</Link>
            </Button>
          </div>
        )}

        {/* No matches for the current filter */}
        {rows && rows.length > 0 && visible.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
            No analyses match “{query}”.
          </div>
        )}

        {visible.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visible.map((r) => {
              const risk = classifyFloodRisk(Number(r.absorption_score));
              const mapHref = `/analyze?lat=${Number(r.center_lat).toFixed(
                5
              )}&lng=${Number(r.center_lng).toFixed(5)}&zoom=${Number(
                r.zoom
              ).toFixed(1)}`;
              const selected = compareIds.includes(r.id);
              return (
                <article
                  key={r.id}
                  className={cn(
                    "group panel rounded-xl border p-5 transition-colors",
                    compareMode && "cursor-pointer",
                    selected
                      ? "border-accent ring-1 ring-accent"
                      : "border-border hover:border-primary/40"
                  )}
                  // In compare mode the card is a toggle, and must be one for
                  // the keyboard too. The keydown guard ignores Enter/Space
                  // bubbling up from the inner "View area" link.
                  onClick={compareMode ? () => toggleSelected(r.id) : undefined}
                  onKeyDown={
                    compareMode
                      ? (e) => {
                          if (e.target !== e.currentTarget) return;
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            toggleSelected(r.id);
                          }
                        }
                      : undefined
                  }
                  role={compareMode ? "button" : undefined}
                  tabIndex={compareMode ? 0 : undefined}
                  aria-pressed={compareMode ? selected : undefined}
                  aria-label={
                    compareMode
                      ? `${selected ? "Remove" : "Select"} ${r.name} for comparison`
                      : undefined
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold">
                        {r.name}
                      </h3>
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">
                          {r.location_label ??
                            `${Number(r.center_lat).toFixed(3)}, ${Number(
                              r.center_lng
                            ).toFixed(3)}`}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <GaugeCircle className={cn("h-4 w-4", riskColor(risk))} />
                      <span className="font-mono text-lg font-semibold">
                        {Number(r.absorption_score).toFixed(0)}
                      </span>
                    </div>
                  </div>

                  {/* Composition bar */}
                  <div className="mt-4 flex h-2 w-full overflow-hidden rounded-full bg-muted">
                    {ORDER.map((key) => {
                      const pct = Number(r.land_cover?.[key] ?? 0);
                      if (pct <= 0) return null;
                      return (
                        <div
                          key={key}
                          style={{
                            width: `${pct}%`,
                            backgroundColor: LAND_COVER_META[key].token,
                          }}
                          title={`${LAND_COVER_META[key].label}: ${pct}%`}
                        />
                      );
                    })}
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 font-medium border",
                        risk === "low"
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : risk === "moderate"
                          ? "border-warning/30 bg-warning/10 text-warning"
                          : "border-destructive/30 bg-destructive/10 text-destructive"
                      )}
                    >
                      {riskLabel(risk)} risk
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString()}
                      </span>
                      <Link
                        to={mapHref}
                        className="flex items-center gap-0.5 font-medium text-muted-foreground opacity-70 transition-all hover:text-primary group-hover:opacity-100"
                        aria-label={`Open ${r.name} in the map`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        View area
                        <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
