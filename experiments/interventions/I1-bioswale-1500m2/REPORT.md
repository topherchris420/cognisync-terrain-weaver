# Hypothesis: a 1,500 m² bioswale cuts routed runoff by 8%

`interventions/I1-bioswale-1500m2` · Internal consistency: do the instrument's own parts agree? Says nothing about nature.

## Question

Does a 1,500 m² bioswale on the Lower Manhattan example extent reduce routed runoff under the sealed 50 mm storm by at least 8%?

## Hypothesis

Converting 1,500 m² of eligible pavement to bioswale on the example extent reduces modeled routed runoff under the sealed 50 mm, 60-minute storm by at least 8%.

## Result

**NOT SUPPORTED.** Not supported by the model. The bioswale reduces routed runoff by 0.18% (57.8 of 32,148 m³), below the 8% threshold. Reaching 8% would take about 66,605 m² of bioswale, 27% of the extent's classified pavement.

- Controlled comparison: 9 fixed variables identical (sealed storm identity, rainfall depth (mm), duration (min), study extent and grid, resolution (cells), initial land-cover composition, elevation surface, elevation status, routing model version); only the intervention surface differs.
- This negative result is kept deliberately: a single street-scale bioswale is small against the runoff of a whole 0.85 km² extent, and a claim of district-scale benefit from it would be false within the model itself.
- Support within the model is not evidence about a real bioswale. That would require monitored inflow/outflow data for installed practices.

**NOW / POSSIBLE under the same sealed storm**

| quantity | NOW | POSSIBLE | change |
|---|---|---|---|
| rainfall m³ | 42178 | 42178 | 0 |
| retained m³ | 10030 | 10088 | 57.8 |
| runoff m³ | 32148 | 32090 | -57.8 |
| ponded m³ | 10706 | 10706 | 0 |
| outflow m³ | 21442 | 21384 | -57.8 |

## Headline findings (machine-readable)

| finding | value |
|---|---|
| reductionPercent | 0.18 |
| avoidedM3 | 57.8 |
| nowRunoffM3 | 32148 |
| outflowReductionPercent | 0.27 |
| areaNeededForThresholdM2 | 66605 |
| shareOfPavementNeeded | 0.272 |
| controlledComparisonValid | true |
| verdict | not-supported-by-model |

## Calibration / validation boundary

None: a model experiment. Support here is support within the model, not evidence of a real-world outcome.

## Conditions

- extent: lower-manhattan-example
- rainfallMm: 50
- durationMin: 60
- resolution: medium (72×72)
- cover: illustrative example
- interventionAreaM2: 1500

## Limitations

- Illustrative land cover; eligibility is assumed, not evaluated against mapped pavement.
- The bioswale retention value is a scenario assumption with no recorded source (see the assumption registry).
- The model credits only rain landing on the swale; real swales also capture run-on from a contributing area, and fail once full.

## Reproduce

```bash
npm run experiment -- interventions/I1-bioswale-1500m2
```

Inputs are frozen fixtures; no network access is needed. Result hash `fnv1a64:8b373f2eb03982d9`. CI re-runs this experiment and fails if the committed result no longer matches the code.

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
