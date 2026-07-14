import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { classifyFloodRisk, riskLabel } from "@/lib/absorption";
import { cn } from "@/lib/utils";

interface Scan {
  id: string;
  name: string;
  location_label: string | null;
  absorption_score: number;
}

/**
 * Real scans, or nothing at all.
 *
 * This is the enforcement point for the project's no-fabricated-data rule. If
 * the table is empty or the query fails, it renders null. It must never fall
 * back to placeholder rows, sample cities, or invented counts -- the whole
 * argument for showing this strip is that the numbers are real.
 */
export function RecentScans() {
  const [scans, setScans] = useState<Scan[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("analyses")
        .select("id,name,location_label,absorption_score")
        .not("location_label", "is", null)
        .order("created_at", { ascending: false })
        .limit(5);

      if (cancelled) return;
      setScans(error || !data ? [] : (data as unknown as Scan[]));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!scans || scans.length === 0) return null;

  return (
    <section className="border-b border-border/60">
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Recently scanned
          </h2>
          <Link
            to="/dashboard"
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Browse all scans →
          </Link>
        </div>

        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {scans.map((s) => {
            const score = Number(s.absorption_score);
            const risk = classifyFloodRisk(score);
            const tone =
              risk === "low"
                ? "text-primary"
                : risk === "moderate"
                ? "text-warning"
                : "text-destructive";

            return (
              <li key={s.id}>
                <Link
                  to="/dashboard"
                  className="panel flex items-baseline justify-between gap-3 rounded-lg border border-border px-4 py-3 transition-colors hover:border-primary/40"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {s.location_label ?? s.name}
                    </div>
                    <div className={cn("text-xs", tone)}>
                      {riskLabel(risk)} risk
                    </div>
                  </div>
                  <span
                    className={cn(
                      "font-mono text-xl font-semibold tabular-nums",
                      tone
                    )}
                  >
                    {score.toFixed(0)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
