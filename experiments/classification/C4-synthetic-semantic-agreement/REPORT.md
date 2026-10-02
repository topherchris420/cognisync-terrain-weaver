# Synthetic diagnostic benchmark: does the classifier recover known composition?

`classification/C4-synthetic-semantic-agreement` · Synthetic diagnostic benchmark: agreement with known ground truth in rendered scenes. Says nothing about accuracy on real imagery.

## Question

When RGB scenes have known semantic composition, how closely does the AI classifier recover vegetation, pavement, buildings, bare soil and water?

## Hypothesis

None. This is a descriptive measurement.

## Result

**INCONCLUSIVE.** Not run: 0 synthetic scenes and 0 classifier predictions are frozen, so the synthetic diagnostic benchmark has nothing to score. No agreement is claimed.

- The scene contract, BoundlessNYC adapter, metrics and fail-safe classifier mode exist and are unit-tested; the frozen inputs are deliberately empty until scenes are rendered and ingested.
- When scenes exist, the tripwire compares pervious-share error with the 6.68 pp the classifier disagrees with NLCD on real frames (C1). A tripped wire calls for investigating the classifier; it never changes a real-world claim by itself.
- Synthetic agreement does not establish classifier accuracy on real imagery (synthetic-to-real domain shift).

## Headline findings (machine-readable)

| finding | value |
|---|---|
| frozenScenes | 0 |
| scoredScenes | 0 |
| excludedScenes | 0 |
| predictions | 0 |
| totalCompositionErrorPP | — |
| perviousShareMaePP | — |
| perviousShareBiasPP | — |
| vegetationMaePP | — |
| pavementMaePP | — |
| buildingsMaePP | — |
| bareSoilMaePP | — |
| waterMaePP | — |
| repeatSdPP | — |
| maxRepeatRangePP | — |

## Calibration / validation boundary

None yet. The tripwire threshold is derived from measured real-world disagreement (C1), never from synthetic results. Any synthetic-specific threshold must be added to PREREGISTRATION before predictions are read.

## Conditions

- label: synthetic diagnostic benchmark
- view: nadir scenes only
- classifierInput: RGB image only (no location, name or metadata)
- tripwireThresholdPP: 6.68
- tripwireThresholdSource: classification/C1-nlcd-agreement perviousMaePP (measured on real frames), not chosen

## Limitations

- Synthetic agreement does not establish classifier accuracy on real imagery (synthetic-to-real domain shift).
- Rendered scenes differ from satellite imagery in texture, lighting, shadow, atmosphere and sensor; only nadir renders are scored because the classifier is built for overhead imagery.
- Ground truth is the share of mapped pixels: sky, vehicles, people, signals and signage are excluded and their share reported; mapping terrain, park footpaths and bridge decks is a documented judgement whose share is reported.
- The classifier returns class shares, not pixel labels, so the transfer table is an estimated trend, not a confusion matrix.
- BoundlessNYC scenes with MetaHuman-derived pedestrians are refused for licence reasons (no testing of AI on them), which may bias scene selection.

## Reproduce

```bash
npm run experiment -- classification/C4-synthetic-semantic-agreement
```

Inputs are frozen fixtures; no network access is needed. Result hash `fnv1a64:6cfb7fdef4937b97`. CI re-runs this experiment and fails if the committed result no longer matches the code.

| input | evidence | source | retrieved | content hash |
|---|---|---|---|---|
| synthetic/predictions.json | synthetic | Classifier predictions on synthetic scenes (empty: none requested yet) | 2026-10-02 | `fnv1a64:efbce2f8dc027cec` |
| synthetic/scenes.json | synthetic | Synthetic scene set (empty: no scenes ingested yet) | 2026-10-02 | `fnv1a64:3ee840962761b5df` |

| model component | version |
|---|---|
| score | `urban-absorption:fnv1a64:489acc5fd4bfe2ea` |
| bulkBudget | `land-budget-v1` |
| routing | `mannahatta-d8-local-v2` |
| assumptions | `2026-10-02.1` |
| substrateCompiler | `mannahatta-urban-substrate-compiler@1.0.0 (mannahatta-substrate/1)` |

Run at 2026-10-02T21:36:27.831Z from commit `405e0b1` with uncommitted changes (the commit that adds this report contains them) on Node v22.22.0.
