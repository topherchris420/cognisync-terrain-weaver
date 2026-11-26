import type { AnalysisRecord } from "@/lib/types";
import type { SimulationResponse } from "@/lib/simulation-types";
import { controlledComparison } from "@/lib/counterfactual/controlled";

const volume = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 1 });

export function GroundReading({ analysis }: { analysis: AnalysisRecord }) {
  const hard = analysis.land_cover.buildings + analysis.land_cover.pavement;
  const soft = analysis.land_cover.vegetation + analysis.land_cover.soil;
  return (
    <section className="atlas-study-reading" aria-labelledby="ground-reading-title">
      <p className="atlas-eyebrow">What this place tells us</p>
      <h3 id="ground-reading-title">{hard > 50 ? "Rain meets mostly roofs and pavement." : soft > 50 ? "Vegetation and soil cover most of this place." : "This place has a mix of surfaces."}</h3>
      <dl className="atlas-study-reading-metrics">
        <div><dt>Roofs & pavement</dt><dd>{hard.toFixed(0)}<small>%</small></dd></div>
        <div><dt>Vegetation & soil</dt><dd>{soft.toFixed(0)}<small>%</small></dd></div>
      </dl>
      <p>These are shares of the whole study area. Water accounts for {analysis.land_cover.water.toFixed(0)}%. Run a storm to estimate runoff, then test what changing the ground could do.</p>
      <p className="atlas-study-reading-basis"><strong>{analysis.status === "example" ? "Illustrative example inputs." : "AI-estimated surface cover."}</strong> This is a screening study. Site flood risk has not been established.</p>
    </section>
  );
}

interface ComparisonProps {
  now: SimulationResponse;
  possible: SimulationResponse;
  illustrativeCover: boolean;
  costUSD: number;
}

export function StormReading({ result, illustrativeCover }: { result: SimulationResponse; illustrativeCover: boolean }) {
  const rain = result.metadata.rainfall_volume_m3;
  const runoff = result.metadata.runoff_volume_m3;
  const valid = rain != null && runoff != null && Number.isFinite(rain) && Number.isFinite(runoff) && rain > 0 && runoff >= 0;
  return (
    <section className="atlas-study-reading" aria-labelledby="storm-reading-title">
      <p className="atlas-eyebrow">Your baseline result</p>
      <h3 id="storm-reading-title" tabIndex={-1} data-study-result>What the storm did</h3>
      {valid ? <div className="atlas-headline"><span className="atlas-headline-figure">{Math.round(runoff / rain * 100)}<small>%</small></span><p>of modeled rainfall became surface runoff. That is <strong>{volume(runoff)} m³</strong> generated across this study area.</p></div> : <p>A rainfall or runoff total is missing. Inspect the detailed results before drawing a conclusion.</p>}
      <p className="atlas-study-reading-basis"><strong>{illustrativeCover ? "Illustrative land cover. " : "AI-estimated land cover. "}{result.metadata.elevation_status === "observed" ? "Elevation from terrain tiles. " : "Illustrative terrain. "}</strong>The model routes water across these surfaces. Its accumulation zones have not demonstrated predictive flood skill; use this study to explore changes, rather than assess site safety.</p>
    </section>
  );
}

/** Only an identity-checked pair can support an intervention-effect headline. */
export function ComparisonReading({ now, possible, illustrativeCover, costUSD }: ComparisonProps) {
  const control = controlledComparison(now, possible);
  const before = now.metadata.runoff_volume_m3;
  const after = possible.metadata.runoff_volume_m3;
  const hasVolumes = before != null && after != null && Number.isFinite(before) && Number.isFinite(after) && before >= 0 && after >= 0;
  if (!control.valid || !hasVolumes) {
    return <section className="atlas-study-reading" aria-label="Comparison result"><h3>Check the comparison before drawing a conclusion.</h3><p>{!control.valid ? "The runs have different or missing inputs. An intervention effect cannot be isolated. Review the conditions below." : "A runoff volume is missing or invalid. Rerun the comparison to get a complete result."}</p></section>;
  }
  const avoided = before - after;
  const percent = before > 0 ? Math.abs(avoided) / before * 100 : null;
  const percentText = percent == null ? null : percent > 0 && percent < 0.1 ? "<0.1" : percent.toFixed(1);
  const illustrativeTerrain = now.metadata.elevation_status !== "observed" || possible.metadata.elevation_status !== "observed";
  return (
    <section className="atlas-study-reading" aria-labelledby="comparison-reading-title">
      <p className="atlas-eyebrow">What changed under the same storm</p>
      <h3 id="comparison-reading-title" tabIndex={-1} data-study-result>{avoided > 0 ? "Less runoff in this model." : avoided < 0 ? "More runoff in this model." : "No modeled runoff reduction."}</h3>
      <div className="atlas-study-reading-change"><strong>{volume(Math.abs(avoided))}<small>m³ {avoided < 0 ? "more" : "less"}</small></strong>{percentText != null && <span>{percentText}% {avoided < 0 ? "increase" : "reduction"}</span>}</div>
      <dl className="atlas-study-reading-ledger">
        <div><dt>Current ground</dt><dd>{volume(before)} m³ runoff</dd></div>
        <div><dt>Your redesign</dt><dd>{volume(after)} m³ runoff</dd></div>
        <div><dt>Installation estimate</dt><dd>{costUSD.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })}</dd></div>
      </dl>
      <p className="atlas-study-reading-basis"><strong>{illustrativeCover ? "Illustrative land cover. " : "AI-estimated land cover. "}{illustrativeTerrain ? "Illustrative terrain. " : "Elevation from terrain tiles. "}</strong>Same storm, extent and model; the drawn surface changed. Modeled runoff differences do not establish real-world flood protection. Costs exclude maintenance and permitting.</p>
    </section>
  );
}
