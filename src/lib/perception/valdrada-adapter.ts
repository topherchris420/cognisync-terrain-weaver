import { COMPOSITION_KEYS, type CompositionKey, type SceneCamera, type SyntheticScene, type SyntheticSceneAdapter } from "./synthetic-scene";

/** Valdrada's class_u8 payload: one uint8 class id per pixel, row-major. */
export interface ValdradaClassU8 { width: number; height: number; data: Uint8Array }
export interface ValdradaSceneRecord {
  id: string;
  rgbPath: string;
  rgbSha256: string;
  semantic: ValdradaClassU8;
  camera: SceneCamera;
  metricDepthPath?: string;
  metricDepthSha256?: string;
  sceneClass?: string;
  lighting?: string;
  weather?: string;
  simulatorVersion?: string;
  vehiclesPresent?: boolean;
  pedestrians?: "none" | "procedural" | "metahuman" | "unknown";
}

/** Cityscapes-compatible ids used by Valdrada's semantic sensor. */
export const VALDRADA_CLASSES: Record<number, string> = {
  0: "unlabeled", 1: "ego_vehicle", 2: "rectification", 3: "out_of_roi", 4: "static", 5: "dynamic", 6: "ground",
  7: "road", 8: "sidewalk", 9: "parking", 10: "rail_track", 11: "building", 12: "wall", 13: "fence",
  14: "guard_rail", 15: "bridge", 16: "tunnel", 17: "pole", 18: "polegroup", 19: "traffic_light",
  20: "traffic_sign", 21: "vegetation", 22: "terrain", 23: "sky", 24: "person", 25: "rider", 26: "car",
  27: "truck", 28: "bus", 29: "train", 30: "motorcycle", 31: "bicycle", 32: "water",
};

const VALDRADA_CLASS_MAP: Record<string, { to: CompositionKey | null; ambiguous?: string }> = {
  road: { to: "pavement" }, sidewalk: { to: "pavement" }, parking: { to: "pavement" }, rail_track: { to: "pavement" },
  building: { to: "buildings" }, wall: { to: "buildings" }, bridge: { to: "pavement", ambiguous: "bridge deck is not ground" },
  vegetation: { to: "vegetation" }, water: { to: "water" }, terrain: { to: "bareSoil", ambiguous: "terrain may include sparse grass" },
  ground: { to: "bareSoil", ambiguous: "ground is simulator-defined" },
  unlabeled: { to: null }, ego_vehicle: { to: null }, rectification: { to: null }, out_of_roi: { to: null }, static: { to: null }, dynamic: { to: null },
  fence: { to: null }, guard_rail: { to: null }, tunnel: { to: null }, pole: { to: null }, polegroup: { to: null }, traffic_light: { to: null }, traffic_sign: { to: null }, sky: { to: null },
  person: { to: null }, rider: { to: null }, car: { to: null }, truck: { to: null }, bus: { to: null }, train: { to: null }, motorcycle: { to: null }, bicycle: { to: null },
};

export function histogramFromClassU8(payload: ValdradaClassU8): Record<string, number> {
  if (!Number.isInteger(payload.width) || !Number.isInteger(payload.height) || payload.width <= 0 || payload.height <= 0) throw new Error("Valdrada semantic dimensions must be positive integers.");
  if (payload.data.length !== payload.width * payload.height) throw new Error("Valdrada class_u8 payload length does not match dimensions.");
  const counts: Record<string, number> = {};
  for (const id of payload.data) {
    const name = VALDRADA_CLASSES[id];
    if (!name) throw new Error(`Unknown Valdrada semantic class id ${id}; extend VALDRADA_CLASSES deliberately.`);
    counts[name] = (counts[name] ?? 0) + 1;
  }
  return counts;
}

export function compositionFromValdradaHistogram(histogram: Record<string, number>) {
  const sums: Record<CompositionKey, number> = { vegetation: 0, pavement: 0, buildings: 0, bareSoil: 0, water: 0 };
  let total = 0; let mapped = 0; let ambiguous = 0;
  for (const [name, pixels] of Object.entries(histogram)) {
    if (!Number.isFinite(pixels) || pixels < 0) throw new Error(`Pixel count for ${name} must be non-negative.`);
    total += pixels;
    const rule = VALDRADA_CLASS_MAP[name];
    if (!rule) throw new Error(`Unknown Valdrada class "${name}"; extend VALDRADA_CLASS_MAP deliberately.`);
    if (rule.to === null) continue;
    sums[rule.to] += pixels; mapped += pixels; if (rule.ambiguous) ambiguous += pixels;
  }
  if (!mapped) throw new Error("No land-cover pixels in the Valdrada scene.");
  return { composition: Object.fromEntries(COMPOSITION_KEYS.map((key) => [key, sums[key] / mapped * 100])) as Record<CompositionKey, number>, unmappedShare: (total - mapped) / total, ambiguousShare: ambiguous / mapped, mappedPixels: mapped };
}

export const valdradaSceneAdapter: SyntheticSceneAdapter<ValdradaSceneRecord> = {
  id: "valdrada",
  describe: "Valdrada class_u8 semantic sensor mapped to Mannahatta's five land-cover classes",
  toScene(raw): SyntheticScene {
    if (raw.pedestrians === "metahuman" || raw.pedestrians === "unknown") throw new Error(`Scene ${raw.id}: restricted or unknown pedestrians cannot be used for AI evaluation.`);
    if (!/^[0-9a-f]{64}$/.test(raw.rgbSha256)) throw new Error(`Scene ${raw.id}: rgbSha256 must be a SHA-256 hex digest.`);
    const { composition, unmappedShare, ambiguousShare } = compositionFromValdradaHistogram(histogramFromClassU8(raw.semantic));
    return {
      id: raw.id, rgb: { kind: "path", value: raw.rgbPath, sha256: raw.rgbSha256 }, groundTruth: composition,
      metadata: { source: `valdrada${raw.simulatorVersion ? `@${raw.simulatorVersion}` : ""}`, camera: raw.camera, sceneClass: raw.sceneClass, lighting: raw.lighting, weather: raw.weather, unmappedShare, ambiguousShare,
        attribution: ["Rendered with Valdrada (Mehmet Kerem Turkcan), https://github.com/mkturkcan/valdrada", "© OpenStreetMap contributors", ...(raw.vehiclesPresent ? ["CARLA Simulator (carla.org), CC BY 4.0"] : [])] },
    };
  },
};

export function decodeClassU8(bytes: Uint8Array, width: number, height: number): ValdradaClassU8 {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0 || bytes.length !== width * height) throw new Error("Invalid Valdrada class_u8 dimensions or payload length.");
  return { width, height, data: new Uint8Array(bytes) };
}

export { VALDRADA_CLASS_MAP };
export type ValdradaComposition = Record<CompositionKey, number>;
export const valdradaAdapterVersion = "valdrada-class-u8-v1";
