/**
 * The water palette shared by the map layers and their legend, so the key
 * always describes exactly what is drawn.
 */

/** Ponding depth in meters → fill color. Shallow reads pale; deep saturates. */
export const DEPTH_RAMP: ReadonlyArray<readonly [number, string]> = [
  [0, "#9be3f0"],
  [0.1, "#56c3df"],
  [0.35, "#2396c6"],
  [1, "#1766aa"],
  [2.5, "#0e3d85"],
];

export function depthColor(depthM: number): string {
  let color = DEPTH_RAMP[0][1];
  for (const [stop, value] of DEPTH_RAMP) if (depthM >= stop) color = value;
  return color;
}

export const FLOW_HEAD = "rgba(118, 205, 228, 0.28)";
export const FLOW_MOUTH = "rgba(196, 244, 255, 1)";

/** Search radius for a click on ponded water, in CSS pixels. */
export const POND_HIT_PX = 10;
