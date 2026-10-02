import { buildExperimentExport } from "@/lib/experiment-export";
import { replayExperiment } from "@/lib/experiment-replay";
import { EXAMPLE_ANALYSIS } from "@/lib/example-analysis";
import { EMPTY_SCENARIO } from "@/lib/scenario";
import { createStormSeal } from "@/lib/storm-identity";
import { stableHash } from "@/lib/counterfactual/hashing";
import { rasterizeSurfaceModifiers } from "@/lib/counterfactual/modifiers";
import { routeWatershed } from "@/lib/hydrology/engine";
import { compileSubstrate } from "@/lib/urban-substrate/compiler";
import { SUBSTRATE_COMPILER, SUBSTRATE_LEVELS, SUBSTRATE_SCHEMA_VERSION } from "@/lib/urban-substrate/config";
import { SUBSTRATE_USE } from "@/lib/urban-substrate/evidence";
import { makeIdentity, type SubstrateEvidence } from "@/lib/urban-substrate/identity";
import { closureTiles, planSubstrateTiles } from "@/lib/urban-substrate/loader";
import { computeManifestHash, serializeManifest, shortHash } from "@/lib/urban-substrate/manifest";
import { sourceSummary } from "@/lib/urban-substrate/provenance";
import { NYC_LOWER_MANHATTAN, NYC_LOWER_MANHATTAN_SOURCES } from "@/lib/urban-substrate/regions";
import type { SubstrateReader } from "@/lib/urban-substrate/replay";
import { SOURCE_FILES, loadSources, permuteSources } from "@/lib/urban-substrate/sources";
import type { CompiledSubstrate, LocalTile, SourceFixture } from "@/lib/urban-substrate/types";
import type { Experiment, FixtureLoader } from "../experiment";
import { demPath, elevationFromFixture, squareIntervention } from "../fixtures";
import { NAMED_STUDY_AREAS } from "../study-areas";

const SOURCES = Object.values(SOURCE_FILES).map((file) => `${NYC_LOWER_MANHATTAN_SOURCES}/${file}`);
const EXAMPLE = NAMED_STUDY_AREAS.find((a) => a.id === "lower-manhattan-example")!;
const PERMUTATION_SEED = 1609;
/** Two different, explicitly non-authoritative compile metadata, to prove they never reach identity. */
const RUN_A = { generatedAt: "2026-10-02T00:00:00.000Z", commit: "s1-run-a" };
const RUN_B = { generatedAt: "2031-01-01T12:00:00.000Z", commit: "s1-run-b" };

function compareCompiles(a: CompiledSubstrate, b: CompiledSubstrate) {
  const idsA = [...a.texts.keys()];
  const idsB = [...b.texts.keys()];
  const idMismatches = idsA.filter((id) => !b.texts.has(id)).length + idsB.filter((id) => !a.texts.has(id)).length;
  let contentMismatches = 0;
  let hashMismatches = 0;
  let geometryMismatches = 0;
  for (const id of idsA) {
    if (!b.texts.has(id)) continue;
    if (a.texts.get(id) !== b.texts.get(id)) contentMismatches += 1;
    if (a.manifest.hashes.tiles[id] !== b.manifest.hashes.tiles[id]) hashMismatches += 1;
    const ga = a.tiles.get(id)!;
    const gb = b.tiles.get(id)!;
    const geometry = (t: typeof ga) => JSON.stringify([t.layers.buildings.map((f) => f.footprint), t.layers.streets.map((f) => f.geometry)]);
    if (geometry(ga) !== geometry(gb)) geometryMismatches += 1;
  }
  return { idMismatches, contentMismatches, hashMismatches, geometryMismatches, manifestEqual: a.manifest.hashes.manifest === b.manifest.hashes.manifest && computeManifestHash(b.manifest) === a.manifest.hashes.manifest };
}

/** A study export routed on the frozen example extent with the substrate it would load; then replayed. */
function replayFixture(load: FixtureLoader, compiled: CompiledSubstrate) {
  const bbox = EXAMPLE.bbox;
  const plan = planSubstrateTiles(compiled.manifest, bbox);
  const local = new Map(plan.local.map((id) => [id, compiled.tiles.get(id) as LocalTile]));
  const closure = closureTiles(compiled.manifest, local, plan.localRect);
  const ids = [...plan.local, ...closure, ...plan.context];
  const identity = makeIdentity({
    schemaVersion: compiled.manifest.schemaVersion,
    substrateVersion: compiled.manifest.substrateVersion,
    manifestHash: compiled.manifest.hashes.manifest,
    tileHashes: Object.fromEntries(ids.map((id) => [id, compiled.manifest.hashes.tiles[id]])),
  });
  const substrate: SubstrateEvidence = {
    state: identity,
    sources: compiled.manifest.sources.map(sourceSummary),
    layers: Object.values(compiled.manifest.layers).map((l) => ({ id: l.id, title: l.title, evidence: l.evidence, caveats: l.caveats })),
    coverage: { status: "complete", fraction: 1 },
    compiler: { name: compiled.manifest.compiler.name, version: compiled.manifest.compiler.version, configHash: compiled.manifest.compiler.configHash },
    diagnostics: null,
    use: SUBSTRATE_USE,
  };
  const forcing = { rainfallDepthMm: 50, durationMinutes: 60, distribution: "uniform" as const, resolution: "low" as const, includeDrainage: false as const };
  const storm = createStormSeal({ ...forcing, id: "s1-storm", hash: stableHash(forcing) }, "2026-10-02T00:00:00.000Z");
  const elevation = elevationFromFixture(load, EXAMPLE.id, "terrarium", 36);
  const swale = squareIntervention("bioswales", bbox, 1500);
  const base = { ...forcing, bbox, landCover: EXAMPLE_ANALYSIS.land_cover, stormHash: storm.storm.hash, elevation, substrateHash: identity.identityHash };
  const now = routeWatershed({ ...base, surfaceId: "now", surfaceHash: "s1:now" });
  const possible = routeWatershed({ ...base, surfaceId: "possible", surfaceHash: "s1:possible", modifiers: rasterizeSurfaceModifiers([swale], bbox, 36, 36), expectedElevationHash: now.elevationHash });
  const exported = JSON.parse(JSON.stringify(buildExperimentExport({ analysis: EXAMPLE_ANALYSIS, scenario: EMPTY_SCENARIO, interventions: [swale], storm, now, possible, extent: bbox, elevation, substrate })));
  const manifestText = serializeManifest(compiled.manifest);
  const reader = (overrides: Record<string, string> = {}): SubstrateReader => ({
    location: "frozen compile",
    manifest: () => manifestText,
    tile: (id) => overrides[id] ?? compiled.texts.get(id) ?? null,
  });
  const clean = replayExperiment(exported, { substrate: reader() });
  // Tamper: move one footprint vertex in the example's centre tile by one stored unit (1e-7°, about 1 cm).
  const target = "nyc/512/41/47";
  const tile = JSON.parse(compiled.texts.get(target)!) as LocalTile;
  const footprint = tile.layers.buildings[0].footprint;
  const polygon = footprint.type === "Polygon" ? footprint.coordinates : footprint.coordinates[0];
  polygon[0][1][0] = Math.round((polygon[0][1][0] + 1e-7) * 1e7) / 1e7;
  const tampered = replayExperiment(exported, { substrate: reader({ [target]: `${JSON.stringify(tile)}\n` }) });
  return { identity, clean, tampered, target, ids };
}

export const substrateDeterminism: Experiment = {
  spec: {
    id: "substrate/S1-substrate-determinism",
    domain: "substrate",
    title: "Does the substrate compiler reproduce the same spatial state from the same frozen inputs?",
    question: "Does the urban substrate compiler produce the same experiment-relevant spatial state from the same frozen inputs?",
    hypothesis:
      "Compiling the frozen Lower Manhattan sources twice (with different non-authoritative timestamps and commits) and a third time with every source's records in a seeded random order yields identical tile ids, identical tile bytes and geometry, identical tile hashes and an identical manifest hash; validation reports zero errors; a study export routed with that substrate replays; and moving one footprint vertex by 1e-7° in one tile makes the same replay fail on that tile.",
    tier: "repeated-measurement",
    inputs: [...SOURCES, demPath(EXAMPLE.id)],
    conditions: {
      region: NYC_LOWER_MANHATTAN.label,
      compiler: `${SUBSTRATE_COMPILER.name}@${SUBSTRATE_COMPILER.version}`,
      schema: SUBSTRATE_SCHEMA_VERSION,
      localTileM: SUBSTRATE_LEVELS.local.tileSizeM,
      contextTileM: SUBSTRATE_LEVELS.context.tileSizeM,
      permutationSeed: PERMUTATION_SEED,
      runA: `${RUN_A.generatedAt} / ${RUN_A.commit}`,
      runB: `${RUN_B.generatedAt} / ${RUN_B.commit}`,
      replayExtent: EXAMPLE.id,
      tamper: "one footprint vertex in nyc/512/41/47 moved by 1e-7°",
    },
    split: "None: a determinism and integrity test on frozen inputs. Pass criteria were written with the hypothesis, before the first run.",
    metrics: [
      "tile id mismatches between compiles (pass: 0)",
      "tile byte, geometry and hash mismatches (pass: 0)",
      "manifest hash equality, including under record permutation (pass: equal)",
      "validation errors (pass: 0; warnings are reported, not failed)",
      "replay of a study export against the frozen substrate (pass: reproduced)",
      "replay with one tampered tile (pass: fails, naming that tile)",
    ],
    limitations: [
      "Determinism is not correctness: two identical compiles can be identically wrong. Source accuracy is not judged here; validation warnings report what is known.",
      "Runs in one JavaScript engine (Node/V8). Cross-engine identity is argued from construction (only correctly rounded IEEE-754 operations in authoritative paths, no Math.pow, trigonometry or locale-dependent sorting) but not tested.",
      "One frozen snapshot (retrieved 2026-10-02) of one 2.56 km square; other places and later releases are untested.",
      "The replay fixture uses illustrative example land cover and a synthetic square intervention; it tests identity, not hydrology.",
      "Content hashes detect change; they are not signatures and do not authenticate who compiled a substrate.",
    ],
  },
  run(load) {
    const sources = loadSources(load as unknown as <T>(path: string) => SourceFixture<T>, NYC_LOWER_MANHATTAN_SOURCES);
    const a = compileSubstrate(sources, NYC_LOWER_MANHATTAN, RUN_A);
    const b = compileSubstrate(sources, NYC_LOWER_MANHATTAN, RUN_B);
    const c = compileSubstrate(permuteSources(sources, PERMUTATION_SEED), NYC_LOWER_MANHATTAN, RUN_A);
    const repeat = compareCompiles(a, b);
    const permuted = compareCompiles(a, c);
    const replay = replayFixture(load, a);
    const tamperFlagged = replay.tampered.substrateMismatches.some((m) => m.kind === "tile-hash" && m.tileId === replay.target);
    const tiles = [...a.tiles.values()];
    const local = tiles.filter((t): t is LocalTile => t.level === "local");
    const count = (f: (t: LocalTile) => number) => local.reduce((sum, t) => sum + f(t), 0);
    const pass =
      repeat.idMismatches + repeat.contentMismatches + repeat.hashMismatches + repeat.geometryMismatches === 0 &&
      permuted.idMismatches + permuted.contentMismatches + permuted.hashMismatches + permuted.geometryMismatches === 0 &&
      repeat.manifestEqual &&
      permuted.manifestEqual &&
      a.manifest.validation.errors === 0 &&
      replay.clean.reproduced &&
      !replay.tampered.reproduced &&
      tamperFlagged;
    const v = a.manifest.validation;
    return {
      verdict: pass
        ? {
            status: "supported",
            statement: `Three compiles of the frozen sources (two clocks, one seeded record permutation) produced the same ${tiles.length} tiles byte for byte and the same manifest ${shortHash(a.manifest.hashes.manifest)}; validation found 0 errors and ${v.warnings} source-data warnings. A study export replayed against the frozen substrate; moving one vertex by 1e-7° in ${replay.target} made replay fail on that tile.`,
          }
        : {
            status: "not-supported",
            statement: `The compiler did not reproduce its output or did not detect tampering: repeat mismatches ${repeat.contentMismatches}, permutation mismatches ${permuted.contentMismatches}, validation errors ${v.errors}, clean replay ${replay.clean.reproduced ? "reproduced" : "failed"}, tampered replay ${replay.tampered.reproduced ? "wrongly reproduced" : "failed"}.`,
          },
      findings: {
        tiles: tiles.length,
        localTiles: local.length,
        contextTiles: tiles.length - local.length,
        manifestHash: a.manifest.hashes.manifest,
        tileIdMismatches: repeat.idMismatches + permuted.idMismatches,
        tileContentMismatches: repeat.contentMismatches + permuted.contentMismatches,
        geometryMismatches: repeat.geometryMismatches + permuted.geometryMismatches,
        tileHashMismatches: repeat.hashMismatches + permuted.hashMismatches,
        manifestEqualAcrossClocks: repeat.manifestEqual,
        permutationInvariant: permuted.manifestEqual && permuted.contentMismatches === 0,
        validationErrors: v.errors,
        validationWarnings: v.warnings,
        buildings: count((t) => t.layers.buildings.length),
        streetSegments: count((t) => t.layers.streets.length),
        streetGraphNodes: count((t) => t.layers.streetGraph.nodes.length),
        streetGraphEdges: count((t) => t.layers.streetGraph.edges.length),
        trees: count((t) => t.layers.vegetation.trees.length),
        replayTiles: replay.ids.length,
        replayReproduced: replay.clean.reproduced,
        tamperDetected: !replay.tampered.reproduced && tamperFlagged,
      },
      observations: [
        `Sources: ${a.manifest.sources.length} frozen public datasets; content hashes are of record sets, so provider order cannot change identity.`,
        `Timestamps and commits differed between runs (${RUN_A.generatedAt} vs ${RUN_B.generatedAt}) and are recorded in the manifest, but excluded from every hash by design.`,
        `Validation warnings are facts about the sources, kept visible: ${v.checks.filter((c) => c.severity === "warning" && !c.passed).map((c) => `${c.label} (${c.failures})`).join("; ") || "none"}.`,
        `The replay fixture recorded ${replay.ids.length} tiles for the example extent (local tiles within the buffer, their closure, and context tiles) and reproduced every routed volume.`,
        `Tampered replay failed as required, on the check${replay.tampered.checks.filter((c) => !c.passed).length === 1 ? "" : "s"} ${replay.tampered.checks.filter((c) => !c.passed).map((c) => `"${c.label}"`).join(", ")}; the mismatch names ${replay.tampered.substrateMismatches.map((m) => m.tileId).join(", ")}.`,
      ],
      tables: [
        {
          title: "Compiled tiles (identical in all three compiles)",
          columns: ["tile", "level", "coverage", "features", "bytes", "sha256"],
          rows: Object.entries(a.manifest.tiles).map(([id, entry]) => [id, entry.level, entry.coverage.status, Object.values(entry.features).reduce((s, n) => s + n, 0), entry.bytes, a.manifest.hashes.tiles[id]]),
        },
        {
          title: "Validation checks",
          columns: ["check", "severity", "passed", "failures", "detail"],
          rows: v.checks.map((c) => [c.label, c.severity, c.passed ? "yes" : "no", c.failures, c.detail]),
        },
        {
          title: "Frozen sources",
          columns: ["source", "provider", "dataset", "records", "retrieved", "sha256 (record set)"],
          rows: a.manifest.sources.map((s) => [s.sourceId, s.provider, s.datasetId ?? "—", s.recordCount, s.retrievedAt.slice(0, 10), s.contentHash]),
        },
      ],
    };
  },
};
