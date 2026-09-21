import { computeAbsorptionScore } from "./absorption";
import type { LandCover } from "./types";

/**
 * The Mannahatta 1609 baseline
 *
 * This product is named after the Wildlife Conservation Society's Mannahatta
 * Project — Eric W. Sanderson's ten-year (1999–2009) reconstruction of
 * Manhattan as it stood in 1609, the year Henry Hudson's Halve Maen reached
 * the island. By georeferencing the 1782 British Headquarters Map onto the
 * modern street grid and cross-checking it against archaeological, botanical,
 * and colonial records, the project could answer a question nobody could
 * answer before: *what was on this block, before the block?*
 *
 * That is the idea this module borrows. An Urban Absorption Score of 31 means
 * nothing to someone who is not a drainage engineer. "A third of what a
 * pre-city landscape took" means something to everybody. The baseline turns an
 * abstract index into a distance.
 *
 * It is a *benchmark*, not a site history: every scan is measured against this
 * one fixed landscape, wherever the scan is. See `baselineSentence` for why the
 * copy never claims to know what stood on the scanned block.
 *
 * ## Where the numbers come from — and where they don't
 *
 * The species and stream counts in `MANNAHATTA_1609` are the project's own
 * published findings. The land-cover split is NOT: WCS never published a
 * five-class raster in this schema, and inventing one and attributing it to
 * them would be dishonest. What follows is our estimate, derived from the
 * project's description of the island's ecology, and it is stated as an
 * estimate everywhere it is shown to a user.
 *
 * Manhattan in 1609 was overwhelmingly forested — Sanderson describes an
 * island of oak-hickory and chestnut forest, threaded with freshwater
 * wetlands, salt marsh at the margins, and grassland openings maintained by
 * Lenape burning. Against this app's five classes:
 *
 * | Class      | %  | Reasoning                                              |
 * |------------|----|--------------------------------------------------------|
 * | vegetation | 89 | Forest, marsh and meadow — the island's dominant cover  |
 * | soil       |  9 | Beaches, sand flats, exposed schist outcrop, trails     |
 * | water      |  2 | Interior streams and ponds (Collect Pond, Saw Kill…)    |
 * | buildings  |  0 | Lenape settlement was bark longhouse on soil, not roof  |
 * | pavement   |  0 | There was none                                          |
 *
 * Two deliberate choices worth stating plainly:
 *
 * - **Longhouses are not roofs.** The Rational Method coefficient for "roofs"
 *   (C ≈ 0.90) describes sealed, drained, engineered surfaces. Elm-bark over
 *   a dirt floor sheds water into the ground beside it. Counting Lenape
 *   settlement as `buildings` would import a coefficient that does not
 *   describe the thing.
 * - **The baseline is not 100, and that is the point.** It scores ~79 because
 *   this model holds that no surface absorbs all of its rain — even mature
 *   woodland on good soil sheds 5–25%. A baseline of 100 would be a slogan.
 *   79 is what the model actually says when you feed it a forest.
 *
 * The comparison is only meaningful because the baseline goes through
 * `computeAbsorptionScore` — the exact function that scores a live scan. It is
 * the same ruler, held against a different century.
 *
 * Sources: Sanderson, *Mannahatta: A Natural History of New York City*
 * (Abrams, 2009); the Mannahatta Project and its successor, the Welikia
 * Project, Wildlife Conservation Society.
 */
export const BASELINE_COVER: LandCover = {
  vegetation: 89,
  soil: 9,
  water: 2,
  buildings: 0,
  pavement: 0,
};

/**
 * The 1609 score, computed rather than asserted.
 *
 * Derived at module load from `BASELINE_COVER` through the same scorer used on
 * every live scan, so it can never drift from the model. If the weights are
 * recalibrated for another climate zone, this moves with them — which is the
 * correct behaviour, because the baseline is a claim about *this* model.
 */
export const BASELINE_SCORE = computeAbsorptionScore(BASELINE_COVER);

/** Headline findings of the Mannahatta Project, used in the origin section. */
export const MANNAHATTA_1609 = {
  streamMiles: 66,
  plantSpecies: 627,
  birdSpecies: 233,
  fishSpecies: 85,
  mammalSpecies: 24,
  treeSpecies: 70,
  herptileSpecies: 32,
} as const;

/** Where the above came from, linked wherever the numbers are shown. */
export const BASELINE_SOURCE = {
  label: "The Welikia Project, Wildlife Conservation Society",
  href: "https://welikia.org/",
} as const;

export interface BaselineComparison {
  /** The site's score today, clamped to 0–100. */
  score: number;
  /** The 1609 reference score under the same model. */
  baseline: number;
  /** Points below the benchmark. Zero if the site meets or beats it. */
  shortfall: number;
  /**
   * The site's score as a share of the benchmark, 0–100. This is the number
   * the UI leads with: "38% of what Mannahatta's landscape absorbed."
   */
  benchmarkPct: number;
  /** True when the site scores at or above the benchmark. */
  meetsBaseline: boolean;
}

/**
 * Position a scanned site against the 1609 benchmark.
 *
 * `benchmarkPct` is capped at 100 so a genuinely exceptional site — restored
 * wetland, mature park — reads as "at the benchmark" rather than claiming to
 * be more absorbent than a forest, which the weights cannot support.
 */
export function compareToBaseline(score: number): BaselineComparison {
  const clamped = Math.max(0, Math.min(100, Number(score) || 0));
  const shortfall = Math.max(0, BASELINE_SCORE - clamped);
  const benchmarkPct = Math.min(
    100,
    Math.round((clamped / BASELINE_SCORE) * 100)
  );

  return {
    score: clamped,
    baseline: BASELINE_SCORE,
    shortfall: Math.round(shortfall * 10) / 10,
    benchmarkPct,
    meetsBaseline: clamped >= BASELINE_SCORE,
  };
}

/**
 * A short, plain-language reading of the comparison.
 *
 * ## Why this never says "the absorption *this ground* used to have"
 *
 * It is tempting, and it was the first draft, but it is a false claim twice
 * over. Sites outside Manhattan are a supported flow: a scan of Jakarta or
 * Copenhagen has no relationship to Mannahatta's ecology, and telling a user
 * their block "kept 18% of the absorption it had in 1609" invents a history
 * for ground the project never surveyed.
 *
 * It over-claims *inside* Manhattan too. `BASELINE_SCORE` is one island-wide
 * figure, while the Mannahatta Project's central finding is that the island
 * was not uniform — Times Square was wetland, Harlem was meadow, the ridges
 * were forest. A single number cannot speak for a specific block's past.
 *
 * So the comparison is framed as what it actually is: a fixed, named
 * reference landscape that every site is measured against, the same way a
 * score is measured against 100. That is true everywhere, which is why this
 * needs no location gating and no arbitrary Manhattan boundary.
 *
 * It also avoids blame. A site scoring 14 is not a moral failure; it is
 * Midtown, and Midtown is why the score exists. State the distance and stop.
 */
export function baselineSentence(cmp: BaselineComparison): string {
  if (cmp.meetsBaseline) {
    return "This ground absorbs about as much rain as Mannahatta's pre-city landscape did — it is at the benchmark.";
  }
  if (cmp.benchmarkPct >= 60) {
    return `This ground absorbs roughly ${cmp.benchmarkPct}% of what Mannahatta's pre-city landscape did — much of that capacity is matched here.`;
  }
  if (cmp.benchmarkPct >= 30) {
    return `This ground absorbs roughly ${cmp.benchmarkPct}% of what Mannahatta's pre-city landscape did. The rest of the rain runs to a drain.`;
  }
  return `This ground absorbs roughly ${cmp.benchmarkPct}% of what Mannahatta's pre-city landscape did. Almost all of the rain that falls here has to be carried away.`;
}
