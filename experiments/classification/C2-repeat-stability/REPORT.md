# Classifier stability on an identical frame

`classification/C2-repeat-stability` · Repeated measurement: how stable is an output under repetition or resampling?

## Question

When the same bounding box is classified repeatedly, how much do the five class shares, the score and the 50 mm runoff vary?

## Hypothesis

None. This is a descriptive measurement.

## Result

**DESCRIPTIVE (no hypothesis tested).** The same frame received 15 distinct compositions in 24 classifications. Water ranged 0–45 pp and the score 16.7–35.2. Run-to-run variation is of the same order as the ±5 pp sensitivity default, and larger for water.

- Frame -74.026599,40.704480,-73.985401,40.721119 (6.42 km² of Lower Manhattan framed across the Hudson and East River), classified 24 times between 2026-08-08 and 2026-08-08.
- The most common composition occurred in 7 of 24 runs.
- 50 mm bulk runoff for this frame ranged from 136,520 to 225,178 m³ on classification alone (47% of the mean). Water is the largest source of spread because it changes the land area the budget applies to.
- 82% of all 300 class values in the feed are multiples of 5 pp, confirming the rounded-output concern in the calibration record: the classifier's effective resolution is about 5 pp.
- Stored centre coordinates for this frame (40.758, -73.985) lie in Midtown, outside the stored bounding box; the box, not the centre, is what was classified.

**Five-class shares across 24 classifications of one frame (percentage points)**

| class | mean | SD | min | max | range |
|---|---|---|---|---|---|
| vegetation | 9.6 | 6.2 | 5 | 35 | 30 |
| soil | 4.3 | 1.6 | 0 | 5 | 5 |
| buildings | 31.2 | 3.9 | 20 | 40 | 20 |
| pavement | 31.4 | 3.8 | 25 | 35 | 10 |
| water | 23.4 | 9.1 | 0 | 45 | 45 |

**Derived quantities per repeat**

| created (UTC date) | score | pervious % | water % | 50 mm runoff m³ |
|---|---|---|---|---|
| 2026-08-08T19:47 | 19.5 | 10 | 25 | 194020 |
| 2026-08-08T19:48 | 23.4 | 15 | 20 | 196911 |
| 2026-08-08T19:51 | 23.4 | 15 | 20 | 196911 |
| 2026-08-08T19:51 | 19.5 | 10 | 25 | 194020 |
| 2026-08-08T19:53 | 23.4 | 15 | 20 | 196911 |
| 2026-08-08T19:53 | 20.1 | 10 | 30 | 179564 |
| 2026-08-08T19:58 | 25 | 15 | 30 | 168643 |
| 2026-08-08T19:58 | 22.5 | 14 | 20 | 199127 |
| 2026-08-08T20:00 | 22.7 | 10 | 45 | 136520 |
| 2026-08-08T20:00 | 23.4 | 15 | 20 | 196911 |
| 2026-08-08T20:04 | 16.7 | 5.6 | 33.3 | 178453 |
| 2026-08-08T20:05 | 35.2 | 35 | 0 | 208153 |
| 2026-08-08T20:08 | 23.3 | 15 | 20 | 197232 |
| 2026-08-08T20:08 | 20.8 | 10 | 35 | 165431 |
| 2026-08-08T20:15 | 20.8 | 10 | 35 | 165431 |
| 2026-08-08T20:15 | 23.4 | 15 | 20 | 196911 |
| 2026-08-08T20:17 | 19.6 | 10 | 25 | 193698 |
| 2026-08-08T20:17 | 26.7 | 20 | 15 | 200123 |
| 2026-08-08T20:20 | 23 | 16 | 9 | 225178 |
| 2026-08-08T20:20 | 22.9 | 14.5 | 20 | 198163 |
| 2026-08-08T20:31 | 19.5 | 10 | 25 | 194020 |
| 2026-08-08T20:31 | 23.4 | 15 | 20 | 196911 |
| 2026-08-08T20:44 | 24.7 | 14.5 | 30 | 169253 |
| 2026-08-08T20:44 | 23.4 | 15 | 20 | 196911 |

## Headline findings (machine-readable)

| finding | value |
|---|---|
| repeats | 24 |
| distinctCompositions | 15 |
| modalShare | 0.292 |
| waterSdPP | 9.13 |
| waterRangePP | 45 |
| perviousSdPP | 5.47 |
| perviousRangePP | 29.4 |
| scoreSd | 3.46 |
| scoreMin | 16.7 |
| scoreMax | 35.2 |
| runoff50mmMinM3 | 136520 |
| runoff50mmMaxM3 | 225178 |
| runoffRelativeSpan | 0.468 |
| feedShareMultipleOf5 | 0.817 |
| feedValues | 300 |

## Calibration / validation boundary

None: descriptive. The repeats are the whole sample.

## Conditions

- minimumRepeats: 3
- frameIdentityToleranceDeg: 0.000001
- rainfallMm: 50

## Limitations

- Imagery bytes, imagery provider (Esri or the Sentinel-2 fallback) and classifier model version were not stored, so the repeats may not share identical inputs.
- One frame dominates the sample; stability may differ elsewhere.
- Stability is not accuracy: a classifier can be consistently wrong.

## Reproduce

```bash
npm run experiment -- classification/C2-repeat-stability
```

Inputs are frozen fixtures; no network access is needed. Result hash `fnv1a64:13f677e859d0defd`. CI re-runs this experiment and fails if the committed result no longer matches the code.

| input | evidence | source | retrieved | content hash |
|---|---|---|---|---|
| scan-feed.json | inferred | Mannahatta public scan feed (Supabase `analyses`, public read policy) | 2026-09-29 | `fnv1a64:e75d28ee477bca6c` |

| model component | version |
|---|---|
| score | `urban-absorption:fnv1a64:489acc5fd4bfe2ea` |
| bulkBudget | `land-budget-v1` |
| routing | `mannahatta-d8-local-v2` |
| assumptions | `2026-09-29.1` |

Run at 2026-09-29T11:56:55.152Z from commit `6b9473e` with uncommitted changes (the commit that adds this report contains them) on Node v22.22.2.
