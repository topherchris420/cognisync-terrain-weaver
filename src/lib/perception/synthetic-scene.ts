import type { LandCover } from "@/lib/types";

/**
 * SYNTHETIC DIAGNOSTIC BENCHMARK — scene contract.
 *
 * A rendered scene with known semantic composition, from BoundlessNYC or any
 * other simulator. The benchmark sends ONLY `rgb` to the classifier and
 * compares its answer with `groundTruth`. Agreement here is agreement on
 * rendered imagery: it is never real-world classifier accuracy, never
 * observational evidence, and never a reason to change a real-world claim.
 */
export const SYNTHETIC_LABEL = "synthetic diagnostic benchmark" as const;
export const NOT_REAL_WORLD = "Synthetic agreement does not establish classifier accuracy on real imagery (synthetic-to-real domain shift)." as const;

export const COMPOSITION_KEYS = ["vegetation", "pavement", "buildings", "bareSoil", "water"] as const;
export type CompositionKey = (typeof COMPOSITION_KEYS)[number];

/** Percent of the scene's mapped pixels in each Mannahatta class; sums to 100. */
export type SemanticComposition = Record<CompositionKey, number>;

export interface ImageSource {
  /** Where the RGB image is: a data URL, or a path relative to the scene set. */
  kind: "data-url" | "path";
  value: string;
  /** SHA-256 of the image bytes, so a prediction can be tied to exactly one image. */
  sha256: string | null;
  width?: number;
  height?: number;
}

export interface SceneCamera {
  /** The classifier is built for overhead imagery; only nadir scenes enter the primary metrics. */
  view: "nadir" | "oblique";
  pitchDeg?: number;
  altitudeM?: number;
  fovDeg?: number;
}

export interface SyntheticScene {
  id: string;
  rgb: ImageSource;
  groundTruth: SemanticComposition;
  metadata: {
    source: string;
    camera?: SceneCamera;
    lighting?: string;
    weather?: string;
    sceneClass?: string;
    /** Share of pixels excluded from ground truth (sky, vehicles, people, signage), 0–1. */
    unmappedShare?: number;
    /** Share of mapped pixels whose class mapping is a documented judgement, 0–1. */
    ambiguousShare?: number;
    /** Attribution the scene's licence requires. */
    attribution?: string[];
  };
}

/** A simulator-specific record turned into a SyntheticScene. Adapters must refuse what they cannot vouch for. */
export interface SyntheticSceneAdapter<Raw> {
  id: string;
  describe: string;
  toScene(raw: Raw): SyntheticScene;
}

/** Rejects incomplete, negative, non-finite or unbalanced compositions. */
export function validateComposition(composition: SemanticComposition, tolerance = 0.5): SemanticComposition {
  for (const key of COMPOSITION_KEYS) {
    const value = composition[key];
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new Error(`Composition ${key} must be a finite, non-negative number.`);
  }
  const total = COMPOSITION_KEYS.reduce((sum, key) => sum + composition[key], 0);
  if (Math.abs(total - 100) > tolerance) throw new Error(`Composition must sum to 100 (got ${total}).`);
  return composition;
}

/** The app's land-cover classes, from a composition (bareSoil ↔ soil). */
export function compositionToLandCover(c: SemanticComposition): LandCover {
  return { vegetation: c.vegetation, pavement: c.pavement, buildings: c.buildings, soil: c.bareSoil, water: c.water };
}

export function landCoverToComposition(cover: LandCover): SemanticComposition {
  const total = cover.vegetation + cover.pavement + cover.buildings + cover.soil + cover.water || 1;
  const scale = 100 / total;
  return {
    vegetation: cover.vegetation * scale,
    pavement: cover.pavement * scale,
    buildings: cover.buildings * scale,
    bareSoil: cover.soil * scale,
    water: cover.water * scale,
  };
}
