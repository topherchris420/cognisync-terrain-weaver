# Does routing change with grid resolution?

`routing/R2-resolution-sensitivity` · Repeated measurement: how stable is an output under repetition or resampling?

## Question

On the same observed terrain, how similar are routed flow-concentration patterns at the app's low (36), medium (72) and high (120) resolutions, and how much water never leaves the extent?

## Hypothesis

None. This is a descriptive measurement.

## Result

**DESCRIPTIVE (no hypothesis tested).** Median rank correlation of flow concentration between low and high resolution is 0.45; median top-10% hotspot overlap 0.2. With fill-and-spill a median 11% of 50 mm design-storm runoff is held in depressions at high resolution; the original D8 stranded 81% in pits.

- Lowest agreement: midtown-dense (ρ 0.36).
- The original D8 (v1) stranded water in single-cell pits in proportion to how noisy the terrain is; fill-and-spill holds only what each depression's volume allows and passes the rest on.
- Hotspots that move between resolutions should not be read as stable locations: the colored zones are relative ranks within one run.

**Per named area**

| area | condition | ρ 36 v 72 | ρ 36 v 120 | top-10% overlap 36 v 120 | held 36 | held 72 | held 120 | v1 stranded 120 |
|---|---|---|---|---|---|---|---|---|
| midtown-dense | dense urban core | 0.464 | 0.356 | 0.215 | 0 | 0 | 0 | 0.384 |
| central-park-south | park-heavy | 0.589 | 0.528 | 0.221 | 0.296 | 0.315 | 0.303 | 0.862 |
| lower-manhattan-example | waterfront; the app's example extent | 0.451 | 0.448 | 0.187 | 0.312 | 0.343 | 0.328 | 0.875 |
| jackson-heights | mixed residential | 0.481 | 0.39 | 0.176 | 0.011 | 0.009 | 0.012 | 0.831 |
| washington-heights | strongly sloped | 0.582 | 0.573 | 0.275 | 0.048 | 0.061 | 0.054 | 0.348 |
| canarsie | nearly flat, low-lying | 0.486 | 0.457 | 0.187 | 0.299 | 0.19 | 0.315 | 0.784 |
| long-island-city | high-impervious industrial | 0.523 | 0.462 | 0.187 | 0.181 | 0.157 | 0.172 | 0.941 |
| forest-hills-gardens | high tree canopy | 0.495 | 0.453 | 0.204 | 0.006 | 0.005 | 0.005 | 0.701 |

## Headline findings (machine-readable)

| finding | value |
|---|---|
| areas | 8 |
| medianRho36v72 | 0.491 |
| medianRho36v120 | 0.455 |
| medianTopOverlap36v120 | 0.195 |
| medianHeldShare36 | 0.114 |
| medianHeldShare72 | 0.109 |
| medianHeldShare120 | 0.113 |
| medianTrappedShareV1_120 | 0.807 |

## Calibration / validation boundary

None: descriptive sensitivity.

## Conditions

- dem: Terrarium
- forcing: 35 mm runoff (50 mm storm, C 0.7)
- metric: log specific catchment area, compared at 36×36 cell centres

## Limitations

- Resolution changes both the DEM sampling and the D8 path geometry; they cannot be separated here.

## Reproduce

```bash
npm run experiment -- routing/R2-resolution-sensitivity
```

Inputs are frozen fixtures; no network access is needed. Result hash `fnv1a64:19d1c7f7e630f552`. CI re-runs this experiment and fails if the committed result no longer matches the code.

| input | evidence | source | retrieved | content hash |
|---|---|---|---|---|
| dem/ (8 files) | measured | Mapzen Terrarium tiles (AWS Terrain Tiles) and USGS 3DEP Bare Earth dynamic ImageServer | 2026-09-29 | `fnv1a64:c7c3972dafefc99e` |

| model component | version |
|---|---|
| score | `urban-absorption:fnv1a64:489acc5fd4bfe2ea` |
| bulkBudget | `land-budget-v1` |
| routing | `mannahatta-d8-local-v2` |
| assumptions | `2026-09-29.1` |

Run at 2026-09-29T11:56:55.152Z from commit `6b9473e` with uncommitted changes (the commit that adds this report contains them) on Node v22.22.2.
