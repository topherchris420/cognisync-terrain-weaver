# Does a planning conclusion survive plausible uncertainty?

`interventions/I2-plan-robustness` · Internal consistency: do the instrument's own parts agree? Says nothing about nature.

## Question

For 20,000 m² of converted pavement on the example extent, do two conclusions survive bounded changes to classification, retention effectiveness, cost, rainfall, resolution and elevation source: (A) either option reduces routed runoff by at least 2%; (B) street trees avoid more runoff per installed dollar than bioswales?

## Hypothesis

Both conclusions hold under every tested perturbation.

## Result

**NOT SUPPORTED.** Conclusion A (≥ 2% reduction) holds in 11 of 13 cases; it fails under: retention effectiveness −50%; pessimistic combination (veg −5, effectiveness −50%, costs +20%). Conclusion B (trees avoid more runoff per dollar) holds in 13 of 13.

- Runoff volume does not depend on terrain in this model; resolution and elevation source change only where water goes and how much ponds. Their small effect on reduction comes from how the drawing meets the grid.
- The cost-effectiveness ranking rests entirely on two unsourced unit costs and one unsourced bioswale retention value. It is conditional on the registry, not a finding about the world.
- Effectiveness was reduced for both options together, so it cannot flip their ranking; a result that depends on the bioswale value alone would need a separate test.

**20,000 m² converted from pavement: routed results**

| perturbation | trees reduction % | bioswales reduction % | trees m³ per $1k | bioswales m³ per $1k | A holds | B holds |
|---|---|---|---|---|---|---|
| baseline | 2.11 | 2.37 | 0.756 | 0.587 | yes | yes |
| vegetation −5 pp, pavement +5 pp | 2.02 | 2.32 | 0.756 | 0.6 | yes | yes |
| vegetation +5 pp, pavement −5 pp | 2.21 | 2.37 | 0.756 | 0.561 | yes | yes |
| retention effectiveness −50% | 1.06 | 1.21 | 0.378 | 0.3 | NO | yes |
| all unit costs +20% | 2.11 | 2.37 | 0.63 | 0.489 | yes | yes |
| tree cost +20% only | 2.11 | 2.37 | 0.63 | 0.587 | yes | yes |
| bioswale cost −20% only | 2.11 | 2.37 | 0.756 | 0.733 | yes | yes |
| rainfall 100 mm | 2.11 | 2.37 | 1.511 | 1.173 | yes | yes |
| rainfall 200 mm | 2.11 | 2.37 | 3.022 | 2.346 | yes | yes |
| low resolution (36) | 2.11 | 2.38 | 0.756 | 0.589 | yes | yes |
| high resolution (120) | 2.11 | 2.37 | 0.756 | 0.587 | yes | yes |
| USGS 3DEP elevation | 2.11 | 2.37 | 0.756 | 0.587 | yes | yes |
| pessimistic combination (veg −5, effectiveness −50%, costs +20%) | 1.01 | 1.16 | 0.315 | 0.25 | NO | yes |

## Headline findings (machine-readable)

| finding | value |
|---|---|
| cases | 13 |
| conclusionAHolds | 11 |
| conclusionBHolds | 13 |
| baselineTreesReductionPercent | 2.11 |
| baselineSwalesReductionPercent | 2.37 |
| baselineTreesM3PerThousandUSD | 0.756 |
| baselineSwalesM3PerThousandUSD | 0.587 |
| terrainSpreadPercentPoints | 0.011 |

## Calibration / validation boundary

None: bounded sensitivity analysis. No probability distribution is implied.

## Conditions

- extent: lower-manhattan-example
- baseline: 50 mm, medium resolution, Terrarium, registered coefficients and costs
- combination: one perturbation at a time, plus one explicitly labelled pessimistic combination

## Limitations

- Perturbation sizes are chosen to be plausible, not estimated: ±5 pp cover (compare classification/C1 and C2), −50% effectiveness, +20% cost, 2× and 4× rainfall.
- Perturbations are applied one at a time; their joint distribution is unknown, so no combined probability is reported.
- The volume conclusion is a land-budget result: in this model terrain decides where water goes, not how much runs off.

## Reproduce

```bash
npm run experiment -- interventions/I2-plan-robustness
```

Inputs are frozen fixtures; no network access is needed. Result hash `fnv1a64:fe32e1feadcef120`. CI re-runs this experiment and fails if the committed result no longer matches the code.

| input | evidence | source | retrieved | content hash |
|---|---|---|---|---|
| dem/lower-manhattan-example.json | measured | Mapzen Terrarium tiles (AWS Terrain Tiles) and USGS 3DEP Bare Earth dynamic ImageServer | 2026-09-29 | `fnv1a64:d08e7b3ff8c9a0b8` |

| model component | version |
|---|---|
| score | `urban-absorption:fnv1a64:489acc5fd4bfe2ea` |
| bulkBudget | `land-budget-v1` |
| routing | `mannahatta-d8-local-v2` |
| assumptions | `2026-09-29.1` |

Run at 2026-09-29T11:56:55.152Z from commit `6b9473e` with uncommitted changes (the commit that adds this report contains them) on Node v22.22.2.
