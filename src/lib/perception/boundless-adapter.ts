import { COMPOSITION_KEYS, type CompositionKey, type SceneCamera, type SemanticComposition, type SyntheticScene, type SyntheticSceneAdapter } from "./synthetic-scene";

/**
 * Adapter for scenes rendered by BoundlessNYC (https://github.com/mkturkcan/boundless-nyc).
 *
 * BoundlessNYC's semantic camera labels pixels with a Cityscapes-compatible
 * class table (boundlessjs/src/perception/segRender.js, CLASS_ROWS). The
 * names and palette below restate that table so masks can be read without
 * BoundlessNYC installed; nothing else of BoundlessNYC is used here.
 *
 * Licensing guard. BoundlessNYC's photoreal pedestrians include Epic Games
 * MetaHuman components whose licence forbids using them to train or TEST AI
 * models. This benchmark tests a classifier, so the adapter refuses any scene
 * not rendered with `--pedestrians procedural` (or with no pedestrians).
 * Rendered imagery is a Produced Work of the ODbL-licensed compiled city and
 * must carry "© OpenStreetMap contributors"; vehicles add the CARLA credit.
 */
export const BOUNDLESS_CLASSES: Array<{ id: number; name: string; rgb: [number, number, number] }> = [
  [0, "unlabeled", 0, 0, 0],
  [1, "sky", 70, 130, 180],
  [2, "building", 70, 70, 70],
  [3, "road", 128, 64, 128],
  [4, "sidewalk", 244, 35, 232],
  [5, "curb", 170, 0, 180],
  [6, "road_marking", 255, 255, 255],
  [7, "crosswalk", 0, 250, 250],
  [8, "lane_marking_yellow", 250, 255, 100],
  [9, "bike_lane", 0, 230, 60],
  [10, "bus_lane", 180, 80, 20],
  [11, "gutter", 60, 20, 190],
  [12, "detectable_warning", 200, 140, 0],
  [13, "plaza", 170, 150, 70],
  [14, "footpath", 230, 200, 180],
  [15, "terrain", 152, 251, 152],
  [16, "grass", 40, 180, 10],
  [17, "vegetation", 107, 142, 35],
  [18, "water", 30, 80, 160],
  [19, "car", 0, 0, 142],
  [20, "bus", 0, 60, 100],
  [21, "truck", 0, 0, 70],
  [22, "bicycle", 119, 11, 32],
  [23, "pedestrian", 220, 20, 60],
  [24, "traffic_signal", 250, 170, 30],
  [25, "pedestrian_signal", 210, 90, 190],
  [26, "street_sign", 220, 220, 0],
  [27, "street_light", 153, 153, 153],
  [28, "hydrant", 230, 110, 80],
  [29, "street_furniture", 140, 100, 250],
  [30, "bus_shelter", 90, 220, 220],
  [31, "subway_entrance", 110, 0, 250],
  [32, "scaffold", 210, 180, 90],
  [33, "building_appurtenance", 120, 70, 0],
  [34, "roof_structure", 120, 160, 210],
  [35, "bridge", 20, 170, 120],
].map(([id, name, r, g, b]) => ({ id: id as number, name: name as string, rgb: [r, g, b] as [number, number, number] }));

/**
 * BoundlessNYC class → Mannahatta class. `null` means the pixel is not land
 * cover (sky, vehicles, people, signals, signage, furniture) and is excluded
 * from ground truth; its share is reported as `unmappedShare`. Mappings
 * marked ambiguous are documented judgements whose share is reported.
 */
export const BOUNDLESS_CLASS_MAP: Record<string, { to: CompositionKey | null; ambiguous?: string }> = {
  unlabeled: { to: null },
  sky: { to: null },
  building: { to: "buildings" },
  building_appurtenance: { to: "buildings" },
  roof_structure: { to: "buildings" },
  scaffold: { to: null },
  road: { to: "pavement" },
  sidewalk: { to: "pavement" },
  curb: { to: "pavement" },
  road_marking: { to: "pavement" },
  crosswalk: { to: "pavement" },
  lane_marking_yellow: { to: "pavement" },
  bike_lane: { to: "pavement" },
  bus_lane: { to: "pavement" },
  gutter: { to: "pavement" },
  detectable_warning: { to: "pavement" },
  plaza: { to: "pavement" },
  footpath: { to: "pavement", ambiguous: "park paths include gravel walks, which are pervious" },
  bridge: { to: "pavement", ambiguous: "a deck over water or road, not ground" },
  terrain: { to: "bareSoil", ambiguous: "BoundlessNYC terrain is unpaved ground other than lawns; may include sparse grass" },
  grass: { to: "vegetation" },
  vegetation: { to: "vegetation" },
  water: { to: "water" },
  car: { to: null },
  bus: { to: null },
  truck: { to: null },
  bicycle: { to: null },
  pedestrian: { to: null },
  traffic_signal: { to: null },
  pedestrian_signal: { to: null },
  street_sign: { to: null },
  street_light: { to: null },
  hydrant: { to: null },
  street_furniture: { to: null },
  bus_shelter: { to: null },
  subway_entrance: { to: null },
};

/** Composition from a per-class pixel histogram (class name → pixel count). */
export function compositionFromHistogram(histogram: Record<string, number>): { composition: SemanticComposition; unmappedShare: number; ambiguousShare: number; mappedPixels: number } {
  const sums: Record<CompositionKey, number> = { vegetation: 0, pavement: 0, buildings: 0, bareSoil: 0, water: 0 };
  let total = 0;
  let mapped = 0;
  let ambiguous = 0;
  for (const [name, pixels] of Object.entries(histogram)) {
    if (!Number.isFinite(pixels) || pixels < 0) throw new Error(`Pixel count for ${name} must be a non-negative number.`);
    total += pixels;
    const rule = BOUNDLESS_CLASS_MAP[name];
    if (!rule) throw new Error(`Unknown BoundlessNYC class "${name}"; extend BOUNDLESS_CLASS_MAP deliberately.`);
    if (rule.to === null) continue;
    sums[rule.to] += pixels;
    mapped += pixels;
    if (rule.ambiguous) ambiguous += pixels;
  }
  if (mapped === 0) throw new Error("No land-cover pixels in the scene; it cannot be scored.");
  const composition = Object.fromEntries(COMPOSITION_KEYS.map((key) => [key, (sums[key] / mapped) * 100])) as SemanticComposition;
  return { composition, unmappedShare: total ? (total - mapped) / total : 0, ambiguousShare: ambiguous / mapped, mappedPixels: mapped };
}

/** Per-class pixel counts from a colourised (palette RGB/RGBA) semantic mask; unknown colours count as unlabeled. */
export function histogramFromPalette(data: Uint8Array | Uint8ClampedArray, channels: 3 | 4): Record<string, number> {
  const byColour = new Map(BOUNDLESS_CLASSES.map((c) => [(c.rgb[0] << 16) | (c.rgb[1] << 8) | c.rgb[2], c.name]));
  const counts: Record<string, number> = {};
  for (let i = 0; i + channels - 1 < data.length; i += channels) {
    const name = byColour.get((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]) ?? "unlabeled";
    counts[name] = (counts[name] ?? 0) + 1;
  }
  return counts;
}

export interface BoundlessSceneRecord {
  id: string;
  rgbPath: string;
  rgbSha256: string;
  width?: number;
  height?: number;
  /** Class-name pixel histogram of the scene's semantic mask (see histogramFromPalette). */
  semanticHistogram: Record<string, number>;
  camera: SceneCamera;
  /** How pedestrians were rendered: required, and MetaHuman-derived ones are refused. */
  pedestrians: "none" | "procedural" | "metahuman" | "unknown";
  vehiclesPresent?: boolean;
  lighting?: string;
  weather?: string;
  sceneClass?: string;
  boundlessVersion?: string;
}

/** Absent optional fields are omitted, never stored as undefined (which cannot be hashed canonically). */
function defined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}

export const BOUNDLESS_ATTRIBUTION = ["Rendered with BoundlessNYC (M. K. Turkcan), https://github.com/mkturkcan/boundless-nyc", "© OpenStreetMap contributors"];
export const CARLA_ATTRIBUTION = "CARLA Simulator (carla.org), CC BY 4.0";

export const boundlessSceneAdapter: SyntheticSceneAdapter<BoundlessSceneRecord> = {
  id: "boundless-nyc",
  describe: "BoundlessNYC semantic camera (Cityscapes-compatible classes) mapped to Mannahatta's five classes",
  toScene(raw) {
    if (raw.pedestrians === "metahuman" || raw.pedestrians === "unknown") {
      throw new Error(
        `Scene ${raw.id}: pedestrians "${raw.pedestrians}" refused. MetaHuman-derived assets may not be used to test AI models; render with --pedestrians procedural (or ?crowd=0).`,
      );
    }
    if (!/^[0-9a-f]{64}$/.test(raw.rgbSha256)) throw new Error(`Scene ${raw.id}: rgbSha256 must be a SHA-256 hex digest of the image bytes.`);
    const { composition, unmappedShare, ambiguousShare } = compositionFromHistogram(raw.semanticHistogram);
    return {
      id: raw.id,
      rgb: defined({ kind: "path" as const, value: raw.rgbPath, sha256: raw.rgbSha256, width: raw.width, height: raw.height }),
      groundTruth: composition,
      metadata: defined({
        source: `boundless-nyc${raw.boundlessVersion ? `@${raw.boundlessVersion}` : ""}`,
        camera: defined({ ...raw.camera }),
        lighting: raw.lighting,
        weather: raw.weather,
        sceneClass: raw.sceneClass,
        unmappedShare,
        ambiguousShare,
        // Procedural pedestrians use no third-party assets; CARLA credit is owed where its vehicles appear.
        attribution: raw.vehiclesPresent ? [...BOUNDLESS_ATTRIBUTION, CARLA_ATTRIBUTION] : [...BOUNDLESS_ATTRIBUTION],
      }),
    };
  },
};
