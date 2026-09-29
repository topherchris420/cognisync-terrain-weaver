# Classifier agreement with NLCD 2021

`classification/C1-nlcd-agreement` · Reference dataset: comparison with an independent map or remote-sensing product, which has its own error.

## Question

How far are stored classifier shares of water, impervious and pervious land from an independent 30 m national land-cover reference over the same frame?

## Hypothesis

None. This is a descriptive measurement.

## Result

**DESCRIPTIVE (no hypothesis tested).** Across 16 distinct US frames, the classifier's pervious share differs from NLCD by 6.7 pp on average (bias 3.1 pp) and its impervious share by 8.9 pp (bias -5.4 pp). 3 of 16 classified scores fall inside the reference score interval.

- Largest pervious residual: Portland, OR, classified 54% versus NLCD 34.9%.
- Systematic pattern: the classifier reports more pervious land (vegetation + soil) than NLCD, which would make scores and retention look better than the reference implies.
- Water: classifier bias 2.2 pp. Impervious: bias -5.4 pp. A negative impervious bias means the classifier reports less building-plus-pavement than NLCD.
- Classified scores sit on average 3.3 points above the midpoint of the reference score interval.
- NLCD imperviousness is itself modelled from 30 m Landsat imagery; residuals of a few points may lie within the reference's own error.

**Per frame: classified mean vs NLCD reference (% of frame)**

| frame | runs | water cls | water ref | imperv cls | imperv ref | perv cls | perv ref | score | ref score interval |
|---|---|---|---|---|---|---|---|---|---|
| nyc | 1 | 0 | 0 | 90 | 87.7 | 10 | 12.3 | 16.8 | 17.4–20.3 |
| Manhattan, NY | 1 | 30 | 15.5 | 60 | 73.2 | 10 | 11.3 | 20 | 18–21.1 |
| Phoenix, AZ | 1 | 0 | 0 | 65 | 76.2 | 35 | 23.8 | 33.2 | 24.3–28.2 |
| Central Park, NYC | 1 | 10 | 7.6 | 50 | 54.7 | 40 | 37.8 | 41 | 34.5–39.8 |
| Portland, OR | 1 | 0 | 0 | 46 | 65.1 | 54 | 34.9 | 48.3 | 31–35.7 |
| Midtown Manhattan, NY | 1 | 0 | 0 | 95 | 88.6 | 5 | 11.4 | 14 | 16.9–19.8 |
| Gilbert, AZ | 1 | 2 | 0 | 50 | 48 | 48 | 52 | 44 | 41.2–47.3 |
| Katy, TX | 1 | 1 | 0.1 | 40 | 51.1 | 59 | 48.8 | 51.8 | 39.3–45.2 |
| Sky Harbor, Phoenix | 1 | 0 | 0 | 87.5 | 82.6 | 12.5 | 17.4 | 19.1 | 20.4–23.8 |
| (untitled 40.758, -73.985) | 24 | 23.4 | 31 | 62.6 | 59.3 | 13.9 | 9.7 | 22.8 | 18.4–21.5 |
| (untitled 40.758, -73.985) | 5 | 20 | 17.2 | 65 | 71 | 15 | 11.8 | 23.4 | 18.5–21.7 |
| (untitled 40.758, -73.985) | 2 | 0 | 0 | 77.5 | 89.6 | 22.5 | 10.4 | 25.7 | 16.2–19.1 |
| (untitled 40.758, -73.985) | 1 | 10 | 1.1 | 65 | 85.1 | 25 | 13.8 | 29.7 | 18.4–21.5 |
| (untitled 40.758, -73.985) | 2 | 11 | 2.9 | 77.5 | 85.7 | 11.5 | 11.5 | 19.4 | 17.1–20 |
| Washington, District of Columbia, United States | 1 | 12.5 | 8.9 | 55 | 63.5 | 32.5 | 27.6 | 36.3 | 28.2–32.6 |
| Arlington County, Virginia, United States | 1 | 0 | 0 | 60 | 50.5 | 40 | 49.5 | 38 | 39.7–45.7 |

## Headline findings (machine-readable)

| finding | value |
|---|---|
| frames | 16 |
| classifications | 45 |
| perviousBiasPP | 3.13 |
| perviousMaePP | 6.68 |
| imperviousBiasPP | -5.36 |
| imperviousMaePP | 8.91 |
| waterBiasPP | 2.23 |
| waterMaePP | 3.17 |
| scoresInsideReferenceInterval | 3 |
| scoreBiasVsReferenceMidpoint | 3.25 |
| largestPerviousResidualPP | 19.1 |

## Calibration / validation boundary

None: too few distinct frames for a calibration/holdout split. Descriptive only; nothing was tuned.

## Conditions

- reference: NLCD 2021 land cover + percent impervious
- cellCentreInFrame: true

## Limitations

- NLCD is a model-derived product with its own error, especially for fine urban pervious cover; this measures disagreement with a reference, not error against truth.
- Epochs differ: NLCD 2021 versus scans in 2026.
- Buildings and pavement are not separable in NLCD, so building/pavement confusion cannot be measured here.
- Repeated classifications of one frame are averaged to one row per distinct frame so a single frame cannot dominate.
- Rows labelled `probe` are excluded as manual test inserts (PREREGISTRATION.md, Addendum 1).

## Reproduce

```bash
npm run experiment -- classification/C1-nlcd-agreement
```

Inputs are frozen fixtures; no network access is needed. Result hash `fnv1a64:0d7086ab3b58414b`. CI re-runs this experiment and fails if the committed result no longer matches the code.

| input | evidence | source | retrieved | content hash |
|---|---|---|---|---|
| nlcd-2021.json | reference | USGS National Land Cover Database 2021: land cover and percent developed imperviousness (CONUS) | 2026-09-29 | `fnv1a64:cde64ea4e37e0145` |
| scan-feed.json | inferred | Mannahatta public scan feed (Supabase `analyses`, public read policy) | 2026-09-29 | `fnv1a64:e75d28ee477bca6c` |

| model component | version |
|---|---|
| score | `urban-absorption:fnv1a64:489acc5fd4bfe2ea` |
| bulkBudget | `land-budget-v1` |
| routing | `mannahatta-d8-local-v2` |
| assumptions | `2026-09-29.1` |

Run at 2026-09-29T11:56:55.152Z from commit `6b9473e` with uncommitted changes (the commit that adds this report contains them) on Node v22.22.2.
