import { useEffect, useState } from "react";
import { LAND_COVER_META, type LandCover, type LandCoverKey } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Info } from "lucide-react";

interface Props {
  cover: LandCover;
  animated?: boolean;
}

const ORDER: LandCoverKey[] = [
  "vegetation",
  "soil",
  "water",
  "buildings",
  "pavement",
];

export function LandCoverBreakdown({ cover, animated = true }: Props) {
  const [displayValues, setDisplayValues] = useState(
    animated ? ORDER.map(() => 0) : ORDER.map((key) => cover[key] || 0)
  );
  const total = Object.values(cover).reduce((a, b) => a + b, 0) || 1;

  // Animate values
  useEffect(() => {
    if (!animated) {
      setDisplayValues(ORDER.map((key) => cover[key] || 0));
      return;
    }

    const duration = 1200;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      setDisplayValues(
        ORDER.map((key) => (cover[key] || 0) * eased)
      );

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [cover, animated]);

  return (
    <div className="space-y-5">
      {/* Stacked composition bar with enhanced styling */}
      <div className="relative">
        <div className="flex h-4 w-full overflow-hidden rounded-lg bg-muted/40 shadow-inner">
          {ORDER.map((key) => {
            const currentValue = displayValues[ORDER.indexOf(key)];
            const pct = (currentValue / (Object.values(cover).reduce((a, b) => a + b, 0) || 1)) * 100;
            if (pct <= 0) return null;
            return (
              <div
                key={key}
                className={cn(
                  "h-full transition-all duration-300 ease-out border-r border-black/10 last:border-r-0",
                  key === "vegetation" && "bg-surface-vegetation",
                  key === "soil" && "bg-surface-soil",
                  key === "water" && "bg-surface-water",
                  key === "buildings" && "bg-surface-building",
                  key === "pavement" && "bg-surface-pavement"
                )}
                style={{
                  width: `${pct}%`,
                }}
                title={`${LAND_COVER_META[key].label}: ${pct.toFixed(1)}%`}
              />
            );
          })}
        </div>

        {/* Subtle border */}
        <div className="absolute inset-0 rounded-lg border border-border/50 pointer-events-none" />
      </div>

      {/* Per-class rows with enhanced styling */}
      <div className="space-y-3">
        {ORDER.map((key, index) => {
          const currentValue = displayValues[ORDER.indexOf(key)];
          const value = cover[key] || 0;
          const pct = (value / total) * 100;
          const meta = LAND_COVER_META[key];

          const getColorClass = () => {
            switch (key) {
              case "vegetation":
                return "bg-surface-vegetation";
              case "soil":
                return "bg-surface-soil";
              case "water":
                return "bg-surface-water";
              case "buildings":
                return "bg-surface-building";
              case "pavement":
                return "bg-surface-pavement";
              default:
                return "bg-muted";
            }
          };

          return (
            <div
              key={key}
              className="group relative"
              style={{
                animationDelay: `${index * 100}ms`,
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className={cn(
                      "h-3 w-3 rounded-md shadow-sm",
                      getColorClass()
                    )}
                  />
                  <span className="text-sm font-medium">{meta.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono tabular-nums text-sm font-semibold text-foreground">
                    {pct.toFixed(1)}%
                  </span>
                  <div className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                    <Info className="h-3.5 w-3.5" />
                  </div>
                </div>
              </div>

              {/* Progress bar for each type */}
              <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted/30">
                <div
                  className={cn(
                    "h-full transition-all duration-1000 ease-out",
                    getColorClass()
                  )}
                  style={{
                    width: animated ? `${(currentValue / total) * 100}%` : `${pct}%`,
                  }}
                />
              </div>

              {/* Hint on hover */}
              <div className="absolute left-0 -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-card border border-border rounded-md text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 whitespace-nowrap shadow-lg">
                {meta.hint}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="pt-3 border-t border-border/50">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Total coverage</span>
          <span className="font-mono font-semibold">100%</span>
        </div>
      </div>
    </div>
  );
}