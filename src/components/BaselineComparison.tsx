import { useId } from "react";
import { cn } from "@/lib/utils";
import { classifyFloodRisk } from "@/lib/absorption";
import {
  BASELINE_SCORE,
  BASELINE_SOURCE,
  baselineSentence,
  compareToBaseline,
} from "@/lib/baseline";

interface Props {
  score: number;
  className?: string;
  /** Hides the provenance footnote where the page already carries one. */
  compact?: boolean;
}

/**
 * Where this site sits between fully paved ground and Mannahatta in 1609.
 *
 * The gauge answers "what is the score?". This answers "compared to what?" —
 * the question the gauge cannot, and the one every non-hydrologist asks first.
 * The whole scale is drawn, both ends labelled, so the site's marker lands
 * somewhere the eye can read without knowing anything about runoff.
 */
export function BaselineComparison({ score, className, compact = false }: Props) {
  const cmp = compareToBaseline(score);
  const risk = classifyFloodRisk(cmp.score);
  const headingId = useId();

  // The track spans 0..100 so the baseline marker sits at its true position on
  // the same axis as the score -- drawing 0..BASELINE_SCORE instead would
  // silently rescale the number the gauge just showed.
  const scoreLeft = cmp.score;
  const baselineLeft = BASELINE_SCORE;

  const fillClass =
    risk === "low"
      ? "bg-primary"
      : risk === "moderate"
      ? "bg-warning"
      : "bg-destructive";

  return (
    <section
      aria-labelledby={headingId}
      className={cn("panel rounded-xl border border-border p-5", className)}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3
          id={headingId}
          className="text-xs font-semibold uppercase tracking-widest text-muted-foreground"
        >
          Against the 1609 baseline
        </h3>
        <span className="font-mono text-xs text-muted-foreground">
          est. {BASELINE_SCORE.toFixed(1)} before the city
        </span>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-foreground">
        {baselineSentence(cmp)}
      </p>

      {/* The scale. Single track, both ends named, two markers. */}
      <div className="mt-6">
        <div
          className="relative h-2.5 w-full rounded-full bg-muted/50"
          role="img"
          aria-label={`Absorption score ${cmp.score.toFixed(
            1
          )} out of 100, against an estimated pre-development baseline of ${BASELINE_SCORE.toFixed(
            1
          )}.`}
        >
          <div
            className={cn(
              "absolute inset-y-0 left-0 rounded-full transition-[width] duration-1000 ease-out motion-reduce:transition-none",
              fillClass
            )}
            style={{ width: `${scoreLeft}%` }}
          />

          {/* Baseline tick — the reference, drawn as a wall rather than a dot
              so it reads as a threshold and not as a second data point. */}
          <div
            className="absolute -top-1 bottom-[-0.25rem] w-0.5 rounded-full bg-foreground/55"
            style={{ left: `${baselineLeft}%` }}
            aria-hidden="true"
          />
        </div>

        <div className="relative mt-2 h-4 text-[11px] text-muted-foreground">
          {/* Not "Fully paved": pavement carries a weight of 0.12, so a wholly
              paved tile scores 12, not 0. Labelling this end for a surface
              would put a real paved scan visibly to the right of its own
              label. Zero is zero absorption, and nothing else. */}
          <span className="absolute left-0">No absorption</span>
          {/* Centred on the tick, except near the right edge, where centring
              would hang the label off the panel. Guards against a recalibrated
              weight set pushing the baseline toward 100. */}
          <span
            className={cn(
              "absolute whitespace-nowrap font-medium text-foreground/80",
              baselineLeft <= 85 && "-translate-x-1/2"
            )}
            style={
              baselineLeft <= 85 ? { left: `${baselineLeft}%` } : { right: 0 }
            }
          >
            Mannahatta, 1609
          </span>
        </div>
      </div>

      {/* The two numbers behind the sentence, so it can be checked. Labelled
          as a comparison ("of benchmark", "below benchmark") rather than as
          retention or loss -- this site never held the benchmark's capacity to
          lose unless it happens to sit in Manhattan. */}
      <dl className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-background/40 p-3">
          <dt className="text-[11px] uppercase tracking-widest text-muted-foreground">
            Of benchmark
          </dt>
          <dd className="mt-1 font-mono text-xl font-semibold tabular-nums">
            {cmp.benchmarkPct}%
          </dd>
        </div>
        <div className="rounded-lg border border-border bg-background/40 p-3">
          <dt className="text-[11px] uppercase tracking-widest text-muted-foreground">
            Below benchmark
          </dt>
          <dd className="mt-1 font-mono text-xl font-semibold tabular-nums">
            {cmp.shortfall > 0 ? `−${cmp.shortfall.toFixed(1)}` : "0"}
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              pts
            </span>
          </dd>
        </div>
      </dl>

      {!compact && (
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          A fixed reference every site is measured against, wherever it is —
          not a reconstruction of what stood on this particular ground. It is
          our estimate of Manhattan's pre-development land cover, scored with
          the same weights as a live scan, and not a figure published by the
          Mannahatta Project. The island's ecology it is derived from is{" "}
          <a
            href={BASELINE_SOURCE.href}
            target="_blank"
            rel="noreferrer"
            className="underline decoration-dotted underline-offset-2 transition-colors hover:text-foreground"
          >
            {BASELINE_SOURCE.label}
          </a>
          .
        </p>
      )}
    </section>
  );
}
