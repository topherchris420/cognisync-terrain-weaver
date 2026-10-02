# Urban substrate

The urban substrate is the city state beneath a Mannahatta study: building
footprints, street centrelines and their graph, shoreline and open water,
street trees, park properties, reference land cover and ground elevation,
compiled from public records into versioned, deterministic, hashed tiles.

It is infrastructure under the existing instrument, not a replacement for
any of it. MapLibre stays the display, D8 fill-and-spill stays the routing,
and the AI classification stays the classification. What changes is that a
study now records *which* city state it was made with, that state can be
inspected and challenged, and replay refuses to proceed on any other.

```
public records (NYC Open Data, USGS, Terrarium)
  → frozen source fixtures     experiments/data/substrate/<region>/   npm run substrate:fetch (opt-in, live)
  → normalisation              src/lib/urban-substrate/layers/
  → compiler                   src/lib/urban-substrate/compiler.ts    npm run substrate:compile
  → versioned tiles + manifest public/substrate/<label>/              npm run substrate:check (in npm run validate)
  → study extent               near/far loader, every tile verified against its hash
  → hydrology · interventions · AI analysis   (substrate identity is a controlled variable)
  → experiment evidence        export v3 carries identity, tile hashes, sources, diagnostics
  → replay                     npm run replay reconstructs every recorded tile or fails
```

## What was borrowed from BoundlessNYC, and what was not

[BoundlessNYC](https://github.com/mkturkcan/boundless-nyc) (M. K. Turkcan;
code MIT, compiled city ODbL 1.0) is a real-time digital twin of New York
compiled from municipal records. Its architecture informed this work; **no
BoundlessNYC code or data is included in Mannahatta.** Concepts reimplemented
here in TypeScript:

| BoundlessNYC idea | Mannahatta form |
|---|---|
| Offline compiler from public records to binary tiles (`tools/pipeline/fetch.mjs`, `compile.mjs`) | `fetch-substrate-sources.ts` freezes records with provenance; `compileSubstrate` is a pure function to canonical JSON tiles |
| Local metric frame and `floor(x / TILE)` tile keys, 512 m near tiles, 2,048 m far tiles (`src/shared/geo.js`) | `nyc-local-equirectangular-v1` grid, ids `nyc/512/ix/iy` and `nyc/2048/ix/iy`, all in `config.ts` |
| Near/far streaming by radius with a manifest index (`src/world/streamer.js`) | `loadSubstrateView`: local tiles for the extent + buffer, context tiles farther out, manifest-verified |
| Union-find clustering of near-miss CSCL endpoints so the street graph connects | `buildStreetGraph`, with a 0.5 m tolerance (not 6 m), same-level only, every merge counted |
| Lane and sidewalk graphs from CSCL | street graph and a centreline-level pedestrian access graph |
| Seeded `mulberry32` / spatial hashes for reproducible procedural detail | no randomness in authoritative content (`randomness: "none"` in the manifest); seeded permutation only to *test* order independence |
| `DATA_SOURCES.md`: every dataset, field by field | `SourceRecord` per source in every manifest, `AttributeSpec` per attribute |
| Geometry invariant tests over compiled tiles (`tools/tests/geometry.mjs`) | `validation.ts`, run at every compile and recorded in the manifest |
| Semantic, instance and depth sensors as perception ground truth | the synthetic perception benchmark contract and a BoundlessNYC adapter (below) |

Deliberately **not** borrowed: default values for missing attributes
(BoundlessNYC assumes 30 ft widths, 10 ft ground elevations and hashed
heights so that every building renders; the substrate stores `null` and
counts it); OpenStreetMap gap-filling (it would make the compiled substrate
an ODbL database); Three.js, procedural facades, traffic and pedestrian
simulation; and the photoreal pedestrian assets.

Please cite BoundlessNYC itself when using it (see its `CITATION.cff`).

## Grid and tiles

**Projection.** `x = (lon + 74.26)·84515.477`, `y = (lat − 40.49)·111048.086`
metres, WGS84 metres per degree at 40.7° written as literals. Tile
assignment uses only correctly rounded IEEE-754 operations (no `Math.pow`,
`**`, trigonometry or locale-dependent sorting anywhere in authoritative
paths), so every engine assigns the same tiles. Within NYC the east–west
scale differs from true by at most 0.33%; planar lengths and areas carry
that bound. Stored geometry is EPSG:4326 rounded to 1e-7° (about 1 cm).

**Levels** (`config.ts`, the only place a tile size is defined):

| level | size | content |
|---|---|---|
| local | 512 m | every compiled layer, full geometry and attributes, graphs |
| context | 2,048 m (4 × 4 local) | Douglas–Peucker simplified footprints (2 m) and physical centrelines (4 m), height, width and class; 64 m elevation; 32 m water mask; counts |

512 m: a Mannahatta study (about 1 km, routed on 36–120 cells) touches 4–9
local tiles; one dense Manhattan tile holds a few hundred footprints; 256 m
would quadruple requests without adding fidelity; 1,024 m would load up to
four times the needed area; and 512 m aligns one to one with BoundlessNYC's
near tiles for a future adapter.

**Ownership and references.** Each feature is owned by exactly one tile: a
footprint by its area-weighted centroid, a street segment by its length
midpoint, a point by its position. Every other local tile the feature
touches lists `[featureId, ownerTileId, boundsM]` in `refs` (the feature's
bounds in grid metres, rounded outward), and graph edges list the
`externalNodes` they reference. The loader fetches the owner of every
referenced feature whose bounds touch the extent plus its buffer (the
*closure*), so a study always has every feature that touches it, no feature
is ever stored twice, and features that merely cross the far side of a
buffer tile pull in nothing.

**Files.** `public/substrate/<label>/manifest.json` and
`tiles/<size>/<ix>/<iy>.json`, each tile canonical JSON (sorted keys, fixed
rounding). The Lower Manhattan substrate is 25 local + 4 context tiles,
6.6 MB raw and about 1.2 MB gzipped. The app's example extent loads 17 of
them (12 local, 1 closure, 4 context; 4.0 MB uncompressed, about 0.5 s in a
headless browser). Before closure used reference bounds it loaded 22 local
tiles (5.8 MB) for the same features.

## Manifest and provenance

Every compile writes a manifest with: schema and substrate version; bounds
and CRS; the grid; per-level tile sizes; one `SourceRecord` per dataset
(provider, dataset id, the provider's own last-update stamp, the exact
query, retrieval time, licence, evidence status, CRS, record count, method,
caveats and a SHA-256 of the record set); the compiler name, version, config
and config hash; per-layer evidence status, attribute specs, ordered
transformations, counts, missing-value counts and caveats; every tile's
path, bytes, coverage and feature counts; the validation summary; and
SHA-256 hashes of every tile and of the manifest.

`generatedAt` and `compiler.commit` are recorded but **non-authoritative**:
they are excluded from the manifest hash, so identical content compiled at
another time or checkout has the same identity. `npm run substrate:compile`
keeps the previous values when content is unchanged.

Frozen sources (Lower Manhattan, retrieved 2026-10-02):

| source | provider · dataset | records | evidence | used for |
|---|---|---:|---|---|
| Building Footprints | NYC OTI · `5zhs-2jue` | 2,780 | measured | footprints, roof height, ground elevation, year, feature type |
| MapPLUTO | NYC DCP · `64uk-42ks` | 2,444 | reported | lot land use and floors, joined by BBL |
| Street Centerline (CSCL) | NYC OTI · `inkn-q76z` | 1,776 | measured | centrelines, width, class, direction, lanes, grade levels |
| Planimetric Hydrography | NYC OTI · `pjs3-c3z5` | 8 | measured | inland water bodies |
| Borough Boundaries (shoreline) | NYC DCP · `gthc-hcne` | 2 | measured | land/water mask |
| Parks Properties | NYC Parks · `enfh-gkve` | 42 | reference | park property boundaries |
| 2015 Street Tree Census | NYC Parks · `uvpi-gqnh` | 2,857 | measured | tree points, DBH, status |
| NLCD 2021 | USGS / MRLC | 10,506 cells | reference | reference land cover per tile |
| Terrarium tiles | Mapzen / AWS Terrain Tiles | 25,600 cells | measured | 16 m ground elevation |

All records are queried with Socrata `intersects` against the coverage. Only
one transformation happens before freezing: borough rings are clipped to the
coverage plus 64 m (the full shoreline is 26,000+ vertices), and the full
boundary's hash is recorded.

## Layers and evidence status

Evidence statuses are the instrument's own (`src/lib/evidence/status.ts`),
with one addition, **reference**: an independent map product with its own
error, such as NLCD. Every layer and every attribute names its status.

| layer | status | holds | unknown values |
|---|---|---|---|
| buildings | measured (footprint), modeled (area), reported (lot) | footprint, area, plan roof area, roof height, ground elevation, year, feature type, PLUTO lot land use and floors | 5 heights, 4 ground elevations, 46 years, 16 lots: `null` |
| streets | measured (centreline), modeled (surface) | centreline, length, class, width, direction, lanes, grade levels, pedestrian exclusion, modelled surface | 495 widths, 347 lane counts: `null` (no surface without a width) |
| streetGraph | modeled | 1,118 nodes, 1,540 edges, node elevation, slope | 35 boundary nodes flagged |
| pedestrianGraph | modeled | edges usable on foot, exclusions with reasons | — |
| surfaceFlowGraph | modeled, **experimental** | see below | — |
| elevation | measured | 16 m (local) and 64 m (context) integer-centimetre grids | 98 artefact cells kept and counted |
| landCover | reference | NLCD class counts and water / impervious / pervious shares per tile | — |
| vegetation | measured (trees), reference (parks) | 2,857 trees, 42 park properties | 34 DBH, 112 species |
| water | modeled (mask), measured (bodies) | 8 m land/water/no-data mask, 8 inland water bodies | outside coverage is no-data, never water |

The substrate never writes into, adjusts or replaces the AI land-cover
classification; NLCD and the AI estimate stay separate evidence. Open water
is receiving water, never retention: validation fails any tile whose
reference shares count water as pervious land.

## Graphs

**Street graph.** Nodes are CSCL segment endpoints keyed by rounded position
and vertical level; endpoints within 0.5 m on the same level merge (none
needed to in this snapshot). A bridge deck never joins the street beneath
it. Nodes are intersections (degree ≥ 3), endpoints or continuations; nodes
whose topology the coverage edge truncates are flagged `boundary`. Edges
carry length, class, CSCL traffic direction (relative to the address range,
which is assumed to run first → last vertex), grade separation, and slope
from sampled ground elevation for at-grade edges.

**Pedestrian access.** The street-graph edges a pedestrian may use, at
centreline level, with a reason for every exclusion (not physical; highway,
ramp or tunnel; or a non-empty `nonped`, which the published dictionary
does not document and is treated conservatively). It is not sidewalk
geometry.

**Surface-flow structure (experimental).** At-grade street edges oriented
downhill (flatter than 0.002 left unoriented); 142 street-network sinks, 23
of them within 40 m of open water and linked to a receiver; 352 terrain low
points, 101 linked to a street node within 24 m. **This is not a sewer or
drainage-network model**: there are no pipes, inlets, capacities, volumes or
timing, and it predicts nothing. It exists so that a later, separately
validated experiment can compare raster D8 with urban-structure-aware
routing. D8 remains the authoritative routed path.

## Determinism

Given the same records, compiler version and configuration, the compiler
writes byte-identical tiles and the same manifest hash:

- every collection is sorted by a stable id with codepoint comparison;
- normalisers walk records in canonical order, so duplicate or conflicting
  records resolve the same way whatever order a provider returned them in;
- source content hashes are of record **sets**;
- numbers are rounded to fixed precision before they are stored or hashed;
- tile and manifest hashes are SHA-256 of canonical JSON (implemented in
  `sha256.ts`, checked against `node:crypto`);
- no clock, randomness or environment value enters content.

[S1](../experiments/substrate/S1-substrate-determinism/REPORT.md) tests this
on every `npm run validate`: three compiles (two clocks, one seeded record
permutation) are byte-identical, validation reports zero errors, a study
export replays, and moving one vertex by 1e-7° fails replay on that tile.
`npm run substrate:check` additionally proves the published files are
exactly what the frozen sources compile to.

## Validation

Run at every compile and recorded in the manifest. Errors (all zero):
tile identity, bounds, CRS and schema; tile hashes; finite coordinates;
closed rings and non-negative areas; each feature inside its owner tile
(building centroids, street midpoints, nodes, trees); unique ownership;
every reference resolves to the tile that owns the feature; provenance
complete for every layer, attribute and feature; elevation covers each
covered tile at the declared resolution; water never counted as pervious;
context features derived from local features. Warnings, reported not
hidden: 15 tiles with Terrarium seabed artefacts (98 cells) and one park
polygon whose edges, under 1 cm apart in the source, touch once rounded.

## Streaming and diagnostics

`useUrbanSubstrate` loads the substrate for the analysed extent: the index,
then the manifest (hash re-verified), then local tiles within 128 m of the
extent, their closure, and context tiles within 1,536 m. Every tile is
re-hashed on arrival; one mismatch makes the whole substrate unavailable
(`integrity-failed`) rather than partly used. Places outside any compiled
coverage get `outside-coverage`. An optional map layer draws local
footprints and centrelines, with faint context footprints beyond the loaded
local tiles; it is display only. Diagnostics: tile counts by level, bytes,
load time, features, vertices, a rough memory floor, and the browser heap
where the browser exposes it.

## Experiment integration

- Every routed run records `substrate_hash`: the substrate identity, or
  `substrate:unavailable:<reason>`, or `substrate:none` when none was
  consulted (tests, experiments, the edge function).
- `controlledComparison` requires it to be identical in NOW and POSSIBLE,
  alongside storm, rainfall, duration, extent, resolution, land cover,
  elevation and model. A pair across substrates is never a comparison.
- Experiment export **v3** carries the substrate state (version, manifest
  hash, tile ids and hashes), source summaries, layer statuses, coverage,
  compiler, diagnostics and an explicit statement of use. Export fails
  closed if the runs and the described substrate disagree.
- `npm run replay -- study.json` finds the substrate by manifest hash (or
  `--substrate <dir>`) and verifies schema, manifest hash, version and every
  recorded tile before re-routing. It never substitutes current data:

```
FAIL  Substrate tiles reconstruct          1 of 17 tiles differ or are missing

REPLAY FAILED

Substrate mismatch:
tile:     nyc/512/41/47
expected: sha256:3192c3ae9ecccb6bb7c1f9d6d9545376b09885df32478ab4c977ff23bf7e0ba7
actual:   sha256:a70f8bd6cdbe00da54af5825735480edc61b10558c6901212ddd7da97ca468e1
```

v2 exports still replay; their substrate check reads "not recorded".

## Synthetic perception benchmark (foundation)

`src/lib/perception/` defines a simulator-independent `SyntheticScene`
(RGB image source, known five-class composition, camera, lighting, weather,
scene class), a BoundlessNYC adapter, metrics, and a runner whose classifier
callback receives **only the RGB image source**. Metrics: per-class mean
absolute error, total composition error (half-L1), pervious-share error and
bias, an *estimated* composition transfer between classes (a trend, not a
confusion matrix: the classifier returns shares, not pixel labels), repeat
spread, and error by scene condition. Results carry the label **synthetic
diagnostic benchmark** and the caveat that synthetic agreement is not
real-world accuracy.

The BoundlessNYC adapter reads colourised semantic masks against its
Cityscapes-compatible class table, maps 35 classes to Mannahatta's five,
excludes sky, vehicles, people, signals and signage (reporting the excluded
share), reports the share of judgement mappings (terrain, park footpaths,
bridge decks), scores only nadir scenes, and **refuses scenes rendered with
MetaHuman-derived pedestrians**, whose licence forbids testing AI models on
them (render with `--pedestrians procedural`). Rendered scenes carry
"© OpenStreetMap contributors" and, where vehicles appear, the CARLA credit.

`analyze-terrain` gains `diagnostic_only`: the same classification prompt
and normalisation, no recommendations call, and nothing written to the
public scan feed. Benchmark requests omit `center_lat`, so a deployment that
predates this mode rejects them before calling the model or storing
anything; `npm run benchmark:synthetic -- classify` aborts if a response
ever looks persisted.

[C4](../experiments/classification/C4-synthetic-semantic-agreement/REPORT.md)
(C3 is taken by the stored-score audit) runs on frozen fixtures, which are
empty: it reports **inconclusive** with null findings. Its tripwire is
derived from measured performance, not chosen: pervious-share error above
the 6.68 pp the classifier already disagrees with NLCD on real frames (C1)
calls for investigating the classifier, and never changes a real-world claim
by itself.

## Found while building it

- **Socrata `within_box` drops edge-crossing features.** It returns only
  geometries entirely inside the box (106 footprints and 123 street segments
  missing here); the fetcher uses `intersects`, and the compiler counts what
  falls outside coverage.
- **`6hbv-tek4` is not water.** The app's spatial-data registry used
  "Hydrography Structures" (piers and jetties) as its water layer. It now
  points to the hydrography layer (`pjs3-c3z5`); the deployed
  `spatial-context` function picks this up on its next deploy.
- **Rounding can create touches.** One park polygon's edges, under 1 cm
  apart in the source, touch at 1e-7°; it is flagged, not repaired.

## Commands

```bash
NODE_USE_ENV_PROXY=1 npm run substrate:fetch -- --refresh   # live, opt-in: re-freeze sources (a visible diff)
npm run substrate:compile                                   # write public/substrate/<label>/
npm run substrate:check                                     # published files == fresh compile (in npm run validate)
npm run experiment -- substrate                             # S1
npm run replay -- study.json [--substrate <dir>]
npm run benchmark:synthetic -- ingest <export-dir>          # then: classify [--repeats N]; then npm run experiment -- C4
```

## Limitations

- One region (a 2.56 km square of Lower Manhattan and the Brooklyn
  waterfront), one snapshot. Elsewhere the substrate is `outside-coverage`.
- The substrate is reproducible, not validated: footprints, centrelines and
  the shoreline carry their own survey error, NLCD its own model error, and
  Terrarium its seabed artefacts. S1 tests determinism only.
- D8 routing does not read substrate geometry; the substrate is a recorded
  controlled variable and observed/reference context. No hydrology number
  changed.
- Context tiles near the coverage edge are partial and say so; there is no
  data beyond the coverage, and New Jersey is absent from NYC sources.
- Street surfaces are modelled from recorded widths, not the planimetric
  roadbed; the pedestrian graph is centreline-level.
- Hashes are content hashes, not signatures.
- Cross-engine determinism is argued from construction, tested in Node only.
- Tiles are JSON (6.6 MB raw, 1.2 MB gzipped): simple and inspectable, not
  compact.

## Future work

- Compile the planimetric roadbed, sidewalk and curb layers, and use the
  footprints as the eligibility layer for green roofs, which the workstation
  cannot offer today.
- A preregistered experiment comparing D8 with surface-flow routing on new
  storm events, before any routing use of the graph.
- A compiled substrate for every preregistered study area, so R-series
  experiments can carry substrate identity.
- Render nadir BoundlessNYC scenes with procedural pedestrians, freeze them,
  and run C4.
- A binary tile encoding, if transfer size starts to matter.
- Read-only MCP access to substrate manifests and tiles for agents.
