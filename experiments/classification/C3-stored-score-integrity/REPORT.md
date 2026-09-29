# Stored scores versus deterministic recomputation

`classification/C3-stored-score-integrity` · Internal consistency: do the instrument's own parts agree? Says nothing about nature.

## Question

Does every stored score equal what the current deterministic scorer computes from the stored land cover?

## Hypothesis

Every stored score equals computeAbsorptionScore(stored land cover) within 0.05 points.

## Result

**NOT SUPPORTED.** 24 of 61 stored scores disagree with the current scorer by up to 15 points; 9 would change band. Stored scores cannot be trusted as current model output.

- All mismatched rows predate or coincide with the 2026-07-14 recalibration; the backfill migration in supabase/migrations evidently did not reach them in the live database.
- The calibration record reports recomputed scores (e.g. Bois de Boulogne 74.7), while the live feed still serves the stored ones (89.7). A reader comparing the two would see different numbers for the same scan.
- Consequence for the product: displays and exports must derive the score from land cover with current code rather than trusting the stored column.

**Mismatched rows**

| created | label | stored | recomputed | difference |
|---|---|---|---|---|
| 2026-07-13 | nyc | 13 | 16.8 | -3.8 |
| 2026-07-14 | Manhattan, NY | 27.3 | 20 | 7.3 |
| 2026-07-14 | Jakarta, ID | 27.3 | 26.6 | 0.7 |
| 2026-07-14 | Copenhagen, DK | 34 | 31.1 | 2.9 |
| 2026-07-14 | Lagos, NG | 25.3 | 22.4 | 2.9 |
| 2026-07-14 | Phoenix, AZ | 35.3 | 33.2 | 2.1 |
| 2026-07-14 | Central Park, NYC | 46.8 | 41 | 5.8 |
| 2026-07-14 | Tiergarten, Berlin | 59.4 | 50.8 | 8.6 |
| 2026-07-14 | Bois de Boulogne, Paris | 89.7 | 74.7 | 15 |
| 2026-07-14 | Bishan Park, Singapore | 46.7 | 41.3 | 5.4 |
| 2026-07-14 | Ørestad, Copenhagen | 56.2 | 48.3 | 7.9 |
| 2026-07-14 | Portland, OR | 56.3 | 48.3 | 8 |
| 2026-07-14 | Kreuzberg, Berlin | 36.5 | 33.6 | 2.9 |
| 2026-07-14 | Eixample, Barcelona | 9.8 | 14.2 | -4.4 |
| 2026-07-14 | Amsterdam Zuid, NL | 35 | 32.3 | 2.7 |
| 2026-07-14 | Midtown Manhattan, NY | 9.5 | 14 | -4.5 |
| 2026-07-14 | Shinjuku, Tokyo | 23.4 | 24 | -0.6 |
| 2026-07-14 | Central, Hong Kong | 44.8 | 38.4 | 6.4 |
| 2026-07-14 | Dharavi, Mumbai | 37.5 | 34.4 | 3.1 |
| 2026-07-14 | Jakarta Pusat, ID | 37.5 | 34.5 | 3 |
| 2026-07-14 | Gilbert, AZ | 50.3 | 44 | 6.3 |
| 2026-07-14 | Katy, TX | 60.9 | 51.8 | 9.1 |
| 2026-07-14 | Sky Harbor, Phoenix | 15.1 | 19.1 | -4 |
| 2026-07-14 | Port of Rotterdam, NL | 45.8 | 38.6 | 7.2 |

## Headline findings (machine-readable)

| finding | value |
|---|---|
| rows | 61 |
| mismatched | 24 |
| maxAbsDifference | 15 |
| bandChanges | 9 |
| mismatchedMeanSigned | 3.75 |

## Calibration / validation boundary

None: an audit of every row.

## Conditions

- tolerancePoints: 0.05

## Limitations

- Checks storage against code, not either against nature.

## Reproduce

```bash
npm run experiment -- classification/C3-stored-score-integrity
```

Inputs are frozen fixtures; no network access is needed. Result hash `fnv1a64:d7664c1915c9c0d5`. CI re-runs this experiment and fails if the committed result no longer matches the code.

| input | evidence | source | retrieved | content hash |
|---|---|---|---|---|
| scan-feed.json | inferred | Mannahatta public scan feed (Supabase `analyses`, public read policy) | 2026-09-29 | `fnv1a64:e75d28ee477bca6c` |

| model component | version |
|---|---|
| score | `urban-absorption:fnv1a64:489acc5fd4bfe2ea` |
| bulkBudget | `land-budget-v1` |
| routing | `mannahatta-d8-local-v2` |
| assumptions | `2026-09-29.2` |

Run at 2026-09-29T12:00:15.401Z from commit `dc9ee66` with uncommitted changes (the commit that adds this report contains them) on Node v22.22.2.
