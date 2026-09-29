# Fixed coefficients against the NRCS curve-number method

`hydrology/H2-curve-number-benchmark` · Reference model: comparison with an independent published model, not with observations.

## Question

Across rainfall depths of 10–200 mm, does the fixed-coefficient runoff fraction for each surface fall inside the envelope an independent empirical method gives across soil groups A–D?

## Hypothesis

For every class and depth, the fixed runoff coefficient lies within the TR-55 curve-number envelope (soil groups A–D).

## Result

**NOT SUPPORTED.** The fixed coefficients leave the curve-number envelope for vegetation (40% of depths), soil (60% of depths), buildings (100% of depths), pavement (40% of depths). The linear model cannot reproduce the reference's depth dependence: it over-predicts pervious runoff in small storms and cannot show pervious surfaces saturating in large ones.

- vegetation: fixed runoff fraction 0.2; outside the curve-number envelope at 2 of 5 depths; largest excursion +0.2 (model sheds more than the reference).
- soil: fixed runoff fraction 0.3; outside the curve-number envelope at 3 of 5 depths; largest excursion -0.355 (model sheds less than the reference).
- buildings: fixed runoff fraction 0.9; outside the curve-number envelope at 5 of 5 depths; largest excursion +0.332 (model sheds more than the reference).
- pavement: fixed runoff fraction 0.88; outside the curve-number envelope at 2 of 5 depths; largest excursion +0.312 (model sheds more than the reference).
- Example composition: the model sheds 73% of 10 mm and 73% of 200 mm; the soil-group-B reference sheds 43% and 85%. The fixed model has no depth dependence at all.
- Consequence: avoided-runoff estimates for interventions scale exactly linearly with depth in this model. Under the reference, the relative benefit of converting pavement to vegetation depends on storm depth and soil group, which the instrument cannot currently represent.

**Runoff fraction by surface and depth**

| class | depth mm | model | CN min (A–D) | CN max (A–D) | model is |
|---|---|---|---|---|---|
| vegetation | 10 | 0.2 | 0 | 0 | above |
| vegetation | 25 | 0.2 | 0 | 0.08 | above |
| vegetation | 50 | 0.2 | 0 | 0.276 | inside |
| vegetation | 100 | 0.2 | 0.01 | 0.505 | inside |
| vegetation | 200 | 0.2 | 0.14 | 0.699 | inside |
| soil | 10 | 0.3 | 0 | 0.199 | above |
| soil | 25 | 0.3 | 0.045 | 0.499 | inside |
| soil | 50 | 0.3 | 0.219 | 0.694 | inside |
| soil | 100 | 0.3 | 0.448 | 0.829 | below |
| soil | 200 | 0.3 | 0.655 | 0.909 | below |
| buildings | 10 | 0.9 | 0.568 | 0.568 | above |
| buildings | 25 | 0.9 | 0.788 | 0.788 | above |
| buildings | 50 | 0.9 | 0.886 | 0.886 | above |
| buildings | 100 | 0.9 | 0.94 | 0.94 | below |
| buildings | 200 | 0.9 | 0.97 | 0.97 | below |
| pavement | 10 | 0.88 | 0 | 0.568 | above |
| pavement | 25 | 0.88 | 0.128 | 0.788 | above |
| pavement | 50 | 0.88 | 0.342 | 0.886 | inside |
| pavement | 100 | 0.88 | 0.567 | 0.94 | inside |
| pavement | 200 | 0.88 | 0.744 | 0.97 | inside |

**Example composition: runoff ÷ rainfall on land**

| depth mm | model | CN soil group B | CN envelope |
|---|---|---|---|
| 10 | 0.73 | 0.433 | 0.432–0.439 |
| 25 | 0.73 | 0.607 | 0.602–0.633 |
| 50 | 0.73 | 0.695 | 0.682–0.754 |
| 100 | 0.73 | 0.778 | 0.733–0.848 |
| 200 | 0.73 | 0.852 | 0.789–0.912 |

## Headline findings (machine-readable)

| finding | value |
|---|---|
| vegetationShareOfDepthsOutsideEnvelope | 0.4 |
| soilShareOfDepthsOutsideEnvelope | 0.6 |
| pavementShareOfDepthsOutsideEnvelope | 0.4 |
| buildingsShareOfDepthsOutsideEnvelope | 1 |
| exampleCompositeMaeVsGroupB | 0.125 |
| buildingsMaxAbsDeviation | 0.332 |
| pavementMaxAbsDeviation | 0.312 |
| exampleComposite10mmModel | 0.73 |
| exampleComposite10mmGroupB | 0.433 |
| exampleComposite200mmModel | 0.73 |
| exampleComposite200mmGroupB | 0.852 |

## Calibration / validation boundary

None: comparison with a published model; no parameter was adjusted.

## Conditions

- depthsMm: 10,25,50,100,200
- initialAbstraction: 0.2S
- reference: USDA NRCS TR-55 (1986) Table 2-2a

## Limitations

- The curve-number method is itself an empirical model fitted to observed watershed data; it is a reference model, not an observation of any site here.
- Soil group, antecedent moisture and cover condition are unknown for scanned sites; the A–D envelope brackets them rather than identifying them.
- TR-55 does not separate roofs from pavement; both use CN 98.

## Reproduce

```bash
npm run experiment -- hydrology/H2-curve-number-benchmark
```

Inputs are frozen fixtures; no network access is needed. Result hash `fnv1a64:2e533cfb244ccc5e`. CI re-runs this experiment and fails if the committed result no longer matches the code.

| input | evidence | source | retrieved | content hash |
|---|---|---|---|---|
| (none: analytic or built-in inputs) | | | | |

| model component | version |
|---|---|
| score | `urban-absorption:fnv1a64:489acc5fd4bfe2ea` |
| bulkBudget | `land-budget-v1` |
| routing | `mannahatta-d8-local-v2` |
| assumptions | `2026-09-29.1` |

Run at 2026-09-29T11:56:55.152Z from commit `6b9473e` with uncommitted changes (the commit that adds this report contains them) on Node v22.22.2.
