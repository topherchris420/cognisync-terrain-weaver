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
    { key: "stored", label: "Stored", value: balance.storedM3, className: "bg-accent" },
    { key: "runoff", label: "Runoff", value: balance.runoffM3, className: "bg-warning" },
  ];

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Water balance
        </h4>
        <span className="font-mono text-[11px] text-muted-foreground">
          {Math.round(total).toLocaleString()} m³ rain
        </span>
      </div>
      <div
        className="flex h-2.5 overflow-hidden rounded-full border border-border bg-muted"
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
            <dt className="text-muted-foreground">{segment.label}</dt>
            <dd className="font-mono font-semibold">
              {Math.round(segment.value).toLocaleString()} m³
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
