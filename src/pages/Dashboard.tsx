import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AppNav } from "@/components/AppNav";
import { SiteComparison } from "@/components/SiteComparison";
import { supabase } from "@/integrations/supabase/client";
import type { AnalysisRecord } from "@/lib/types";
import { classifyFloodRisk, riskLabel, RISK_BANDS } from "@/lib/absorption";
import { BASELINE_SCORE } from "@/lib/baseline";
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
  Layers,
  Search,
  AlertTriangle,
  RotateCcw,
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
import "@/styles/atlas.css";

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

// Bound each attempt so a stalled connection surfaces the error/retry UI
// instead of leaving the feed on skeletons forever. Paired with retry: 1 on
// the query, the worst-case wait before the error state is ~2 × this (plus
// backoff) — around 20s, down from the ~48s of three 15s attempts.
const FEED_TIMEOUT_MS = 10_000;

async function fetchAnalyses(signal: AbortSignal): Promise<AnalysisRecord[]> {
  const { data, error } = await supabase
    .from("analyses")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50)
    .abortSignal(AbortSignal.any([signal, AbortSignal.timeout(FEED_TIMEOUT_MS)]));
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as AnalysisRecord[];
}

export default function Dashboard() {
  usePageTitle("Dashboard");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [compareMode, setCompareMode] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [hoverId, setHoverId] = useState<string | null>(null);

  const {
    data: rows,
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["analyses"],
    queryFn: ({ signal }) => fetchAnalyses(signal),
    // One retry, not the app-wide default of two: a public feed should reach
    // its error+Retry state in ~20s on a dead network, not sit on skeletons.
    retry: 1,
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

  const displayName = (r: AnalysisRecord) =>
    !r.name || /^untitled/i.test(r.name.trim()) ? r.location_label || "Untitled site" : r.name;
  const displayPlace = (r: AnalysisRecord) =>
    displayName(r) === r.location_label || !r.location_label
      ? `${Number(r.center_lat).toFixed(3)}°, ${Number(r.center_lng).toFixed(3)}°`
      : r.location_label;

  return (
    <div className="atlas-app atlas-page flex min-h-screen flex-col">
      <AppNav />
      <main id="main" className="atlas-index mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-10 md:px-8 md:pt-14">
        <div className="atlas-index-head">
          <div>
            <h1>The public index</h1>
            <p className="atlas-index-lede">
              {stats ? (
                <>
                  {stats.total} {stats.total === 1 ? "site" : "sites"} scanned by the platform. The median absorbs{" "}
                  <strong>{stats.median.toFixed(1)}</strong>, about{" "}
                  {Math.round((stats.median / BASELINE_SCORE) * 100)}% of the estimated{" "}
                  {BASELINE_SCORE.toFixed(0)} for Mannahatta in 1609.
                </>
              ) : (
                "Every live scan run on the platform, in one public feed."
              )}
            </p>
          </div>
          <Button asChild className="atlas-primary h-11 gap-2 px-5">
            <Link to="/">
              Analyze a place
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        {stats && stats.total >= 3 && rows && (
          <figure className="atlas-strip" aria-labelledby="strip-caption">
            <div
              className="atlas-strip-plot"
              role="img"
              aria-label={`Absorption scores of ${stats.total} sites on a 0 to 100 scale. ${stats.highRisk} high risk, ${stats.lowRisk} low risk, median ${stats.median.toFixed(1)}, against an estimated pre-development baseline of ${BASELINE_SCORE.toFixed(1)}.`}
            >
              <span className="atlas-strip-band atlas-strip-band--high" style={{ left: 0, right: `${100 - RISK_BANDS.moderate}%` }} />
              <span className="atlas-strip-band atlas-strip-band--moderate" style={{ left: `${RISK_BANDS.moderate}%`, right: `${100 - RISK_BANDS.low}%` }} />
              <span className="atlas-strip-band atlas-strip-band--low" style={{ left: `${RISK_BANDS.low}%`, right: 0 }} />
              <span className="atlas-strip-rule atlas-strip-rule--baseline" style={{ left: `${BASELINE_SCORE}%` }} />
              <span className="atlas-strip-rule atlas-strip-rule--median" style={{ left: `${stats.median}%` }} />
              {rows.map((r) => {
                const score = Math.max(0, Math.min(100, Number(r.absorption_score)));
                const risk = classifyFloodRisk(score);
                return (
                  <span
                    key={r.id}
                    className={cn("atlas-strip-dot", `atlas-strip-dot--${risk}`, hoverId === r.id && "is-hover")}
                    style={{ left: `${score}%`, top: `${14 + jitter(r.id) * 72}%` }}
                    title={`${displayName(r)}: ${score.toFixed(0)}`}
                    onPointerEnter={() => setHoverId(r.id)}
                    onPointerLeave={() => setHoverId(null)}
                  />
                );
              })}
            </div>
            <div className="atlas-strip-axis" aria-hidden="true">
              <span style={{ left: 0 }}>0</span>
              <span style={{ left: "50%" }}>50</span>
              <span style={{ left: "100%" }}>100</span>
              <span className="atlas-strip-flag" style={{ left: `${stats.median}%` }}>median {stats.median.toFixed(1)}</span>
              <span className="atlas-strip-flag atlas-strip-flag--baseline" style={{ left: `${BASELINE_SCORE}%` }}>1609 · {BASELINE_SCORE.toFixed(0)}</span>
            </div>
            <figcaption id="strip-caption" className="atlas-strip-legend">
              <span><i className="atlas-strip-key atlas-strip-key--high" />High risk · {stats.highRisk}</span>
              <span><i className="atlas-strip-key atlas-strip-key--moderate" />Moderate · {stats.total - stats.highRisk - stats.lowRisk}</span>
              <span><i className="atlas-strip-key atlas-strip-key--low" />Low risk · {stats.lowRisk}</span>
              <span className="text-muted-foreground">Mean {stats.avg.toFixed(1)}</span>
            </figcaption>
          </figure>
        )}

        {rows && rows.length > 0 && (
          <div className="atlas-index-controls">
            <div className="relative flex-1 min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by site name or location…"
                className="h-10 w-full pl-9"
                aria-label="Search analyses"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
                <SelectTrigger className="h-10 w-full sm:w-[170px]" aria-label="Sort analyses">
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
                className="h-10 gap-2 flex-1 sm:flex-initial"
                onClick={toggleCompareMode}
                aria-pressed={compareMode}
              >
                <ArrowLeftRight className="h-4 w-4" />
                {compareMode ? "Comparing" : "Compare"}
              </Button>
              <div className="flex items-center gap-1.5 w-full sm:w-auto" role="group" aria-label="Export the feed">
                <Button
                  variant="outline"
                  className="h-10 gap-2 flex-1 sm:flex-none"
                  onClick={() => exportFeed("geojson", visible)}
                  title="Export the visible sites as GeoJSON (QGIS / ArcGIS)"
                >
                  <FileJson className="h-4 w-4" />
                  GeoJSON
                </Button>
                <Button
                  variant="outline"
                  className="h-10 gap-2 flex-1 sm:flex-none"
                  onClick={() => exportFeed("csv", visible)}
                  title="Export the visible sites as CSV"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  CSV
                </Button>
              </div>
            </div>
          </div>
        )}

        {compareMode && !comparePair && (
          <p className="atlas-index-hint" role="status">
            <ArrowLeftRight className="h-4 w-4 shrink-0" aria-hidden="true" />
            Select two sites to compare them side by side
            {compareIds.length === 1 && " — one selected, pick another"}.
          </p>
        )}

        {comparePair && (
          <SiteComparison
            a={comparePair[0]}
            b={comparePair[1]}
            onClose={() => setCompareIds([])}
          />
        )}

        {isPending && (
          <div className="atlas-ledger-list" role="status" aria-label="Loading analyses">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="atlas-ledger-row">
                <Skeleton className="h-3 w-6" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
                <Skeleton className="hidden h-1.5 w-full md:block" />
                <Skeleton className="h-6 w-10 justify-self-end" />
              </div>
            ))}
          </div>
        )}

        {isError && (
          <div className="atlas-index-empty">
            <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden="true" />
            <h2>Couldn't load the feed</h2>
            <p>{error instanceof Error ? error.message : "Unknown error"}</p>
            <Button variant="outline" className="mt-5 gap-2" onClick={() => refetch()}>
              <RotateCcw className="h-4 w-4" />
              Retry
            </Button>
          </div>
        )}

        {rows && rows.length === 0 && (
          <div className="atlas-index-empty">
            <Layers className="h-5 w-5 text-primary" aria-hidden="true" />
            <h2>No analyses yet</h2>
            <p>Be the first to scan a site and populate the public feed.</p>
            <Button asChild className="atlas-primary mt-5">
              <Link to="/">Run first analysis</Link>
            </Button>
          </div>
        )}

        {rows && rows.length > 0 && visible.length === 0 && (
          <div className="atlas-index-empty">
            <Search className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <h2>No analyses match “{query}”</h2>
            <p>Try a city, a neighbourhood, or part of a site name.</p>
          </div>
        )}

        {visible.length > 0 && (
          <ol className="atlas-ledger-list">
            <li className="atlas-ledger-row atlas-ledger-row--head" aria-hidden="true">
              <span>№</span>
              <span>Site</span>
              <span className="hidden md:block">Land cover</span>
              <span className="text-right">Score</span>
              <span className="hidden sm:block">Risk</span>
              <span className="hidden lg:block text-right">Scanned</span>
              <span />
            </li>
            {visible.map((r, index) => {
              const score = Number(r.absorption_score);
              const risk = classifyFloodRisk(score);
              const mapHref = `/?lat=${Number(r.center_lat).toFixed(
                5
              )}&lng=${Number(r.center_lng).toFixed(5)}&zoom=${Number(
                r.zoom
              ).toFixed(1)}`;
              const selected = compareIds.includes(r.id);
              const name = displayName(r);
              return (
                <li
                  key={r.id}
                  className={cn(
                    "atlas-ledger-row",
                    compareMode && "is-selectable",
                    selected && "is-selected",
                    hoverId === r.id && "is-hover"
                  )}
                  onPointerEnter={() => setHoverId(r.id)}
                  onPointerLeave={() => setHoverId(null)}
                  // In compare mode the row is a toggle, and must be one for
                  // the keyboard too. The keydown guard ignores Enter/Space
                  // bubbling up from the inner "Open" link.
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
                      ? `${selected ? "Remove" : "Select"} ${name} for comparison`
                      : undefined
                  }
                >
                  <span className="atlas-ledger-index">{String(index + 1).padStart(2, "0")}</span>
                  <div className="min-w-0">
                    <h3 className="atlas-ledger-name">{name}</h3>
                    <p className="atlas-ledger-place">
                      <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                      <span className="truncate">{displayPlace(r)}</span>
                    </p>
                  </div>
                  <div className="atlas-ledger-cover hidden md:flex" aria-hidden="true">
                    {ORDER.map((key) => {
                      const pct = Number(r.land_cover?.[key] ?? 0);
                      if (pct <= 0) return null;
                      return (
                        <span
                          key={key}
                          style={{ flexGrow: pct, backgroundColor: LAND_COVER_META[key].token }}
                          title={`${LAND_COVER_META[key].label}: ${pct}%`}
                        />
                      );
                    })}
                  </div>
                  <span className="atlas-ledger-score">{score.toFixed(0)}</span>
                  <span className={cn("atlas-ledger-risk hidden sm:inline-flex", `atlas-ledger-risk--${risk}`)}>
                    {riskLabel(risk)}
                  </span>
                  <span className="atlas-ledger-date hidden lg:block">
                    {new Date(r.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                  <Link
                    to={mapHref}
                    className="atlas-ledger-open"
                    aria-label={`Open ${name} in the map`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="hidden sm:inline">Open</span>
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </main>
    </div>
  );
}

/** Stable vertical scatter per site, so dots never jump between renders. */
function jitter(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}
