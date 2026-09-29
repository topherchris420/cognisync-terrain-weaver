# Does the planning conclusion survive measured classification error?

`interventions/I3-classification-uncertainty` · Internal consistency: do the instrument's own parts agree? Says nothing about nature.

## Question

When the vegetation/pavement split is moved by the amount the classifier has actually been observed to err, do the score, the 50 mm runoff and a Catalyst plan's target-score conclusion change?

## Hypothesis

A Catalyst least-cost plan for +10 score points still reaches its target when the pervious share is off by the benchmark-derived error.

## Result

**NOT SUPPORTED.** 4 of 4 plan/error combinations become inconclusive: with the pervious share off by the measured amount, the same built plan no longer reliably reach its target score. A plan sized exactly to a target inherits the classifier's error.

- Measured error ranges: ±7 pp (NLCD mean absolute pervious error) and ±15 pp (half the repeat-run pervious range).
- example (illustrative), ±7 pp: pavement 22–36%, score 21.6–32.4, NOW 50 mm runoff 25,079–29,094 m³; plan targets 37 and achieves 31.6–42.4 → Inconclusive within the tested uncertainty.
- example (illustrative), ±15 pp: pavement 14–44%, score 15.4–38.6, NOW 50 mm runoff 22,784–31,389 m³; plan targets 37 and achieves 25.4–48.6 → Inconclusive within the tested uncertainty.
- Lower Manhattan frame, mean of 24 classifications, ±7 pp: pavement 24.4–38.4%, score 16.8–29.2, NOW 50 mm runoff 22,860–26,875 m³; plan targets 33 and achieves 26.8–39.2 → Inconclusive within the tested uncertainty.
- Lower Manhattan frame, mean of 24 classifications, ±15 pp: pavement 16.4–41%, score 14.5–36.3, NOW 50 mm runoff 20,565–27,623 m³; plan targets 33 and achieves 24.5–46.3 → Inconclusive within the tested uncertainty.
- Design consequence: a target should be read as reached only if it is reached across the measured error range, not at the central estimate alone.

**Envelopes (central estimate in brackets)**

| cover | error range | score | NOW runoff m³ | POSSIBLE runoff m³ | achieved score | target | conclusion |
|---|---|---|---|---|---|---|---|
| example (illustrative) | ±7 pp (benchmark-derived) | 21.6–32.4 (27) | 25079–29094 | 21376–25391 | 31.6–42.4 | 37 | Inconclusive within the tested uncertainty |
| example (illustrative) | ±15 pp (repeat-run) | 15.4–38.6 (27) | 22784–31389 | 19081–27685 | 25.4–48.6 | 37 | Inconclusive within the tested uncertainty |
| Lower Manhattan frame, mean of 24 classifications | ±7 pp (benchmark-derived) | 16.8–29.2 (23) | 22860–26875 | 19630–23646 | 26.8–39.2 | 33 | Inconclusive within the tested uncertainty |
| Lower Manhattan frame, mean of 24 classifications | ±15 pp (repeat-run) | 14.5–36.3 (23) | 20565–27623 | 17336–24394 | 24.5–46.3 | 33 | Inconclusive within the tested uncertainty |

## Headline findings (machine-readable)

| finding | value |
|---|---|
| benchmarkErrorPP | 7 |
| repeatRunErrorPP | 15 |
| combinations | 4 |
| combinationsInconclusive | 4 |
| exampleScoreMin | 21.6 |
| exampleScoreMax | 32.4 |
| exampleNowRunoffMinM3 | 25079 |
| exampleNowRunoffMaxM3 | 29094 |
| exampleAchievedMin | 31.6 |
| exampleTarget | 37 |

## Calibration / validation boundary

Error ranges come from classification/C1 and C2 on the same fixtures; nothing is tuned.

## Conditions

- covers: illustrative example; mean of the 24-times-classified Lower Manhattan frame
- rainfallMm: 50
- plan: solveForTarget(cover, base + 10)

## Limitations

- The ranges are sensitivity ranges from measured behaviour, not confidence intervals.
- Only the vegetation/pavement split is perturbed; water error (the largest in C2) is reported by C2 but not propagated here.
- The built plan is held fixed in square metres; only the estimate of what surrounds it changes.

## Reproduce

```bash
npm run experiment -- interventions/I3-classification-uncertainty
```

Inputs are frozen fixtures; no network access is needed. Result hash `fnv1a64:ded845f61ea23ce2`. CI re-runs this experiment and fails if the committed result no longer matches the code.

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
