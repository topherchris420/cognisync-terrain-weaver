/**
 * Build the compact Welikia 1609 block index shipped in `public/data`.
 *
 * Source data (both published by the Welikia Project / New York Botanical
 * Garden and served with permissive CORS headers):
 *
 *   https://www.welikia.org/final_joined_blocks_named.geojson  (~30 MB)
 *   https://www.welikia.org/ecocom_by_block_2.json             (~9 MB)
 *
 * The first holds the block geometry of New York City, the second the
 * *observed* reconstruction of which ecological communities covered each of
 * those blocks in 1609, with the share of the block each community held.
 *
 * Neither file is small enough to fetch in a browser on demand, so this script
 * reduces them once, at build time, to a bounding box plus a five-class cover
 * mix per block. Nothing is invented: the only transformation is (a) polygon
 * geometry collapsed to its bounding box and (b) the 97 New York Natural
 * Heritage community names mapped onto this app's five surface classes by the
 * keyword table below, which is reported to the user as the classification
 * method.
 *
 * Run with:  bun scripts/build-welikia-1609-blocks.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";

const BLOCKS_URL = "https://www.welikia.org/final_joined_blocks_named.geojson";
const ECOCOM_URL = "https://www.welikia.org/ecocom_by_block_2.json";
const OUT_PATH = "public/data/welikia-1609-blocks.json";

/**
 * Community name -> surface class.
 *
 * Order matters: the first matching keyword wins. Lenape settlement, paths and
 * shell middens classify as bare soil rather than buildings, for the same
 * reason the written baseline does — bark over a dirt floor is not a sealed,
 * drained roof, and calling it one would import a runoff coefficient that does
 * not describe the thing.
 */
const CLASS_RULES = [
  ["water", /deepwater|tidal river|confined river|stream|\bpond\b|aquatic bed|eelgrass|vernal pool|subtidal|oxbow/i],
  ["soil", /beach|mudflat|dune|outcrop|cliff|bluff|talus|cave|shell midden|lenape path|lenape living|lenape house|intertidal shore|rocky intertidal/i],
  ["vegetation", /forest|woodland|swamp|marsh|\bfen\b|\bbog\b|meadow|grassland|shrub|heath|barrens|field|swale|panne|scrub|thicket/i],
];

function classifyCommunity(name) {
  for (const [surface, pattern] of CLASS_RULES) {
    if (pattern.test(name)) return surface;
  }
  return null;
}

function bboxOf(geometry) {
  let west = 180;
  let south = 90;
  let east = -180;
  let north = -90;
  const walk = (node) => {
    if (typeof node[0] === "number") {
      const [lng, lat] = node;
      if (lng < west) west = lng;
      if (lng > east) east = lng;
      if (lat < south) south = lat;
      if (lat > north) north = lat;
      return;
    }
    for (const child of node) walk(child);
  };
  walk(geometry.coordinates);
  return [west, south, east, north];
}

const round = (value) => Math.round(value * 1e5) / 1e5;

async function main() {
  process.stdout.write("fetching Welikia block ecology…\n");
  const [blocks, ecocom] = await Promise.all([
    fetch(BLOCKS_URL).then((r) => r.json()),
    fetch(ECOCOM_URL).then((r) => r.json()),
  ]);

  /** bid -> { cover, dominant, classifiedShare } */
  const coverByBid = new Map();
  const unmatched = new Map();

  for (const row of ecocom) {
    const cover = { vegetation: 0, soil: 0, water: 0 };
    let dominant = null;
    let dominantShare = 0;
    let classified = 0;
    for (let i = 1; i <= 12; i += 1) {
      const name = row[`name${i}`];
      const share = Number(row[`percent${i}`]);
      if (!name || !Number.isFinite(share) || share <= 0) continue;
      const surface = classifyCommunity(name);
      if (!surface) {
        unmatched.set(name, (unmatched.get(name) ?? 0) + 1);
        continue;
      }
      cover[surface] += share;
      classified += share;
      if (share > dominantShare) {
        dominantShare = share;
        dominant = name;
      }
    }
    if (classified <= 0) continue;
    coverByBid.set(Number(row.bid), { cover, dominant, classified });
  }

  const names = [];
  const nameIndex = new Map();
  const rows = [];

  for (const feature of blocks.features) {
    const bid = Number(feature.properties?.bid);
    const record = coverByBid.get(bid);
    if (!record || !feature.geometry) continue;
    const [west, south, east, north] = bboxOf(feature.geometry);
    let key = record.dominant ?? "";
    if (!nameIndex.has(key)) {
      nameIndex.set(key, names.length);
      names.push(key);
    }
    // Normalise to whole percent of the classified share so the three classes
    // always sum to 100 for the block.
    const total = record.classified;
    rows.push([
      round(west),
      round(south),
      round(east),
      round(north),
      Math.round((record.cover.vegetation / total) * 100),
      Math.round((record.cover.soil / total) * 100),
      Math.round((record.cover.water / total) * 100),
      nameIndex.get(key),
    ]);
  }

  const payload = {
    version: 1,
    source: {
      title: "Welikia Project 1609 ecological communities, by city block",
      agency:
        "Wildlife Conservation Society / New York Botanical Garden (Welikia Project)",
      url: "https://www.welikia.org/map-explorer",
      accessedAt: new Date().toISOString().slice(0, 10),
      method:
        "Published per-block ecological community shares reduced to block bounding boxes and mapped onto five surface classes by community keyword.",
    },
    communities: names,
    /** [west, south, east, north, vegetation%, soil%, water%, communityIndex] */
    blocks: rows,
  };

  mkdirSync("public/data", { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(payload));
  process.stdout.write(
    `wrote ${OUT_PATH}: ${rows.length} blocks, ${names.length} communities\n`
  );
  const top = [...unmatched.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (top.length) {
    process.stdout.write(`unmatched communities: ${JSON.stringify(top)}\n`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
