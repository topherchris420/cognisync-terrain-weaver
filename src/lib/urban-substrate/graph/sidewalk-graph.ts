import { pedestrianExclusionReason } from "../layers/streets";
import type { StreetGraphEdge, StreetSegmentFeature } from "../types";

/**
 * Pedestrian access graph at centreline level: the street-graph edges a
 * pedestrian may use, and why the others are excluded.
 *
 * This is NOT a sidewalk geometry graph. BoundlessNYC derives walkable
 * sidewalk bands from kerb offsets; the substrate does not, because the
 * planimetric sidewalk polygons are not compiled yet and offsets without them
 * would be invented geometry. Both sides of a street are one edge here.
 */
export function pedestrianAccess(
  edges: StreetGraphEdge[],
  segments: Map<string, Pick<StreetSegmentFeature, "physical" | "roadClass" | "pedestrianExcluded">>,
): Map<string, string | null> {
  const access = new Map<string, string | null>();
  for (const edge of edges) {
    const segment = segments.get(edge.segmentId);
    access.set(edge.id, segment ? pedestrianExclusionReason(segment) : "missing-segment");
  }
  return access;
}
