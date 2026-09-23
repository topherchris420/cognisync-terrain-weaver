import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { classifyFloodRisk, riskLabel } from "@/lib/absorption";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";

interface Props {
  score: number;
  className?: string;
  animated?: boolean;
}

/**
 * The site's headline reading. The number carries the score; the 1609 scale
 * that follows it in the workbench answers "compared to what?", so this stays
 * a single figure rather than a second competing indicator.
 */
export function AbsorptionScoreGauge({ score, className, animated = true }: Props) {
  const reduceMotion = usePrefersReducedMotion();
  const [displayScore, setDisplayScore] = useState(animated ? 0 : score);
  const clamped = Math.max(0, Math.min(100, displayScore));
  const targetClamped = Math.max(0, Math.min(100, score));
  const risk = classifyFloodRisk(targetClamped);

  useEffect(() => {
    if (!animated || reduceMotion) {
      setDisplayScore(score);
      return;
    }

    const duration = 1100;
    const startTime = performance.now();
    let frame = 0;

    const animate = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setDisplayScore(Math.round(score * eased));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [score, animated, reduceMotion]);

  // The word and the pill must agree. Both derive from the same risk band --
  // independent thresholds here once let a score of 58 read "Vulnerable"
  // beside a pill that said "Low" risk.
  const statusText =
    risk === "low" ? "Resilient" : risk === "moderate" ? "Vulnerable" : "Critical";

  const tone =
    risk === "low" ? "text-primary" : risk === "moderate" ? "text-warning" : "text-destructive";

  return (
    <div className={cn("atlas-reading", className)}>
      <div className="atlas-reading-figure" aria-hidden="true">
        <span className="atlas-reading-number">{clamped.toFixed(0)}</span>
        <span className="atlas-reading-scale">/100</span>
      </div>
      <p className="sr-only">
        Urban absorption score {targetClamped.toFixed(0)} out of 100, {statusText}, {riskLabel(risk)} flood risk.
      </p>

      <div className="min-w-0 flex-1" aria-hidden="true">
        <div className="text-sm text-foreground">Urban absorption score</div>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className={cn("atlas-reading-status", tone)}>{statusText}</span>
          <span className="atlas-reading-pill">
            <span className={cn("atlas-reading-pip", tone)} />
            <span>{riskLabel(risk)}</span>
            <span className="text-muted-foreground">flood risk</span>
          </span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          How readily this ground takes in rain, weighted by its classified land cover.
        </p>
      </div>
    </div>
  );
}
