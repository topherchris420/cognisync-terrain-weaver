import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fetchOfficialSpatialContext } from "../supabase/functions/_shared/spatial-context.ts";
import { LIVE_LAND_COVER_SOURCE_IDS } from "../src/lib/spatial-data/registry.ts";

const BBOX = {
  north: 40.72,
  south: 40.7,
  east: -73.99,
  west: -74.02,
};
const PUBLIC_BBOX = [-74.02, 40.7, -73.99, 40.72];
const GEOJSON_PATH = new URL(
  "../public/data/lower-manhattan-spatial-context.geojson",
  import.meta.url
);
const MANIFEST_PATH = new URL(
  "../public/data/lower-manhattan-spatial-context.manifest.json",
  import.meta.url
);

function checksum(content) {
  return createHash("sha256").update(content).digest("hex");
}

function unavailable(detail) {
  console.log(`guided example unavailable: ${detail}`);
}

async function check() {
  let geojson;
  let manifest;
  try {
    [geojson, manifest] = await Promise.all([
      readFile(GEOJSON_PATH, "utf8"),
      readFile(MANIFEST_PATH, "utf8"),
    ]);
  } catch {
    unavailable("generated GeoJSON and manifest are not present");
    return;
  }

  const parsed = JSON.parse(manifest);
  const actual = checksum(geojson);
  if (!/^[a-f0-9]{64}$/.test(parsed.sha256) || parsed.sha256 !== actual) {
    throw new Error("guided example manifest checksum does not match GeoJSON");
  }
  console.log(`guided example checksum verified: ${actual}`);
}

async function generate() {
  const result = await fetchOfficialSpatialContext(BBOX);
  if (result.failedSourceIds.length > 0) {
    unavailable(`official sources failed: ${result.failedSourceIds.join(", ")}`);
    return;
  }

  const features = [...result.features].sort((left, right) => {
    const leftKey = `${left.properties.sourceId}:${left.properties.featureId}`;
    const rightKey = `${right.properties.sourceId}:${right.properties.featureId}`;
    return leftKey.localeCompare(rightKey);
  });
  const geojson = JSON.stringify({ type: "FeatureCollection", features });
  const sha256 = checksum(geojson);
  const manifest = {
    id: "lower-manhattan-guided-example",
    kind: "guided example",
    generatedAt: new Date().toISOString(),
    bbox: PUBLIC_BBOX,
    sha256,
    sources: [...LIVE_LAND_COVER_SOURCE_IDS],
    coverage: "partial",
    caveats: [
      "Tree records are points, not canopy polygons.",
      "Unclassified areas are not inferred land cover.",
    ],
  };

  await mkdir(new URL("../public/data/", import.meta.url), { recursive: true });
  await Promise.all([
    writeFile(GEOJSON_PATH, geojson, "utf8"),
    writeFile(MANIFEST_PATH, JSON.stringify(manifest), "utf8"),
  ]);
  console.log(`guided example generated: ${sha256}`);
}

if (process.argv.includes("--check")) {
  await check();
} else {
  await generate();
}
