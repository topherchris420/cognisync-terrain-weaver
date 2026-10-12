import { useId } from "react";
import { Switch } from "@/components/ui/switch";
import { describeSpatialDifference, type SpatialDifference } from "@/lib/counterfactual/difference";

interface Props {
  difference: SpatialDifference | null;
  shown: boolean;
  onShow: (shown: boolean) => void;
}

const metres = (value: number) => `${Math.round(value).toLocaleString("en-US")}`;
const cubic = (value: number) => (value < 10 ? value.toFixed(1) : Math.round(value).toLocaleString("en-US"));

/**
 * The spatial reading of a controlled pair: which cells carry less water on
 * the redesigned surface, how far downstream the change travels, and how
 * large the largest change is. A difference in forcing is refused, not drawn.
 */
export function WhereTheWaterMoved({ difference, shown, onShow }: Props) {
  const id = useId();
  if (!difference) return null;
  return (
    <section className="atlas-section" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`} className="atlas-section-title">Where the water moved</h3>
      {difference.status === "not-controlled" && (
        <>
          <p className="atlas-section-note">Not drawn: the two runs differ in more than the drawn surface, so their difference would be a difference in forcing, not an effect.</p>
          <ul className="mt-2 space-y-1 text-xs text-destructive">
            {difference.violations.map((violation) => <li key={violation}>{violation}</li>)}
          </ul>
        </>
      )}
      {difference.status === "unavailable" && <p className="atlas-section-note">{difference.reason}</p>}
      {difference.status === "controlled" && (
        <>
          <p className="atlas-section-note" data-testid="difference-summary">{describeSpatialDifference(difference.summary)}</p>
          <div className="atlas-toggles mt-3">
            <label className="atlas-toggle">
              <span className="atlas-toggle-swatch atlas-toggle-swatch--difference" aria-hidden="true" />
              <span className="flex-1">
                Show on the map
                <small>Green where less water passes than NOW, amber where more; the drawing's own cells outlined</small>
              </span>
              <Switch checked={shown} onCheckedChange={onShow} aria-label="Show where the water moved on the map" />
            </label>
          </div>
          <dl className="atlas-stats mt-4">
            <div>
              <dt>Cells carrying less water</dt>
              <dd>{difference.summary.less.toLocaleString("en-US")}<small>of {difference.summary.cells.toLocaleString("en-US")}</small></dd>
            </div>
            <div>
              <dt>Downstream reach</dt>
              <dd>{metres(difference.summary.farthestReachM)}<small>m</small></dd>
            </div>
            <div>
              <dt>Under the drawing</dt>
              <dd>{difference.summary.sourceCells.toLocaleString("en-US")}<small>cells · {Math.round(difference.summary.sourceCells * difference.cellAreaM2).toLocaleString("en-US")} m²</small></dd>
            </div>
            <div>
              <dt>Largest change in one cell</dt>
              <dd>−{cubic(difference.summary.largestDecreaseM3)}<small>m³</small></dd>
            </div>
          </dl>
          {difference.summary.more > 0 && (
            <p className="mt-3 text-xs text-destructive">
              {difference.summary.more.toLocaleString("en-US")} cell{difference.summary.more === 1 ? "" : "s"} carry more water on the redesigned surface (largest +{cubic(difference.summary.largestIncreaseM3)} m³). A retention-only redesign should not do this; inspect those cells on the map.
            </p>
          )}
          <p className="atlas-section-note mt-4" role="note">
            {difference.caveat} Water is counted at every cell it passes, so cells are not volumes; the avoided runoff is the figure in the ledger above.
          </p>
        </>
      )}
    </section>
  );
}
