# Holdout: routed accumulation and reported street flooding

`routing/R5-311-association-holdout` · Independent observation: comparison with observations of outcomes that the model never used.

## Question

Do cells where people reported street flooding rank higher in routed flow accumulation than other cells of the same study area — and higher than simple low-elevation ranking?

## Hypothesis

Pooled AUC of routed accumulation exceeds 0.5 and exceeds the low-elevation baseline, with the 95% cluster-bootstrap interval of the difference excluding zero.

## Result

**NOT SUPPORTED.** Across 145 deduplicated street-flooding reports in 68 of 208 areas, routed accumulation AUC is 0.5 [0.452, 0.557] versus 0.624 [0.556, 0.692] for simple low elevation (difference -0.123 [-0.188, -0.059]). Routed accumulation does not locate reports better than the low-elevation baseline.

- Of 208 study areas, 68 contain at least one street-flooding report in the holdout window(s).
- Original D8 (v1) accumulation AUC 0.496 [0.452, 0.547]; app v2 0.5 [0.452, 0.557].
- Secondary (declared in Addendum 2): static ponded depth AUC 0.52 [0.502, 0.545], difference from low elevation -0.104 [-0.168, -0.041]. Most cells have zero ponding, so this AUC is dominated by ties.
- Sensitivity (street + catch basin): accumulation AUC 0.537 [0.495, 0.576], low-elevation 0.603 [0.558, 0.647].
- Sensitivity (1-cell neighbourhood): accumulation AUC 0.592 [0.536, 0.648], low-elevation 0.616 [0.548, 0.685].
- Sensitivity (3DEP elevation (48 areas)): accumulation AUC 0.452 [0.358, 0.556], low-elevation 0.645 [0.533, 0.746].

**AUC with 95% cluster-bootstrap intervals**

| variant | reports | areas with reports | accumulation AUC | low-elevation AUC | accumulation − low elevation | ponded depth AUC | ponded − low elevation |
|---|---|---|---|---|---|---|---|
| primary (app v2) | 145 | 68 | 0.5 [0.452, 0.557] | 0.624 [0.556, 0.692] | -0.123 [-0.188, -0.059] | 0.52 [0.502, 0.545] | -0.104 [-0.168, -0.041] |
| original D8 (v1) | 145 | 68 | 0.496 [0.452, 0.547] | 0.624 [0.556, 0.692] | -0.128 [-0.193, -0.065] | — | — |
| street + catch basin | 247 | 102 | 0.537 [0.495, 0.576] | 0.603 [0.558, 0.647] | -0.066 [-0.113, -0.017] | 0.516 [0.502, 0.533] | -0.087 [-0.129, -0.043] |
| 1-cell neighbourhood | 145 | 68 | 0.592 [0.536, 0.648] | 0.616 [0.548, 0.685] | -0.024 [-0.087, 0.031] | 0.532 [0.503, 0.567] | -0.084 [-0.143, -0.028] |
| 3DEP elevation (48 areas) | 26 | 17 | 0.452 [0.358, 0.556] | 0.645 [0.533, 0.746] | -0.193 [-0.334, -0.026] | 0.516 [0.474, 0.586] | -0.128 [-0.232, -0.005] |

## Headline findings (machine-readable)

| finding | value |
|---|---|
| complaints | 145 |
| areasWithComplaints | 68 |
| aucAccumulation | 0.5 |
| aucAccumulationLower | 0.452 |
| aucAccumulationUpper | 0.557 |
| aucLowElevation | 0.624 |
| aucDifference | -0.123 |
| aucDifferenceLower | -0.188 |
| aucDifferenceUpper | -0.059 |
| aucPonding | 0.52 |
| aucPondingDifference | -0.104 |
| aucPondingDifferenceLower | -0.168 |
| aucPondingDifferenceUpper | -0.041 |
| aucAccumulationV1 | 0.496 |
| auc_street_catch_basin | 0.537 |
| auc_1_cell_neighbourhood | 0.592 |
| auc_3DEP_elevation_48_areas | 0.452 |

## Calibration / validation boundary

Holdout event fixed in experiments/PREREGISTRATION.md; evaluated once, after development-stage revisions were frozen (Addenda 1–2).

## Conditions

- events: 2023-09-29
- role: holdout
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
npm run experiment -- routing/R5-311-association-holdout
```

Inputs are frozen fixtures; no network access is needed. Result hash `fnv1a64:4093e1e5a8c4f00a`. CI re-runs this experiment and fails if the committed result no longer matches the code.

| input | evidence | source | retrieved | content hash |
|---|---|---|---|---|
| 311/2023-09-29.json | reported | NYC 311 Service Requests from 2010 to Present | 2026-09-29 | `fnv1a64:4a923221509e9744` |
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

Run at 2026-09-29T11:58:55.961Z from commit `a534af4` with uncommitted changes (the commit that adds this report contains them) on Node v22.22.2.
