import { cn } from "@/lib/utils";
import { classifyFloodRisk, riskColor, riskLabel } from "@/lib/absorption";

interface Props {
  score: number;
  className?: string;
}

export function AbsorptionScoreGauge({ score, className }: Props) {
  const clamped = Math.max(0, Math.min(100, score));
  const circumference = 2 * Math.PI * 52;
  const dashOffset = circumference * (1 - clamped / 100);
  const risk = classifyFloodRisk(clamped);

  // Score colour smoothly follows risk band
  const strokeClass =
    risk === "low"
      ? "stroke-primary"
      : risk === "moderate"
      ? "stroke-warning"
      : "stroke-destructive";

  return (
    <div className={cn("flex items-center gap-4", className)}>
      <div className="relative h-32 w-32 shrink-0">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <circle
            cx="60"
            cy="60"
            r="52"
            className="stroke-muted"
            strokeWidth="8"
            fill="none"
          />
          <circle
            cx="60"
            cy="60"
            r="52"
            className={cn("transition-all duration-1000", strokeClass)}
            strokeWidth="8"
            strokeLinecap="round"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-mono text-3xl font-semibold">
            {clamped.toFixed(0)}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            /100
          </div>
        </div>
      </div>
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">
          Urban Absorption Score
        </div>
        <div className="mt-1 text-lg font-semibold">
          {clamped >= 65
            ? "Resilient"
            : clamped >= 40
            ? "Vulnerable"
            : "Critical"}
        </div>
        <div className="mt-1 text-sm">
          Flood risk:{" "}
          <span className={cn("font-medium", riskColor(risk))}>
            {riskLabel(risk)}
          </span>
        </div>
      </div>
    </div>
  );
}
