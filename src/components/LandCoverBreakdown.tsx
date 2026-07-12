import { LAND_COVER_META, type LandCover, type LandCoverKey } from "@/lib/types";

interface Props {
  cover: LandCover;
}

const ORDER: LandCoverKey[] = [
  "vegetation",
  "soil",
  "water",
  "buildings",
  "pavement",
];

export function LandCoverBreakdown({ cover }: Props) {
  const total = Object.values(cover).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="space-y-4">
      {/* Stacked composition bar */}
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
        {ORDER.map((key) => {
          const pct = ((cover[key] || 0) / total) * 100;
          if (pct <= 0) return null;
          return (
            <div
              key={key}
              className="h-full transition-all"
              style={{
                width: `${pct}%`,
                backgroundColor: LAND_COVER_META[key].token,
              }}
              title={`${LAND_COVER_META[key].label}: ${pct.toFixed(1)}%`}
            />
          );
        })}
      </div>

      {/* Per-class rows */}
      <div className="space-y-2.5">
        {ORDER.map((key) => {
          const value = cover[key] || 0;
          const pct = (value / total) * 100;
          const meta = LAND_COVER_META[key];
          return (
            <div key={key} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: meta.token }}
                  />
                  <span className="font-medium">{meta.label}</span>
                </div>
                <span className="font-mono tabular-nums text-muted-foreground">
                  {pct.toFixed(1)}%
                </span>
              </div>
              <div className="text-xs text-muted-foreground pl-4">
                {meta.hint}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
