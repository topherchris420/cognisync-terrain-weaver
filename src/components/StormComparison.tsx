import { useId, useMemo, useState } from "react";
import { compareStorm, stormSweep, STORM_DEPTHS_MM, STORM_PROVENANCE } from "@/lib/paired-storm";
import { formatVolumeM3, type Scenario } from "@/lib/scenario";
import type { LandCover } from "@/lib/types";

interface Props { cover: LandCover; scenario: Scenario; areaM2: number }

export function StormComparison({ cover, scenario, areaM2 }: Props) {
  const id = useId();
  const [rainfallMm, setRainfallMm] = useState(50);
  const result = useMemo(() => compareStorm(cover, scenario, areaM2, rainfallMm), [cover, scenario, areaM2, rainfallMm]);
  const sweep = useMemo(() => stormSweep(cover, scenario, areaM2), [cover, scenario, areaM2]);
  const maxRunoff = Math.max(1, ...sweep.map((point) => point.now.runoffM3));
  const x = (depth: number) => 48 + depth / 200 * 300;
  const y = (runoff: number) => 140 - runoff / maxRunoff * 112;
  const points = (future: "now" | "possible") => [`${x(0)},${y(0)}`, ...sweep.map((point) => `${x(point.rainfallMm)},${y(point[future].runoffM3)}`)].join(" ");

  return (
    <section aria-labelledby={`${id}-heading`} className="space-y-4 border border-border/70 bg-background/40 p-4">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">Rainfall sensitivity / land budget</p>
        <h3 id={`${id}-heading`} className="mt-1 text-lg font-semibold">One storm. Two futures.</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Change the rainfall; hold the land and intervention plan constant.</p>
      </div>

      <div>
        <label htmlFor={`${id}-rain`} className="flex justify-between text-xs"><span>Total storm rainfall</span><span className="font-mono">{rainfallMm} mm</span></label>
        <input id={`${id}-rain`} type="range" min={0} max={200} step={1} value={rainfallMm} onChange={(event) => setRainfallMm(Number(event.target.value))} className="mt-3 w-full accent-primary" />
        <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Storm depth presets">
          {STORM_DEPTHS_MM.map((depth) => <button type="button" key={depth} aria-pressed={rainfallMm === depth} onClick={() => setRainfallMm(depth)} className={`min-h-9 flex-1 border px-2 font-mono text-xs transition-colors ${rainfallMm === depth ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>{depth} mm</button>)}
        </div>
      </div>

      {result.landAreaM2 <= 0 ? <p className="border border-dashed border-border p-3 text-xs text-muted-foreground">A known footprint with land is needed to size this rainfall budget. Open water contributes no land area.</p> : <>
        <div className="border-y border-border/70 py-3" aria-live="polite" aria-atomic="true">
          <p className="text-xs text-muted-foreground">Avoided runoff in this storm</p>
          <p className="mt-1 font-mono text-2xl text-primary">{formatVolumeM3(result.avoidedRunoffM3)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{result.runoffReductionPercent.toFixed(1)}% less runoff · {formatVolumeM3(result.rainfallVolumeM3)} rain on land</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {([['NOW', result.now], ['POSSIBLE', result.possible]] as const).map(([label, budget]) => <div key={label} className="min-w-0">
            <p className={`font-mono text-[10px] tracking-widest ${label === 'POSSIBLE' ? 'text-primary' : 'text-muted-foreground'}`}>{label}</p>
            <div className="my-2 flex h-1.5 bg-muted" aria-hidden="true"><div className="bg-primary" style={{ width: `${budget.retentionFraction * 100}%` }} /></div>
            <dl className="space-y-1 text-xs"><div><dt className="text-muted-foreground">Retained / delayed</dt><dd className="font-mono">{formatVolumeM3(budget.retainedM3)}</dd></div><div><dt className="text-muted-foreground">Runoff</dt><dd className="font-mono">{formatVolumeM3(budget.runoffM3)}</dd></div></dl>
          </div>)}
        </div>
        <figure>
          <figcaption className="text-xs font-medium">Runoff across storm depths</figcaption>
          <svg viewBox="0 0 380 176" role="img" aria-labelledby={`${id}-chart-title ${id}-chart-desc`} className="mt-2 w-full overflow-visible font-mono text-[10px]">
            <title id={`${id}-chart-title`}>Runoff volume in cubic metres versus rainfall depth in millimetres</title>
            <desc id={`${id}-chart-desc`}>Dashed line: NOW. Solid green line: POSSIBLE. Exact values are available in the data table below. Fixed coefficients make both responses linear.</desc>
            {[0, 0.5, 1].map((fraction) => <g key={fraction}><line x1="48" x2="348" y1={y(maxRunoff * fraction)} y2={y(maxRunoff * fraction)} stroke="currentColor" opacity="0.12" /><text x="42" y={y(maxRunoff * fraction) + 3} textAnchor="end" fill="currentColor">{new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(maxRunoff * fraction)}</text></g>)}
            <text x="48" y="14" fill="currentColor">m³ runoff</text>
            <polyline points={points('now')} fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" opacity="0.65" />
            <polyline points={points('possible')} fill="none" stroke="hsl(var(--primary))" strokeWidth="2.5" />
            <line x1={x(rainfallMm)} x2={x(rainfallMm)} y1="28" y2="140" stroke="hsl(var(--primary))" strokeDasharray="2 3" opacity="0.45" />
            {[0, 50, 100, 150, 200].map((depth) => <text key={depth} x={x(depth)} y="158" textAnchor="middle" fill="currentColor">{depth}</text>)}
            <text x="348" y="174" textAnchor="end" fill="currentColor">mm rainfall</text>
          </svg>
          <div className="flex gap-4 text-[10px] font-mono"><span>┄ NOW</span><span className="text-primary">━ POSSIBLE</span></div>
        </figure>
        <details className="text-xs"><summary className="cursor-pointer py-1 text-muted-foreground">View storm comparison data</summary><div className="overflow-x-auto"><table className="mt-2 w-full text-right font-mono text-[10px]"><caption className="sr-only">Rainfall and runoff sensitivity in cubic metres</caption><thead><tr><th scope="col" className="py-2 text-left">Rain mm</th><th scope="col">NOW m³</th><th scope="col">POSSIBLE m³</th><th scope="col">Avoided m³</th></tr></thead><tbody>{sweep.map((point) => <tr key={point.rainfallMm} className="border-t border-border"><th scope="row" className="py-2 text-left">{point.rainfallMm}</th><td>{point.now.runoffM3.toFixed(1)}</td><td>{point.possible.runoffM3.toFixed(1)}</td><td>{point.avoidedRunoffM3.toFixed(1)}</td></tr>)}</tbody></table></div></details>
      </>}
      <p className="text-[11px] leading-relaxed text-muted-foreground">{STORM_PROVENANCE.limitations} Fixed coefficients produce linear responses, including at 200 mm; saturation is not modeled.</p>
      <details className="text-[11px] text-muted-foreground"><summary className="cursor-pointer">Method / {STORM_PROVENANCE.model}</summary><p className="mt-2 leading-relaxed">{STORM_PROVENANCE.method}. {STORM_PROVENANCE.coefficients}. Both futures receive identical rainfall over the same land area. Retained + runoff = rainfall; competing interventions share their source surface.</p></details>
    </section>
  );
}
