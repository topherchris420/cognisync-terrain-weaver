import { Sprout, Droplets, Building2, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Recommendation } from "@/lib/types";

interface Props {
  items: Recommendation[];
}

const CATEGORY_META = {
  green: {
    icon: Sprout,
    label: "Green infrastructure",
    className: "text-primary bg-primary/10 border-primary/30",
  },
  blue: {
    icon: Droplets,
    label: "Blue infrastructure",
    className: "text-accent bg-accent/10 border-accent/30",
  },
  gray: {
    icon: Building2,
    label: "Gray infrastructure",
    className: "text-muted-foreground bg-muted border-border",
  },
} as const;

const PRIORITY_META = {
  high: "bg-destructive/15 text-destructive border-destructive/30",
  medium: "bg-warning/15 text-warning border-warning/30",
  low: "bg-muted text-muted-foreground border-border",
} as const;

export function RecommendationsList({ items }: Props) {
  if (!items?.length) {
    return (
      <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        <TrendingUp className="mx-auto mb-2 h-5 w-5" />
        No recommendations yet. Run an analysis to generate adaptation strategies.
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((rec, i) => {
        const cat = CATEGORY_META[rec.category] ?? CATEGORY_META.green;
        const Icon = cat.icon;
        return (
          <li
            key={i}
            className="rounded-lg border border-border bg-card/50 p-4 transition-colors hover:border-primary/40"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border",
                    cat.className
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{rec.title}</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {rec.description}
                  </div>
                </div>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                  PRIORITY_META[rec.priority]
                )}
              >
                {rec.priority}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
