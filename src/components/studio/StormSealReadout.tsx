import { Check, X, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatSealedAt,
  type DeterminismReport,
  type StormSeal,
} from "@/lib/storm-identity";

interface Props {
  seal: StormSeal;
  rerunSeal?: StormSeal | null;
  report?: DeterminismReport | null;
  className?: string;
}

/**
 * Visible provenance for the storm forcing: seed, hash, timestamps, and the
 * explicit determinism checks proving NOW and POSSIBLE ran the same storm.
 */
export function StormSealReadout({ seal, rerunSeal, report, className }: Props) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/60 bg-background/85 backdrop-blur-xl p-4 shadow-2xl",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Storm Seal
        </span>
        {report && (
          <span
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider",
              report.identical
                ? "bg-primary/15 text-primary"
                : "bg-destructive/15 text-destructive"
            )}
          >
            <Shield className="h-3 w-3" />
            {report.identical ? "Same storm verified" : "Storm mismatch"}
          </span>
        )}
      </div>

      <dl className="space-y-1.5 font-mono text-[11px]">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Seed</dt>
          <dd className="text-foreground">{seal.shortSeed}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Hash</dt>
          <dd className="truncate text-foreground">{seal.storm.hash}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Forcing</dt>
          <dd className="text-foreground">
            {seal.storm.rainfallDepthMm}mm / {seal.storm.durationMinutes}min ·{" "}
            {seal.storm.distribution} · {seal.storm.resolution}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">NOW run</dt>
          <dd className="text-foreground">{formatSealedAt(seal.sealedAt)}</dd>
        </div>
        {rerunSeal && (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">POSSIBLE run</dt>
            <dd className="text-foreground">{formatSealedAt(rerunSeal.sealedAt)}</dd>
          </div>
        )}
      </dl>

      {report && (
        <ul className="mt-3 space-y-1 border-t border-border/40 pt-3">
          {report.checks.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-3 text-[11px]"
            >
              <span className="flex items-center gap-1.5 text-muted-foreground">
                {c.passed ? (
                  <Check className="h-3 w-3 text-primary" />
                ) : (
                  <X className="h-3 w-3 text-destructive" />
                )}
                {c.label}
              </span>
              <span className="font-mono text-foreground/80 truncate max-w-[45%]">
                {c.passed ? c.now : `${c.now} ≠ ${c.possible}`}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
        Seed and hash derive only from storm physics; timestamps are recorded but
        excluded from identity. Matching seals mean both realities were forced by
        the identical storm under this simulation.
      </p>
    </div>
  );
}
