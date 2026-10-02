# Experiments

Mannahatta's empirical record. Every result here can be traced to its
question, frozen inputs, code commit and limitations, and re-run with one
command. Start with the [INDEX](INDEX.md); read the
[PREREGISTRATION](PREREGISTRATION.md) for what was declared before outcomes
were seen; [REVISIONS](REVISIONS.md) for what measurement changed; and
[TRIPWIRES](TRIPWIRES.md) for which assumptions the evidence now says to
reconsider.

## Run

```bash
npm run experiment                    # run everything, rewrite reports
npm run validate:routing              # one domain: classification | hydrology | routing | interventions | substrate
npm run experiment -- routing/R1      # one experiment (any unique id fragment)
npm run validate                      # CI: fail if any committed result or the published substrate no longer reproduces
npm run replay -- study.json          # verify (substrate tiles included) and re-run an exported NOW/POSSIBLE experiment
```

No network is needed: experiments read only `experiments/data/`.

## Layout

```
experiments/
  PREREGISTRATION.md        declared before outcomes; addenda dated, never edited
  INDEX.md  TRIPWIRES.md    generated
  REVISIONS.md              observation → diagnosis → change → validation → result
  revisions/                findings frozen before each revision
  data/                     DETERMINISTIC FIXTURES, each with provenance + content hash
  <domain>/<id>/
    experiment.json         question, hypothesis, tier, conditions, split, limitations,
                            input content hashes, model and assumption versions
    result.json             verdict, machine-readable findings, tables, result hash
    run.json                code commit, dirty flag, time, runtime
    REPORT.md               the readable report
```

Definitions live in `src/lib/validation/experiments/` and are pure
functions of the fixtures, so they are typechecked, linted and tested with
the app. The runner is `scripts/experiment.ts`.

## Evidence tiers

A result is never described with a stronger word than its tier allows.

| tier | compares the model with | example |
|---|---|---|
| synthetic-verification | analytic answers | R1 terrains |
| synthetic-diagnostic | known ground truth in rendered scenes; says nothing about real imagery | C4 (no scenes frozen yet) |
| internal-consistency | the instrument's own parts | H1, C3, I1–I3 |
| repeated-measurement | itself, under repetition or resampling | C2, R2, S1 |
| reference-model | an independent published model | H2 (NRCS curve numbers) |
| reference-dataset | an independent map product with its own error | C1 (NLCD), R3 (3DEP) |
| independent-observation | observations of outcomes it never used | R4, R5 (311 reports) |

Support *within the model* (I1–I3) is not evidence of a real-world outcome.

## Fixtures and live data

`experiments/data/` holds **deterministic fixtures**: frozen snapshots of
live sources, each with source, query, retrieval time, licence, method,
caveats and a content hash. CI never touches the network, so a changed
tile server cannot change a result.

**Live external data** is fetched only on purpose:

```bash
NODE_USE_ENV_PROXY=1 npm run data:fetch          # all groups (proxy variable only if you are behind one)
npm run data:fetch -- nlcd                       # feed | areas | nlcd | dem | 311 | rain
```

Existing fixtures are kept unless `--refresh` is passed, so re-fetching is a
visible diff, never a silent change. Substrate sources are fetched the same
way with `npm run substrate:fetch`, then compiled with `npm run
substrate:compile` (see [docs/urban-substrate.md](../docs/urban-substrate.md)).

| fixture | source | evidence |
|---|---|---|
| `scan-feed.json` | the app's public scan feed (stored classifier outputs) | inferred |
| `nlcd-2021.json` | USGS NLCD 2021 land cover and imperviousness, 30 m | reference |
| `dem/*.json` | Terrarium tiles via the app's own loader; USGS 3DEP | measured |
| `311/*.json` | NYC 311 street-flooding and catch-basin reports | reported |
| `rain-central-park.json` | NOAA GHCN daily, Central Park | measured |
| `areas.json` | named areas + seeded sample over NYC land | reference |
| `substrate/nyc-lower-manhattan/*.json` | NYC Open Data (footprints, PLUTO, CSCL, hydrography, shoreline, parks, trees), NLCD 2021, Terrarium, frozen for the urban substrate | measured / reported / reference |
| `synthetic/*.json` | rendered scenes with known composition and classifier predictions (empty until scenes are ingested) | synthetic |

## Calibration and validation

Calibration data may change the model; validation data may only judge it.
Where evidence volume allowed, a split was declared in advance (R4
development events vs the R5 holdout event). Where it did not (C1, C2), the
report says the result is descriptive. Nothing was tuned on a holdout.

## Adding an experiment

1. Write the question, hypothesis, tier, split and limitations first.
   If it compares with outcomes, add them to PREREGISTRATION before fetching.
2. Add a pure `Experiment` in `src/lib/validation/experiments/` and register
   it in `src/lib/validation/registry.ts`.
3. `npm run experiment -- <id>`, read the report, commit it with the code.
4. Keep the result whatever it says.
