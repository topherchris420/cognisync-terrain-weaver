import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { classifyFloodRisk, riskLabel } from "@/lib/absorption";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface Props {
  score: number;
  className?: string;
  animated?: boolean;
}

export function AbsorptionScoreGauge({ score, className, animated = true }: Props) {
  const reduceMotion = usePrefersReducedMotion();
  const [displayScore, setDisplayScore] = useState(animated ? 0 : score);
  const clamped = Math.max(0, Math.min(100, displayScore));
  const circumference = 2 * Math.PI * 52;
  const dashOffset = circumference * (1 - clamped / 100);
  const targetClamped = Math.max(0, Math.min(100, score));
  const risk = classifyFloodRisk(targetClamped);

  // Animate score counting up
  useEffect(() => {
    if (!animated || reduceMotion) {
      setDisplayScore(score);
      return;
    }

    const duration = 1500;
    const startTime = Date.now();
    const startValue = 0;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function (ease-out-cubic)
      const eased = 1 - Math.pow(1 - progress, 3);

      setDisplayScore(Math.round(startValue + (score - startValue) * eased));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [score, animated, reduceMotion]);

  // Score colour smoothly follows risk band
  const strokeClass =
    risk === "low"
      ? "stroke-primary"
      : risk === "moderate"
      ? "stroke-warning"
      : "stroke-destructive";

  const getRiskIcon = () => {
    if (risk === "low") return <TrendingUp className="h-3.5 w-3.5" />;
    if (risk === "moderate") return <Minus className="h-3.5 w-3.5" />;
    return <TrendingDown className="h-3.5 w-3.5" />;
  };

  // The word and the pill must agree. Both derive from the same risk band --
  // independent thresholds here once let a score of 58 read "Vulnerable"
  // beside a pill that said "Low" risk.
  const statusText =
    risk === "low" ? "Resilient" : risk === "moderate" ? "Vulnerable" : "Critical";

  return (
    <div className={cn("flex items-center gap-5", className)}>
      {/* Enhanced gauge with glow effect */}
      <div className="relative h-32 w-32 shrink-0">
        {/* Outer glow ring */}
        <div
          className={cn(
            "absolute inset-0 rounded-full blur-xl opacity-30 transition-colors duration-1000",
            risk === "low" && "bg-primary",
            risk === "moderate" && "bg-warning",
            risk === "high" && "bg-destructive"
          )}
        />

        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          {/* Background track */}
          <circle
            cx="60"
            cy="60"
            r="52"
            className="stroke-muted/30"
            strokeWidth="10"
            fill="none"
          />

          {/* Progress arc */}
          <circle
            cx="60"
            cy="60"
            r="52"
            className={cn(
              "transition-all duration-1000 ease-out motion-reduce:transition-none",
              strokeClass
            )}
            strokeWidth="10"
            strokeLinecap="round"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{
              strokeDasharray: circumference,
              strokeDashoffset: dashOffset,
            }}
          />

          {/* Subtle inner highlight */}
          <circle
            cx="60"
            cy="60"
            r="46"
            className="stroke-white/5"
            strokeWidth="2"
            fill="none"
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="relative">
            <span className="font-mono text-3xl font-bold tracking-tight">
              {clamped.toFixed(0)}
            </span>
          </div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
            /100
          </div>
        </div>
      </div>

      {/* Info section */}
      <div className="min-w-0 flex-1">
        <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
          Urban Absorption Score
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <div
            className={cn(
              "text-xl font-bold tracking-tight",
              risk === "low" && "text-primary",
              risk === "moderate" && "text-warning",
              risk === "high" && "text-destructive"
            )}
          >
            {statusText}
          </div>
          <div
            className={cn(
              "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
              risk === "low" && "bg-primary/15 text-primary",
              risk === "moderate" && "bg-warning/15 text-warning",
              risk === "high" && "bg-destructive/15 text-destructive"
            )}
          >
            {getRiskIcon()}
            <span>{riskLabel(risk)}</span>
          </div>
        </div>

        <div className="mt-1.5 text-sm text-muted-foreground">
          Flood risk level
        </div>

        {/* No second bar here. There used to be one, filling to (100 - score) --
            so a resilient site scoring 90 rendered a 10% bar, directly beneath an
            arc that had just filled to 90%. Two unlabelled indicators, both
            coloured by risk band, moving in opposite directions. The arc already
            encodes the score and the pill already names the band. */}
      </div>
    </div>
  );
}