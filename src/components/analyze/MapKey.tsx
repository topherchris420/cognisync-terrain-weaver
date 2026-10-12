import { DEPTH_RAMP, DIFFERENCE_LESS, DIFFERENCE_MORE, FLOW_HEAD, FLOW_MOUTH } from "@/lib/water-palette";

interface MapKeyProps {
  place: string;
  showFlow: boolean;
  showPonding: boolean;
  /** The NOW − POSSIBLE difference of a controlled pair is on the map. */
  showDifference?: boolean;
  rainfallMm?: number;
}


/**
 * The map's title block: where you are, and, once a storm has been routed,
 * what the water on the map means.
 */
export function MapKey({ place, showFlow, showPonding, showDifference = false, rainfallMm }: MapKeyProps) {
  const ramp = `linear-gradient(90deg, rgba(155, 227, 240, 0.5), ${DEPTH_RAMP.slice(1).map(([, c]) => c).join(", ")})`;
  const hasWater = showFlow || showPonding || showDifference;

  return (
    <div className="atlas-map-heading" data-legend={hasWater || undefined}>
      <p className="atlas-map-place">{place}</p>

      {hasWater && (
        <div className="atlas-key" aria-label="Map key">
          {rainfallMm != null && (
            <p className="atlas-key-storm">{rainfallMm} mm in 60 minutes, routed downhill</p>
          )}
          {showFlow && (
            <div className="atlas-key-row">
              <span
                className="atlas-key-flow"
                style={{ backgroundImage: `linear-gradient(90deg, ${FLOW_HEAD}, ${FLOW_MOUTH})` }}
                aria-hidden="true"
              />
              <span>Flow path, brightest where water gathers</span>
            </div>
          )}
          {showPonding && (
            <div className="atlas-key-depth">
              <span>Relative routing accumulation</span>
              <span className="atlas-key-ramp" style={{ backgroundImage: ramp }} aria-hidden="true" />
              <span className="atlas-key-ticks" aria-hidden="true">
                <span>low</span>
                <span>high accumulation · not flood depth</span>
              </span>
            </div>
          )}
          {showDifference && (
            <div className="atlas-key-depth">
              <span>Where the water moved, redesign vs now</span>
              <span className="atlas-key-diff" aria-hidden="true">
                <span><i className="atlas-key-swatch" style={{ background: DIFFERENCE_LESS }} /> less water</span>
                <span><i className="atlas-key-swatch" style={{ background: DIFFERENCE_MORE }} /> more water</span>
                <span><i className="atlas-key-swatch atlas-key-swatch--source" /> drawn</span>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
