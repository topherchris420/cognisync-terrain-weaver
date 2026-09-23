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

function minuteTicks(series: HydrographPoint[]): number[] {
  const end = series[series.length - 1]?.tMin ?? 60;
  const ticks: number[] = [];
  for (let t = 0; t <= end; t += 15) ticks.push(t);
  return ticks;
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
      <div className="mb-2 mt-6 flex items-baseline justify-between gap-2">
        <h4 className="atlas-subtitle">Discharge over the storm</h4>
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
          peak <span className="text-foreground">{peakM3s.toFixed(2)} m³/s</span>
        </span>
      </div>
      <div className="h-36 w-full" role="img" aria-label="Storm runoff hydrograph">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="mannahatta-q" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#56c3df" stopOpacity={0.42} />
                <stop offset="100%" stopColor="#56c3df" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 6" vertical={false} />
            <XAxis
              dataKey="tMin"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
              type="number"
              domain={[0, "dataMax"]}
              ticks={minuteTicks(series)}
              tickFormatter={(value: number, index: number) =>
                index === minuteTicks(series).length - 1 ? `${value} min` : `${value}`
              }
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
                borderRadius: 4,
                fontSize: 11,
              }}
              cursor={{ stroke: "hsl(var(--muted-foreground))", strokeDasharray: "2 3" }}
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
              stroke="#8fdcec"
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
