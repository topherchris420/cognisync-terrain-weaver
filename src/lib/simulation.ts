import type { LandCoverKey } from "@/lib/types";

/**
 * Flow direction weights based on land cover type.
 * Higher values indicate more runoff (less infiltration).
 */
export const FLOW_DIRECTION: Record<LandCoverKey, number> = {
  vegetation: 0.1, // high infiltration
  soil: 0.15,
  water: 0.5,
  buildings: 0.95, // water flows off
  pavement: 0.9,
};

export interface FlowDirection {
  direction: string;
  points: [number, number][];
  intensity: number;
}

/**
 * Calculate basic flow directions from land-cover data.
 * Returns direction vectors for rendering quick-feedback arrows.
 * @param landCover - Record of land-cover percentages
 * @param gridResolution - Grid cell size in degrees
 * @returns Array of flow direction objects
 */
export function calculateFlowDirections(
  landCover: Record<LandCoverKey, number>,
  gridResolution: number
): FlowDirection[] {
  const directions: FlowDirection[] = [];

  // Calculate overall flow intensity based on land cover percentages
  let totalIntensity = 0;

  for (const [coverType, percentage] of Object.entries(landCover)) {
    const weight = FLOW_DIRECTION[coverType as LandCoverKey];
    totalIntensity += weight * (percentage / 100);
  }

  // Normalize intensity to 0-1 range
  const normalizedIntensity = Math.min(1, Math.max(0, totalIntensity));

  // Generate flow directions based on dominant land cover
  // Higher intensity means more water flows to lower elevations
  if (normalizedIntensity > 0) {
    // Determine primary flow direction (simplified: assume flow to lower elevation)
    // In a real implementation, this would use DEM data
    const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

    for (let i = 0; i < directions.length; i++) {
      const dir = directions[i];
      const angle = (i * 45 * Math.PI) / 180;

      // Generate points along the flow direction
      const points: [number, number][] = [
        [0, 0],
        [
          Math.cos(angle) * gridResolution * 2,
          Math.sin(angle) * gridResolution * 2,
        ],
      ];

      directions.push({
        direction: dir,
        points,
        intensity: normalizedIntensity * (1 - i * 0.1),
      });
    }
  }

  // Add primary flow direction
  const primaryDirection: FlowDirection = {
    direction: "SE", // Default flow direction (toward lower elevation)
    points: [
      [0, 0],
      [gridResolution, gridResolution],
    ],
    intensity: normalizedIntensity,
  };

  return [primaryDirection, ...directions];
}

/**
 * Returns blue color with opacity based on flow intensity
 * @param intensity - 0 to 1 flow intensity
 * @returns CSS color string
 */
export function getFlowColor(intensity: number): string {
  const clampedIntensity = Math.min(1, Math.max(0, intensity));
  const opacity = clampedIntensity * 0.8 + 0.2; // Min opacity 0.2, max 1.0
  return `rgba(59, 130, 246, ${opacity})`; // Blue-500
}