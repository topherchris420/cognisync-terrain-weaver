import { useEffect, useState } from "react";
import { Sprout, Droplets, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import type { Recommendation } from "@/lib/types";

interface Props {
  items: Recommendation[];
  onExport?: (recs: Recommendation[]) => void;
}

const CATEGORY_META = {
  green: {
    icon: Sprout,
    label: "Green infrastructure",
    className: "text-primary",
  },
  blue: {
    icon: Droplets,
    label: "Blue infrastructure",
    className: "text-[#8fdcec]",
  },
  gray: {
    icon: Building2,
    label: "Gray infrastructure",
    className: "text-muted-foreground",
  },
} as const;

const PRIORITY_META = {
  high: {
    className: "text-destructive",
    label: "High priority",
  },
  medium: {
    className: "text-warning",
    label: "Medium priority",
  },
  low: {
    className: "text-muted-foreground",
    label: "Low priority",
  },
} as const;

export function RecommendationsList({ items }: Props) {
  const reduceMotion = usePrefersReducedMotion();
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

    if (reduceMotion) {
      setVisibleItems(items.map((_, i) => i));
      return;
    }

    const timers = items.map((_, i) =>
      setTimeout(() => {
        setVisibleItems((prev) => [...prev, i]);
      }, i * 150)
    );

    return () => timers.forEach(clearTimeout);
  }, [items, reduceMotion]);

  if (!items?.length) {
    return (
      <div className="atlas-empty">
        <p>No recommendations yet.</p>
        <p>A live scan proposes adaptation strategies from its land cover.</p>
      </div>
    );
  }

  return (
    <ol className="atlas-recs">
      {items.map((rec, i) => {
        const cat = CATEGORY_META[rec.category] ?? CATEGORY_META.green;
        const Icon = cat.icon;
        const priority = PRIORITY_META[rec.priority];
        const isVisible = visibleItems.includes(i);

        return (
          <li
            key={i}
            className={cn(
              "atlas-rec transition-all duration-500 motion-reduce:transition-none",
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
            )}
          >
            <span className={cn("atlas-rec-icon", cat.className)} title={cat.label}>
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="sr-only">{cat.label}</span>
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h4 className="text-sm font-medium text-foreground">{rec.title}</h4>
                <span className={cn("atlas-rec-priority", priority.className)}>{priority.label}</span>
              </div>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{rec.description}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
