import { cn } from "@/lib/utils";
import type { WaterBalance } from "@/lib/counterfactual/types";

interface WaterBalanceMeterProps {
  balance: WaterBalance;
  className?: string;
}

function share(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, (part / total) * 100));
}

export function WaterBalanceMeter({ balance, className }: WaterBalanceMeterProps) {
  const total = balance.rainfallM3;
  const segments = [
    { key: "infiltrated", label: "Infiltrated", value: balance.infiltratedM3, className: "bg-primary" },
    { key: "stored", label: "Stored", value: balance.storedM3, className: "bg-[hsl(var(--surface-soil))]" },
    { key: "runoff", label: "Runoff", value: balance.runoffM3, className: "bg-[#56c3df]" },
  ];

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="atlas-subtitle">Where the rain went</h4>
        <span className="font-mono text-[11px] text-muted-foreground">
          {Math.round(total).toLocaleString()} m³ rain
        </span>
      </div>
      <div
        className="flex h-2 gap-px overflow-hidden rounded-sm bg-muted"
        role="img"
        aria-label="Rainfall partitioned into infiltration, storage, and runoff"
      >
        {segments.map((segment) => (
          <div
            key={segment.key}
            className={segment.className}
            style={{ width: `${share(segment.value, total)}%` }}
            title={`${segment.label}: ${Math.round(segment.value).toLocaleString()} m³`}
          />
        ))}
      </div>
      <dl className="grid grid-cols-3 gap-2 text-[11px]">
        {segments.map((segment) => (
          <div key={segment.key}>
            <dt className="flex items-center gap-1.5 text-muted-foreground"><span className={cn("h-1.5 w-1.5 rounded-full", segment.className)} aria-hidden="true" />{segment.label}</dt>
            <dd className="mt-0.5 font-mono tabular-nums text-foreground">
              {Math.round(segment.value).toLocaleString()} m³
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
