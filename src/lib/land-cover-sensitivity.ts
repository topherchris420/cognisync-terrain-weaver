import { computeAbsorptionScore } from "./absorption";
import { compareStorm } from "./paired-storm";
import { EMPTY_SCENARIO, siteCoverShares } from "./scenario";
import type { LandCover } from "./types";

/** Deliberately one assumption at a time; no probabilistic confidence claim. */
export function landCoverSensitivity(
  cover: LandCover,
  areaM2: number,
  rainfallMm: number,
  shiftPP = 5,
) {
  if (
    Object.values(cover).some((v) => !Number.isFinite(v) || v < 0) ||
    Object.values(cover).reduce((a, b) => a + b, 0) <= 0
  )
    throw new Error("Invalid land-cover composition.");
  if (
    ![areaM2, rainfallMm, shiftPP].every((v) => Number.isFinite(v) && v >= 0) ||
    shiftPP > 100
  )
    throw new Error("Invalid sensitivity inputs.");
  const normalized = Object.fromEntries(
    Object.entries(siteCoverShares(cover)).map(([k, v]) => [k, v * 100]),
  ) as LandCover;
  return [-shiftPP, 0, shiftPP].map((requested) => {
    const shift = Math.max(
      -normalized.vegetation,
      Math.min(normalized.pavement, requested),
    );
    const perturbed = {
      ...normalized,
      vegetation: normalized.vegetation + shift,
      pavement: normalized.pavement - shift,
    };
    return {
      shiftPP: shift,
      cover: perturbed,
      score: computeAbsorptionScore(perturbed),
      runoffM3: compareStorm(perturbed, EMPTY_SCENARIO, areaM2, rainfallMm).now
        .runoffM3,
    };
  });
}
