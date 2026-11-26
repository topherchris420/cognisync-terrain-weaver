/**
 * LIVE EXTERNAL SERVICES — opt-in only. Never run in CI.
 *
 *   npm run eras:check
 *
 * Asks every era's publisher, right now, whether its imagery is really there:
 * the same probe the app runs before drawing a year (two distinct, real image
 * tiles), plus the coverage edges the timeline relies on — the deepest cached
 * level answers, the level past it does not, and a tile outside New York City
 * is a clean miss rather than a placeholder. Exits non-zero on any failure.
 */
import { ERAS, eraTileUrl, type MapEra } from "@/lib/historical/eras";
import { isImageBytes, lngLatToTile, probeEraImagery } from "@/lib/historical/era-imagery";

const MIDTOWN: [number, number] = [-73.985, 40.758];
const PHILADELPHIA: [number, number] = [-75.16, 39.95];

async function status(url: string): Promise<{ status: number; image: boolean }> {
  const response = await fetch(url);
  const bytes = new Uint8Array(await response.arrayBuffer());
  return { status: response.status, image: isImageBytes(bytes) };
}

function tile(era: MapEra, [lng, lat]: [number, number], zoom: number) {
  const { x, y, z } = lngLatToTile(lng, lat, zoom);
  return eraTileUrl(era, z, x, y)!;
}

async function check(era: MapEra): Promise<string[]> {
  const problems: string[] = [];
  const probe = await probeEraImagery(era);
  if (!probe.ok) problems.push(`probe ${probe.phase}: ${probe.message}`);
  if (era.kind !== "raster") return problems;

  const deepest = await status(tile(era, MIDTOWN, era.maxzoom!));
  if (deepest.status !== 200 || !deepest.image) {
    problems.push(`z${era.maxzoom} at Midtown answered ${deepest.status}`);
  }
  const beyond = await status(tile(era, MIDTOWN, era.maxzoom! + 1));
  if (beyond.status === 200 && beyond.image) {
    problems.push(`z${era.maxzoom! + 1} is cached too; maxzoom could be raised`);
  }
  const outside = await status(tile(era, PHILADELPHIA, 14));
  if (outside.status === 200) {
    problems.push(`a tile outside NYC answered 200 (placeholder?)`);
  }
  return problems;
}

let failures = 0;
for (const era of ERAS.filter((e) => e.tiles)) {
  try {
    const problems = await check(era);
    failures += problems.length;
    console.log(`${problems.length ? "✗" : "✓"} ${era.label.padEnd(6)} ${era.tiles}`);
    for (const problem of problems) console.log(`    ${problem}`);
  } catch (error) {
    failures += 1;
    console.log(`✗ ${era.label.padEnd(6)} ${String(error)}`);
  }
}
for (const era of ERAS.filter((e) => !e.tiles)) {
  console.log(`· ${era.label.padEnd(6)} ${era.kind} — ${era.sourceUrl ?? era.agency}`);
}
process.exit(failures ? 1 : 0);
