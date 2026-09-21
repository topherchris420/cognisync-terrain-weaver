import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { HydrographPoint } from "@/lib/hydrology";

interface StormHydrographProps {
  series: HydrographPoint[];
  peakM3s: number;
}

export function StormHydrograph({ series, peakM3s }: StormHydrographProps) {
  if (series.length < 2) {
    return (
      <p className="text-xs text-muted-foreground">
        Hydrograph unavailable for this run.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Design-storm hydrograph
        </h4>
        <span className="font-mono text-[11px] text-primary">
          Qp {peakM3s.toFixed(2)} m³/s
        </span>
      </div>
      <div className="h-36 w-full" role="img" aria-label="Storm runoff hydrograph">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="mannahatta-q" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.45} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 6" vertical={false} />
            <XAxis
              dataKey="tMin"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
              tickFormatter={(value: number) => `${value}m`}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={36}
            />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                fontSize: 11,
              }}
              formatter={(value, name) =>
                name === "qM3s"
                  ? [`${Number(value).toFixed(2)} m³/s`, "Discharge"]
                  : [`${Number(value).toFixed(1)} mm/h`, "Rainfall"]
              }
              labelFormatter={(label) => `t = ${label} min`}
            />
            <Area
              type="monotone"
              dataKey="qM3s"
              stroke="hsl(var(--primary))"
              fill="url(#mannahatta-q)"
              strokeWidth={2}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
