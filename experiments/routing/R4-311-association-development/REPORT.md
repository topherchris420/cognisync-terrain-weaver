# Development: routed accumulation and reported street flooding

`routing/R4-311-association-development` · Independent observation: comparison with observations of outcomes that the model never used.

## Question

Do cells where people reported street flooding rank higher in routed flow accumulation than other cells of the same study area — and higher than simple low-elevation ranking?

## Hypothesis

Pooled AUC of routed accumulation exceeds 0.5 and exceeds the low-elevation baseline, with the 95% cluster-bootstrap interval of the difference excluding zero.

## Result

**INCONCLUSIVE.** Across 173 deduplicated street-flooding reports in 82 of 208 areas, routed accumulation AUC is 0.565 [0.506, 0.626] versus 0.642 [0.58, 0.699] for simple low elevation (difference -0.078 [-0.153, 0.006]). The evidence does not separate routed accumulation from the baseline.

- Of 208 study areas, 82 contain at least one street-flooding report in the development window(s).
- Original D8 (v1) accumulation AUC 0.553 [0.496, 0.617]; app v2 0.565 [0.506, 0.626].
- Secondary (declared in Addendum 2): static ponded depth AUC 0.538 [0.511, 0.567], difference from low elevation -0.104 [-0.153, -0.048]. Most cells have zero ponding, so this AUC is dominated by ties.
- Sensitivity (street + catch basin): accumulation AUC 0.567 [0.521, 0.616], low-elevation 0.612 [0.565, 0.658].
- Sensitivity (1-cell neighbourhood): accumulation AUC 0.585 [0.537, 0.635], low-elevation 0.628 [0.566, 0.683].
- Sensitivity (3DEP elevation (48 areas)): accumulation AUC 0.589 [0.444, 0.72], low-elevation 0.582 [0.481, 0.666].

**AUC with 95% cluster-bootstrap intervals**

| variant | reports | areas with reports | accumulation AUC | low-elevation AUC | accumulation − low elevation | ponded depth AUC | ponded − low elevation |
|---|---|---|---|---|---|---|---|
| primary (app v2) | 173 | 82 | 0.565 [0.506, 0.626] | 0.642 [0.58, 0.699] | -0.078 [-0.153, 0.006] | 0.538 [0.511, 0.567] | -0.104 [-0.153, -0.048] |
| original D8 (v1) | 173 | 82 | 0.553 [0.496, 0.617] | 0.642 [0.58, 0.699] | -0.089 [-0.163, -0.002] | — | — |
| street + catch basin | 275 | 119 | 0.567 [0.521, 0.616] | 0.612 [0.565, 0.658] | -0.045 [-0.102, 0.017] | 0.523 [0.502, 0.545] | -0.089 [-0.128, -0.047] |
| 1-cell neighbourhood | 173 | 82 | 0.585 [0.537, 0.635] | 0.628 [0.566, 0.683] | -0.043 [-0.102, 0.022] | 0.551 [0.509, 0.595] | -0.076 [-0.13, -0.018] |
| 3DEP elevation (48 areas) | 38 | 17 | 0.589 [0.444, 0.72] | 0.582 [0.481, 0.666] | 0.008 [-0.121, 0.125] | 0.55 [0.484, 0.609] | -0.031 [-0.121, 0.059] |

## Headline findings (machine-readable)

| finding | value |
|---|---|
| complaints | 173 |
| areasWithComplaints | 82 |
| aucAccumulation | 0.565 |
| aucAccumulationLower | 0.506 |
| aucAccumulationUpper | 0.626 |
| aucLowElevation | 0.642 |
| aucDifference | -0.078 |
| aucDifferenceLower | -0.153 |
| aucDifferenceUpper | 0.006 |
| aucPonding | 0.538 |
| aucPondingDifference | -0.104 |
| aucPondingDifferenceLower | -0.153 |
| aucPondingDifferenceUpper | -0.048 |
| aucAccumulationV1 | 0.553 |
| auc_street_catch_basin | 0.567 |
| auc_1_cell_neighbourhood | 0.585 |
| auc_3DEP_elevation_48_areas | 0.589 |

## Calibration / validation boundary

Development events fixed in experiments/PREREGISTRATION.md; they informed diagnosis. The routing revision was adopted on the analytic R1 criterion, not on these results. The holdout is not read by this experiment.

## Conditions

- events: 2021-08-henri,2021-09-ida
- role: development
- descriptor: Street Flooding (SJ)
- matchingRadiusCells: 0
- resolution: 72
- dem: terrarium
- routing: app model (v2 fill-and-spill); v1 D8 reported as secondary
- forcing: Central Park gauge event rainfall × NLCD-derived runoff coefficient per area

## Limitations

- 311 complaints are reports, not measurements; absence of a report is not a dry observation.
- Reporting depends on population, traffic and awareness, which also correlate with terrain.
- Complaint coordinates are geocoded addresses, typically tens of metres from the flooded spot; cells are about 14 m.
- One rain gauge stands for the whole city; event rainfall varied strongly across boroughs.
- No sewer network is modelled, while NYC street flooding is largely sewer-capacity driven.
- Land cover is uniform within each area, so spatial patterns come from terrain; the classifier is not tested here.

## Reproduce

```bash
npm run experiment -- routing/R4-311-association-development
```

Inputs are frozen fixtures; no network access is needed. Result hash `fnv1a64:9f7020619fccd887`. CI re-runs this experiment and fails if the committed result no longer matches the code.

| input | evidence | source | retrieved | content hash |
|---|---|---|---|---|
| 311/2021-08-henri.json | reported | NYC 311 Service Requests from 2010 to Present | 2026-09-29 | `fnv1a64:7fab58e21bb7d95f` |
| 311/2021-09-ida.json | reported | NYC 311 Service Requests from 2010 to Present | 2026-09-29 | `fnv1a64:3d7392d08401fe09` |
| areas.json | reference | NYC Borough Boundaries (shoreline-clipped), NYC Department of City Planning | 2026-09-29 | `fnv1a64:fb008d54481af661` |
| nlcd-2021.json | reference | USGS National Land Cover Database 2021: land cover and percent developed imperviousness (CONUS) | 2026-09-29 | `fnv1a64:cde64ea4e37e0145` |
| rain-central-park.json | measured | NOAA NCEI Global Historical Climatology Network daily, Central Park (USW00094728) | 2026-09-29 | `fnv1a64:937133145a412301` |
| dem/ (208 files) | measured | Mapzen Terrarium tiles (AWS Terrain Tiles) and USGS 3DEP Bare Earth dynamic ImageServer | 2026-09-29 | `fnv1a64:adbeacf2e0410a12` |

| model component | version |
|---|---|
| score | `urban-absorption:fnv1a64:489acc5fd4bfe2ea` |
| bulkBudget | `land-budget-v1` |
| routing | `mannahatta-d8-local-v2` |
| assumptions | `2026-09-29.1` |

Run at 2026-09-29T11:56:55.152Z from commit `6b9473e` with uncommitted changes (the commit that adds this report contains them) on Node v22.22.2.
