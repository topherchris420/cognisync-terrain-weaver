import { useEffect, useState } from "react";
import { Sprout, Droplets, Building2, TrendingUp, Lightbulb, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Recommendation } from "@/lib/types";
import { Button } from "@/components/ui/button";

interface Props {
  items: Recommendation[];
  onExport?: (recs: Recommendation[]) => void;
}

const CATEGORY_META = {
  green: {
    icon: Sprout,
    label: "Green infrastructure",
    className: "text-primary bg-primary/15 border-primary/30",
    accentClass: "bg-primary",
  },
  blue: {
    icon: Droplets,
    label: "Blue infrastructure",
    className: "text-accent bg-accent/15 border-accent/30",
    accentClass: "bg-accent",
  },
  gray: {
    icon: Building2,
    label: "Gray infrastructure",
    className: "text-muted-foreground bg-muted border-border",
    accentClass: "bg-muted-foreground",
  },
} as const;

const PRIORITY_META = {
  high: {
    className: "bg-destructive/15 text-destructive border-destructive/30",
    label: "High Priority",
  },
  medium: {
    className: "bg-warning/15 text-warning border-warning/30",
    label: "Medium Priority",
  },
  low: {
    className: "bg-muted/50 text-muted-foreground border-border",
    label: "Low Priority",
  },
} as const;

export function RecommendationsList({ items }: Props) {
  const [visibleItems, setVisibleItems] = useState<number[]>([]);

  // Staggered animation.
  //
  // Two bugs used to live here. The timers were never cleared, so unmounting
  // mid-reveal set state on a dead component; and visibleItems was never reset,
  // so a second analysis appended its indices to the first one's array -- leaving
  // items from the previous run's tail already "revealed" before their turn.
  // Reset up front, and clear every timer on teardown.
  useEffect(() => {
    setVisibleItems([]);
    if (!items?.length) return;

    const timers = items.map((_, i) =>
      setTimeout(() => {
        setVisibleItems((prev) => [...prev, i]);
      }, i * 150)
    );

    return () => timers.forEach(clearTimeout);
  }, [items]);

  if (!items?.length) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card/30 p-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
          <TrendingUp className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="text-sm font-medium">No recommendations yet</div>
        <div className="mt-1 text-xs text-muted-foreground">
          Run an analysis to generate adaptation strategies.
        </div>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((rec, i) => {
        const cat = CATEGORY_META[rec.category] ?? CATEGORY_META.green;
        const Icon = cat.icon;
        const priority = PRIORITY_META[rec.priority];
        const isVisible = visibleItems.includes(i);

        return (
          <li
            key={i}
            className={cn(
              "relative overflow-hidden rounded-xl border border-border bg-card/60 p-4 transition-all duration-500 hover:border-primary/50 hover:shadow-md",
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            )}
          >
            {/* Category accent bar */}
            <div
              className={cn(
                "absolute left-0 top-0 bottom-0 w-1 rounded-l-xl",
                cat.accentClass
              )}
            />

            <div className="flex items-start justify-between gap-3 pl-2">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
                    cat.className
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold">{rec.title}</div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                        priority.className
                      )}
                    >
                      {priority.label}
                    </span>
                  </div>
                  <div className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                    {rec.description}
                  </div>

                  {/* Category label */}
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Category:
                    </span>
                    <span
                      className={cn(
                        "text-[10px] font-medium",
                        rec.category === "green" && "text-primary",
                        rec.category === "blue" && "text-accent",
                        rec.category === "gray" && "text-muted-foreground"
                      )}
                    >
                      {cat.label}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </li>
        );
      })}

      {/* Summary footer */}
      <li className="pt-2">
        <div className="flex items-center justify-between rounded-lg bg-muted/30 px-4 py-2.5 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Lightbulb className="h-3.5 w-3.5" />
            <span>{items.length} recommendations generated</span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <ArrowRight className="h-3 w-3" />
            <span>Export report for details</span>
          </div>
        </div>
      </li>
    </ul>
  );
}