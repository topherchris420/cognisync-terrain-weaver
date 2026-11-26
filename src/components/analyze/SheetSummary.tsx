import { percentChange } from "@/lib/percent-change";
import { DIFFERENCE_LESS, DIFFERENCE_MORE } from "@/lib/water-palette";

interface Props {
  /** Routed runoff of the paired runs, when a controlled comparison exists. */
  pair: { nowM3?: number; possibleM3?: number } | null;
  /** The where-the-water-moved layer is on the map. */
  showDifference: boolean;
  /** The routed flow paths are on the map. */
  showFlow: boolean;
}

const finite = (value: number | undefined): value is number => typeof value === "number" && Number.isFinite(value);

function volume(value: number): string {
  return value < 10 ? value.toFixed(1) : Math.round(value).toLocaleString("en-US");
}

/**
 * The one line a lowered phone sheet keeps beside the next step: what the map
 * above it shows. A paired result leads with the change under the same storm;
 * otherwise the flow paths' key, with the boundary that they are not depth.
 * Hidden by the stylesheet everywhere except a lowered sheet.
 */
export function SheetSummary({ pair, showDifference, showFlow }: Props) {
  if (pair && finite(pair.nowM3) && finite(pair.possibleM3) && pair.nowM3 > 0) {
    const delta = pair.nowM3 - pair.possibleM3;
    const less = delta >= 0;
    const percent = (delta / pair.nowM3) * 100;
    return (
      <p className="atlas-sheet-legend" data-kind="result">
        <span aria-hidden="true" style={{ background: less ? DIFFERENCE_LESS : DIFFERENCE_MORE, boxShadow: "none" }} />
        <span className="atlas-sheet-legend-text">
          Same storm: <strong>{volume(Math.abs(delta))} m³ {less ? "less" : "more"} runoff</strong> in this model
          {delta !== 0 && ` (${percentChange(percent)}%)`}.
          {showDifference && ` ${less ? "Green" : "Amber"} cells on the map carry ${less ? "less" : "more"} water.`}
        </span>
      </p>
    );
  }
  if (!showFlow) return null;
  return (
    <p className="atlas-sheet-legend">
      <span aria-hidden="true" />
      Flow paths are brightest where modeled water gathers. Not flood depth.
    </p>
  );
}
