# Mannahatta

**The land remembers. The city is not finished.**

A counterfactual urban resilience instrument: examine what a place was, model what happens when rain meets its present surfaces, and ask what would have to change.

**What was. What is. What could be.** The map is the workspace; the score is the beginning of the question.

![A worked, illustrative NOW/POSSIBLE counterfactual under identical rainfall](docs/images/bounded-counterfactual.svg)

This is a reproducible calculation, not a measured site outcome or a screenshot. A hypothetical 1,000 m² paved site under 50 mm rainfall generates 44 m³ of bulk runoff. Converting half to trees and half to bioswales produces 7.5 m³ under the same fixed-coefficient model, at an assumed installation cost of $55,000. The map-based workflow additionally routes water over terrain; these two calculations are deliberately separate.

## Start with a place

1. Open the map and choose **Explore an example**. The fixture works without an AI classification request; its status stays visible in exports.
2. In **Overview**, inspect the composition, historical reconstruction where available, and vegetation–pavement sensitivity. Live scans also expose the captured imagery.
3. In **Storm**, choose rainfall and resolution, then route a one-hour design event. Its forcing is sealed for the comparison.
4. In **Mitigation**, ask Catalyst what a target and budget permit. Then draw supported interventions on the actual study extent.
5. Rerun the sealed storm and compare **NOW / POSSIBLE** with the synchronized map view.
6. Export the study or its **experiment evidence JSON**, including inputs, drawings, coefficients, forcing and available routed results.

Live imagery, historical rasters and elevation require their external services. If elevation cannot load, a deterministic slope is explicitly **illustrative**. Example land cover never becomes a measurement merely because the terrain loaded successfully.

## Three questions, different evidence

| Frame | What it contains | What it does not establish |
|---|---|---|
| **1609 — what was** | Welikia ecological reconstruction reduced to block bounding boxes where coverage exists; a separately labeled island-wide reference score of 79.1 | Surveyed historical boundaries, a complete settlement history, or the history of an arbitrary block outside coverage |
| **Present — what is** | Captured imagery, inferred five-class land cover and deterministically derived score | A surveyed surface map, measured infiltration or validated flood probability |
| **Possible — what could be** | Interventions evaluated with the same coefficients and, for routed pairs, the same storm and terrain | A forecast, construction approval or prediction of political adoption |

Beneath all three sits a fourth question: **how do we know?** Overview lists every component — reconstruction, classification, score, coefficients, elevation, routing, interventions — with the kind of number it produces and how far it has been tested, generated from the committed [experiments](experiments/INDEX.md) rather than written by hand.

Mannahatta's historical frame concerns land inhabited and shaped by the Lenape. An ecology reconstruction is not an account of empty or untouched land. The written five-class benchmark is this application's estimate informed by the Mannahatta/Welikia descriptions, **not a five-class dataset published by WCS**. The reconstructed block index is a different source and must retain its own transformation notes.

## What would have to change?

Catalyst is available in Mitigation as an inspectable planning envelope. Enter a target score and installation budget to see:

- current and achievable scores;
- the unconstrained surface ceiling and budget-constrained ceiling;
- the remaining gap and binding constraint;
- a least-cost mix when the target is reachable, or the highest attainable score otherwise.

The solver uses the upper cost/retention envelope for each source surface. It can replace a cheaper intervention with a more effective one: trees and bioswales compete for the same pavement. A simple greedy list of whole intervention types cannot solve that problem correctly. A $0 budget means no spending.

Each recommended intervention opens into its assumption chain: source surface, eligibility, area, retention change and unit cost with their registry basis, modeled effect, cost and limitation. The panel also says whether the target still holds when land cover is off by the measured classification error; plans sized exactly to a target usually do not ([I3](experiments/interventions/I3-classification-uncertainty/REPORT.md)).

This is a **continuous aggregate allocation**, not parcel engineering. It assumes all classified source area is available. The spatial editor applies a separate eligibility contract; green roofs and permeable pavement remain unavailable in the current main workstation because their mapped eligibility layers are not loaded. Trees and bioswales carry explicit feasibility caveats. An aggregate proposal does not silently place polygons or become a routed result.

Installation assumptions are USD/m²: trees **45**, bioswales **65**, permeable pavement **150**, green roofs **180**. Source year, local geography and inflation basis are not documented. Maintenance, replacement, permitting and land acquisition are excluded. Annual retention and monetized benefit are scenario assumptions, not audited returns. Cost rankings are conditional on these rates.

## What if the classification is wrong?

The land-cover classifier is the largest measured uncertainty source. Its outputs are coarse: 82% of stored class values are multiples of 5. They are unstable: one frame classified 24 times received 15 different compositions, with water anywhere from 0 to 45% and pervious share spanning 29 percentage points ([C2](experiments/classification/C2-repeat-stability/REPORT.md)). Against the independent USGS NLCD 2021 map, pervious share differs by 6.7 points on average across 16 frames ([C1](experiments/classification/C1-nlcd-agreement/REPORT.md)).

Overview offers a bounded experiment: transfer percentage points between vegetation and pavement, preserving the other classes and total area, and see the pavement, score and 50 mm bulk-runoff range. The default range is **benchmark-derived (±7 pp)**; the repeat-run range (±15 pp) or a chosen what-if are alternatives. Transfers stop when a source class runs out. It leaves the stored analysis untouched.

This is **sensitivity analysis, not a statistical confidence interval**. It does not quantify every source of error, and NLCD has its own. The shared input contract rejects incomplete, negative, non-finite or materially unbalanced compositions before accepting classifier/MCP percentages. Scores are computed by code, not accepted from a model narrative.

## Two water models, explicit limits

### Bulk land budget

The score is a weighted screening index normalized over land:

`score = 100 × Σ(land-cover share × retention weight) / total land share`

| Class | Retention weight |
|---|---:|
| Vegetation | 0.80 |
| Bare soil | 0.70 |
| Buildings | 0.10 |
| Pavement | 0.12 |
| Open water | Excluded from the land denominator |

Scenario costs and water volumes use physical land area, excluding open water. The rainfall workbench compares 10, 25, 50, 100 and 200 mm, with a continuous 0–200 mm control and an accessible table. For every depth, retained volume + runoff = rain on land.

Fixed coefficients yield linear responses: this model **cannot identify saturation or a storm intensity at which an intervention stops working**. Its rainfall presets are exploratory depths, not sourced return periods.

### Terrain routing

The browser loads Terrarium elevation onto a finite grid and routes water with D8 over static **fill-and-spill** (routing v2): closed depressions hold up to their volume and spill the rest, and cells at or below 0 m are treated as receiving tidal water. The original D8 stranded a median 81% of routed water in single-cell pits and in Terrarium artefacts as deep as −14 km; the analytic pit and flat cases now pass ([R1](experiments/routing/R1-synthetic-terrains/REPORT.md), [R2](experiments/routing/R2-resolution-sensitivity/REPORT.md)). Intervention modifiers are weighted by the share of each cell a drawing covers, so credited area no longer depends on resolution. A synthetic slope is used and labeled if elevation is unavailable. NOW and POSSIBLE share rainfall, duration, resolution and elevation identity; edited futures invalidate the previous comparison. Surface identities include study bounds and classified cover.

**Routed zones did not locate reported flooding.** On a preregistered held-out storm (29 September 2023, 145 NYC street-flooding reports across 68 of 208 study areas), routed accumulation ranked reported locations no better than chance (AUC 0.50), while simply ranking low ground did better (0.62) ([R5](experiments/routing/R5-311-association-holdout/REPORT.md)). Flow directions also change with the elevation source for about two thirds of cells ([R3](experiments/routing/R3-dem-source-sensitivity/REPORT.md)). Read the map as where this model sends water, not where flooding is likely. The app says so beside every routed result.

The engine conserves rain across retained/infiltrated, stored and runoff terms; runoff is further split into water ponded in depressions and water leaving the extent. It constructs a volume-scaled triangular hydrograph. **The hydrograph shape is prescribed, not calibrated discharge.** Accumulation divided by cell area is an equivalent routing metric, not hydraulically solved standing-water depth. Display severity is relative within a run, so colored zones must not be read as official hazard categories.

No calibrated sewers, storm surge, antecedent moisture or surveyed soil profiles are present. Both water models now draw on one coefficient set: routing retains exactly what the land budget retains, and rain on open water counts as runoff to the receiving water, not retention ([H1](experiments/hydrology/H1-cross-model-consistency/REPORT.md)). Their totals differ only because routing covers the whole extent, water included.

Against the NRCS curve-number method, the fixed coefficients cannot reproduce how runoff grows with storm depth; bare soil and roofs trip their review wires ([H2](experiments/hydrology/H2-curve-number-benchmark/REPORT.md), [tripwires](experiments/TRIPWIRES.md)).

## AI proposes; deterministic code decides

AI classifies imagery and proposes explanatory recommendations. Code calculates scores, allocations, budgets, eligibility, routing and comparison identities.

MCP currently exposes scan read/write operations and deterministic land-cover scoring. Authenticated writes use the signed-in user's access rules. They validate complete percentage compositions and recompute scores; scan reads also return scores recomputed from land cover, with any stale stored value alongside. They do **not** yet provide a full storm-planning benchmark, a complete action audit trail, or an autonomous planning loop. User- or agent-supplied cover is not independent observational evidence.

The old `/tactical` operating-picture demonstration generated synthetic hazards around arbitrary coordinates. It is retired from public navigation; existing links now explain the limitation and return to the actual workstation. Its internal demo components remain in the repository for traceable future work.

## Urban substrate

Beneath every study sits a compiled, versioned city state: building footprints, street centrelines and their graph, shoreline and open water, street trees, park properties, NLCD reference land cover and ground elevation, compiled from NYC and federal open data into deterministic 512 m tiles (2,048 m simplified context tiles beyond).

```
public records → frozen source fixtures → normalised records → deterministic tiles + manifest → study extent → experiment → replay
```

- **Provenance.** Each source keeps its provider, dataset id and version stamp, exact query, retrieval time, licence and record-set SHA-256; every layer and attribute names its evidence status (measured, reported, reference, modeled). Unknown values stay `null` and are counted, never filled.
- **Determinism.** The same records compile to byte-identical tiles and the same manifest hash, whatever the clock or record order ([S1](experiments/substrate/S1-substrate-determinism/REPORT.md)); `npm run validate` also proves the published tiles are exactly what the frozen sources compile to.
- **Identity in every experiment.** Each routed run records the substrate it was made with; NOW and POSSIBLE must share it; exports carry the tile ids and hashes; replay reconstructs every tile or fails with the tile, the expected hash and the actual one.
- **Limits.** One 2.56 km square of Lower Manhattan for now (elsewhere: "outside coverage"). The substrate is reproducible, not validated. D8 routing does not read its geometry yet, and nothing in it changes the AI land cover. Its surface-flow graph is an experimental structure for a future D8 comparison, not a drainage model.

A synthetic perception benchmark foundation sends only RGB to the classifier and scores it against scenes with known composition, e.g. nadir renders from BoundlessNYC. It is labelled a **synthetic diagnostic benchmark**, never real-world accuracy; its experiment ([C4](experiments/classification/C4-synthetic-semantic-agreement/REPORT.md)) has no frozen scenes yet and reports inconclusive.

The compiler, tiling, near/far loading, junction clustering and source documentation follow ideas from [BoundlessNYC](https://github.com/mkturkcan/boundless-nyc) by Mehmet Kerem Turkcan (MIT code; ODbL compiled city), reimplemented here; no BoundlessNYC code or data is included. Details, tile format and limitations: [docs/urban-substrate.md](docs/urban-substrate.md).

## Evidence that travels

| Export | Included | Boundary |
|---|---|---|
| CSV / GeoJSON | Study identity, extent, cover, score, model label, example/provenance status and caveat | Geometry is the study boundary, not a flood extent |
| PDF | Analysis summary, explicit provenance labels on every page, optional aggregate scenario | Does not contain the routed storm pair |
| Experiment JSON (v3) | Question, every key value with its evidence status, model/assumption versions and code commit, cover, extent, drawings, registry, sealed storm, **elevation grid**, **urban substrate identity** (version, manifest hash, tile hashes, sources), routed outputs, the controlled-variable check, validation evidence, evidence hash | Does not embed imagery, so the classification itself cannot be replayed |

`npm run replay -- study.json` verifies the evidence hash, storm seal and elevation identity, reconstructs every recorded substrate tile from its hash, re-routes NOW and POSSIBLE and compares every volume; a tampered file or tile fails. A NOW/POSSIBLE pair is only exported as a comparison if storm, extent, resolution, land cover, terrain, model and urban substrate are identical and only the drawn surface differs. The evidence hash is not a cryptographic signature. The share action still reopens a **map view**; in-app import remains future work.

## Architecture

| Domain | Implementation |
|---|---|
| Map and study orchestration | `src/pages/Analyze.tsx`, MapLibre, `MapEditor` |
| Aggregate physics and planning | `src/lib/absorption.ts`, `scenario.ts`, `paired-storm.ts`, `catalyst.ts` |
| Sensitivity | `src/lib/land-cover-sensitivity.ts` |
| Spatial constraints and identity | `src/lib/counterfactual/` |
| Local terrain routing | `src/lib/hydrology/` |
| Historical reconstruction | `src/lib/historical/`, `public/data/welikia-1609-blocks.json` |
| Evidence and reports | `experiment-export.ts`, `experiment-replay.ts`, `geo.ts`, `pdf-export.ts` |
| Validation harness | `src/lib/validation/`, `experiments/`, `scripts/experiment.ts` |
| Evidence status, ledger, assumption registry | `src/lib/evidence/`, `src/lib/assumptions/registry.ts` |
| AI classification and persistence | Supabase `analyze-terrain`; shared `land-cover.ts` contract |
| Agent interfaces | `src/lib/mcp/`; generated Supabase MCP bundle |
| Urban substrate (compiler, tiles, graphs, loader, replay checks) | `src/lib/urban-substrate/`, `public/substrate/`, `scripts/substrate.ts`, `docs/urban-substrate.md` |
| Synthetic perception benchmark | `src/lib/perception/`, `scripts/synthetic-benchmark.ts` |

The local D8 engine is the main workstation path. The separate `run-simulation` edge function and Python reference backend still exist; they are not prerequisites for local storm experiments. Large map/application bundles remain a performance limitation.

## Run locally

Use **Node 22** and **npm**, matching CI. `package-lock.json` is canonical.

```bash
git clone https://github.com/topherchris420/cognisync-terrain-weaver.git
cd cognisync-terrain-weaver
npm ci
npm run dev -- --host 127.0.0.1
```

Open `http://127.0.0.1:43147`. Configure `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` and, for MCP, `VITE_SUPABASE_PROJECT_ID` for your Supabase project. Browser configuration must contain only public keys; classifier/service secrets belong in Supabase edge-function secrets. For live AI classification, set `GEMINI_API_KEY` to use Google's Gemini API directly; the default model is `gemini-3.8-flash` and can be overridden with `GEMINI_MODEL`. Existing deployments can continue using `LOVABLE_API_KEY` as a fallback through the Lovable gateway. The example skips the classifier request but the app still initializes its Supabase client. Deploying source changes to edge functions is a separate step from the frontend build.

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Tests cover coefficient synchronization, water balance, geometry constraints, paired identities, async staleness, cost allocation, classification contracts, sensitivity, provenance, exports and replay. Passing tests establishes implementation consistency, **not empirical flood validation**. That is what the experiments are for:

```bash
npm run validate        # re-run every experiment on frozen fixtures and recompile the substrate; fails if anything committed changed
npm run experiment      # re-run and rewrite reports
```

See [implementation evidence and remaining gaps](docs/counterfactual-instrument.md), [source ledger and validation protocol](docs/validation-protocol.md), [calibration](docs/absorption-calibration.md), and [prior delivery evidence](docs/elevation-delivery.md).

## How we test the model

Fifteen experiments compare the model with analytic answers, with itself, with independent reference data and with reported outcomes (one, the synthetic diagnostic C4, has no frozen scenes yet). They run on frozen fixtures in CI, and every report states its question, inputs, result and limitations. Full list: [experiments/INDEX.md](experiments/INDEX.md). One example, end to end:

| Step | Routed hotspots against reported street flooding |
|---|---|
| **Model question** | Do cells the routing engine ranks high in accumulation coincide with where people report street flooding, more than simply low ground does? |
| **Reference data** | NYC 311 "Street Flooding (SJ)" reports for three storms; USGS/Terrarium elevation; NLCD 2021 cover; NOAA Central Park rainfall. 208 study areas, 200 of them seeded random tiles |
| **Declared in advance** | Metric (AUC), baseline (low elevation), matching rule, development storms (Henri, Ida 2021) and a holdout storm (29 Sep 2023), all [preregistered](experiments/PREREGISTRATION.md) and committed before any location was read |
| **Result** | Holdout: routed accumulation AUC 0.50 [0.45, 0.56]; low elevation 0.62 [0.56, 0.69] |
| **Error** | −0.12 [−0.19, −0.06] against the baseline (95% cluster bootstrap over areas) |
| **What changed** | Along the way, other experiments exposed real routing defects (pits, flats, a water "sponge", layers labelled as depth), which were fixed and re-measured. None of it made hotspots predictive, and nothing was tuned on the holdout. The result is shown beside every routed map, and the tripwire `routing.hotspots_indicate_flooding` is tripped |

Other results, briefly:

| Component | Compared with | Found |
|---|---|---|
| Classification | NLCD 2021; 24 repeats of one frame | 6.7 pp mean pervious disagreement; 29 pp run-to-run spread |
| Stored scores | the current scorer | 24 of 61 live rows stale (up to 15 points); now recomputed on read |
| Two water models | each other | 24.8 pp disagreement → 0 after unifying coefficients |
| Coefficients | NRCS curve numbers | no depth dependence; soil and roof wires tripped |
| Interventions | the model's own uncertainty | a 1,500 m² bioswale cuts routed runoff 0.18%, not 8%; target-sized plans do not survive classification error |
| Urban substrate | itself, recompiled under two clocks and a shuffled record order | 29 tiles byte-identical, 0 validation errors; moving one vertex 1 cm fails replay on that tile |

Negative results stay in the record. [REVISIONS](experiments/REVISIONS.md) lists every change measurement caused and everything it did not fix.

## Scientific boundary

The score has **not been validated against observed flooding**. Routed accumulation was tested against reported street flooding on a held-out storm and **did not beat a low-elevation baseline**. Historical reconstruction is not direct measurement. Conceptual eligibility is not a site survey. Screening hydrology is not a flood forecast. These boundaries belong to the instrument, not its fine print.

*It is an argument about physics, not a forecast about politics.*

Built by [Vers3Dynamics](https://vers3dynamics.com). [MIT license](LICENSE).
