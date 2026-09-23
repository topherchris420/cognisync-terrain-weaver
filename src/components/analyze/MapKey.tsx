import { DEPTH_RAMP, FLOW_HEAD, FLOW_MOUTH } from "@/lib/water-palette";

interface MapKeyProps {
  place: string;
  showFlow: boolean;
  showPonding: boolean;
  rainfallMm?: number;
}


/**
 * The map's title block: where you are, and, once a storm has been routed,
 * what the water on the map means.
 */
export function MapKey({ place, showFlow, showPonding, rainfallMm }: MapKeyProps) {
  const ramp = `linear-gradient(90deg, rgba(155, 227, 240, 0.5), ${DEPTH_RAMP.slice(1).map(([, c]) => c).join(", ")})`;
  const hasWater = showFlow || showPonding;

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
              <span>Where water ponds</span>
              <span className="atlas-key-ramp" style={{ backgroundImage: ramp }} aria-hidden="true" />
              <span className="atlas-key-ticks" aria-hidden="true">
                <span>shallow</span>
                <span>deep · tap a pool for depth</span>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
