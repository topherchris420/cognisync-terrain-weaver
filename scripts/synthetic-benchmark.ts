/**
 * SYNTHETIC DIAGNOSTIC BENCHMARK — opt-in tooling. Never run in CI.
 *
 *   npm run benchmark:synthetic -- ingest <export-dir>
 *   npm run benchmark:synthetic -- classify [--repeats 3]
 *   npm run experiment -- classification/C4
 *
 * ingest: reads <export-dir>/manifest.json, a list of rendered scenes:
 *   { "suite": "...", "boundlessVersion": "...", "scenes": [{
 *       "id": "000123", "rgb": "rgb/000123.png", "semantic": "semantic/000123.png",
 *       "camera": { "view": "nadir", "pitchDeg": -90, "altitudeM": 300 },
 *       "pedestrians": "procedural", "vehiclesPresent": true,
 *       "lighting": "noon", "weather": "clear", "sceneClass": "midtown" }] }
 * Semantic masks must be BoundlessNYC's colourised PNGs (save_to_disk default).
 * Ground truth is computed from each mask; scenes rendered with MetaHuman-
 * derived pedestrians are refused (their licence forbids testing AI on them).
 * Writes experiments/data/synthetic/scenes.json.
 *
 * classify: sends ONLY each scene's RGB image to the analyze-terrain edge
 * function in diagnostic_only mode (no location, no metadata, nothing
 * persisted), checks every answer is a diagnostic one, and freezes the
 * answers in experiments/data/synthetic/predictions.json.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { relative, resolve } from "node:path";
import { stableHash } from "@/lib/counterfactual/hashing";
import { boundlessSceneAdapter, histogramFromPalette, type BoundlessSceneRecord } from "@/lib/perception/boundless-adapter";
import { runSyntheticBenchmark, type RgbClassifier } from "@/lib/perception/benchmark";
import { SYNTHETIC_LABEL, type SyntheticScene } from "@/lib/perception/synthetic-scene";
import { decodePng } from "./lib/png";

const ROOT = resolve(import.meta.dirname ?? __dirname, "..");
const DATA = resolve(ROOT, "experiments/data/synthetic");
const [command, ...rest] = process.argv.slice(2);

function writeFixture(name: string, provenance: Record<string, unknown>, data: unknown) {
  writeFileSync(resolve(DATA, name), `${JSON.stringify({ provenance: { ...provenance, contentHash: stableHash(data) }, data })}\n`);
  console.log(`wrote experiments/data/synthetic/${name}`);
}

function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

function ingest(directory: string) {
  const dir = resolve(directory);
  const manifest = JSON.parse(readFileSync(resolve(dir, "manifest.json"), "utf8")) as {
    suite?: string;
    boundlessVersion?: string;
    scenes: Array<Omit<BoundlessSceneRecord, "rgbPath" | "rgbSha256" | "semanticHistogram"> & { rgb: string; semantic: string }>;
  };
  const scenes: SyntheticScene[] = [];
  const refused: string[] = [];
  for (const entry of manifest.scenes) {
    const rgbBytes = new Uint8Array(readFileSync(resolve(dir, entry.rgb)));
    const rgb = decodePng(rgbBytes);
    const mask = decodePng(new Uint8Array(readFileSync(resolve(dir, entry.semantic))));
    try {
      scenes.push(
        boundlessSceneAdapter.toScene({
          ...entry,
          rgbPath: relative(ROOT, resolve(dir, entry.rgb)),
          rgbSha256: sha256(rgbBytes),
          width: rgb.width,
          height: rgb.height,
          semanticHistogram: histogramFromPalette(mask.data, 4),
          boundlessVersion: manifest.boundlessVersion,
        }),
      );
    } catch (error) {
      refused.push(`${entry.id}: ${(error as Error).message}`);
    }
  }
  refused.forEach((r) => console.warn(`refused ${r}`));
  writeFixture(
    "scenes.json",
    {
      source: `Synthetic scene set "${manifest.suite ?? "unnamed"}" (${scenes.length} scenes${refused.length ? `, ${refused.length} refused` : ""})`,
      url: "https://github.com/mkturkcan/boundless-nyc",
      retrievedAt: new Date().toISOString(),
      license: "BoundlessNYC renders are ODbL Produced Works: '© OpenStreetMap contributors'; CARLA Simulator (carla.org), CC BY 4.0 where vehicles appear.",
      evidence: "synthetic",
      method: `Ingested from ${relative(ROOT, dir)}; ground truth = mapped-pixel shares of each colourised semantic mask (BOUNDLESS_CLASS_MAP); RGB images identified by SHA-256.`,
      caveats: [`${SYNTHETIC_LABEL}: rendered scenes, not observations.`, ...refused.map((r) => `Refused ${r}`)],
    },
    { suite: manifest.suite ?? null, adapter: boundlessSceneAdapter.id, scenes },
  );
}

function supabaseConfig() {
  const envPath = resolve(ROOT, ".env");
  const env = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
  const value = (key: string) => process.env[key] ?? env.match(new RegExp(`${key}="([^"]+)"`))?.[1] ?? "";
  return { url: value("VITE_SUPABASE_URL"), key: value("VITE_SUPABASE_PUBLISHABLE_KEY") };
}

async function classify(repeats: number) {
  const scenes = (JSON.parse(readFileSync(resolve(DATA, "scenes.json"), "utf8")).data as { scenes: SyntheticScene[] }).scenes;
  if (scenes.length === 0) {
    console.error("No synthetic scenes are frozen. Run `npm run benchmark:synthetic -- ingest <export-dir>` first.");
    process.exit(2);
  }
  const { url, key } = supabaseConfig();
  const models = new Set<string>();
  const classifyRgb: RgbClassifier = async (rgb) => {
    const bytes = new Uint8Array(readFileSync(resolve(ROOT, rgb.value)));
    if (rgb.sha256 && sha256(bytes) !== rgb.sha256) throw new Error(`${rgb.value} changed since ingestion (hash mismatch).`);
    // Only the image and the diagnostic flag: no name, location, extent or metadata.
    const response = await fetch(`${url}/functions/v1/analyze-terrain`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({ image_data_url: `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`, diagnostic_only: true }),
    });
    const body = (await response.json().catch(() => ({}))) as { classification?: { land_cover: never; model: string; diagnostic?: boolean }; analysis?: { id?: string }; error?: string };
    if (body.analysis) throw new Error(`The endpoint persisted a scan (${body.analysis.id ?? "unknown id"}); it is not in diagnostic mode. Stop and delete that row.`);
    if (response.status === 400 && /center_lat/.test(body.error ?? "")) throw new Error("The deployed analyze-terrain predates diagnostic_only mode; deploy supabase/functions/analyze-terrain first. Nothing was classified or stored.");
    if (!response.ok || !body.classification?.diagnostic) throw new Error(`Classifier request failed (${response.status}): ${body.error ?? "no diagnostic classification returned"}`);
    models.add(body.classification.model);
    return { landCover: body.classification.land_cover, model: body.classification.model };
  };
  const predictions = await runSyntheticBenchmark(scenes, classifyRgb, { repeats });
  writeFixture(
    "predictions.json",
    {
      source: `Classifier predictions on ${scenes.length} synthetic scenes × ${repeats} repeats`,
      url: `${url}/functions/v1/analyze-terrain (diagnostic_only)`,
      retrievedAt: new Date().toISOString(),
      license: "Application output",
      evidence: "synthetic",
      method: "Each scene's RGB image only, sent in diagnostic_only mode (nothing persisted); answers frozen with model id and time.",
      caveats: [`${SYNTHETIC_LABEL}: not real-world accuracy.`, `Models: ${[...models].sort().join(", ")}`],
    },
    { classifier: [...models].sort().join(", "), mode: "diagnostic_only (no persistence, image only)", predictions },
  );
  console.log("Now run: npm run experiment -- classification/C4");
}

if (command === "ingest" && rest[0]) ingest(rest[0]);
else if (command === "classify") {
  const flag = rest.indexOf("--repeats");
  await classify(flag >= 0 ? Math.max(1, Number(rest[flag + 1]) || 1) : 1);
} else {
  console.error("Usage: npm run benchmark:synthetic -- ingest <export-dir> | classify [--repeats N]");
  process.exit(2);
}
