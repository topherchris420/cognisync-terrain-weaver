import { Waypoints } from "lucide-react";
import { FLOW_SKETCH_CAVEAT } from "@/lib/counterfactual/flow-sketch";

interface Props {
  onSketch: () => void;
  disabled?: boolean;
}

/**
 * The quick way past an empty map: a few bioswale strips along the modeled
 * flow paths, placed as ordinary drawings. Offered only before anything has
 * been drawn, and always with the boundary of what the placement means.
 */
export function FlowSketchOffer({ onSketch, disabled }: Props) {
  return (
    <section className="atlas-sketch" aria-labelledby="flow-sketch-title">
      <h4 id="flow-sketch-title">Not sure where to start?</h4>
      <p>
        Place a few bioswale strips along the upper reaches of the modeled flow paths. They are ordinary drawings:
        edit, delete or add to them, then rerun the same storm.
      </p>
      <button type="button" onClick={onSketch} disabled={disabled}>
        <Waypoints size={15} aria-hidden="true" />
        Sketch along the flow paths
      </button>
      <p className="atlas-sketch-caveat">{FLOW_SKETCH_CAVEAT}</p>
    </section>
  );
}
