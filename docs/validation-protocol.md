# Source ledger and next empirical validation

## Current ledger

| Input | Provider / transformation | Resolution and coverage | Time / license / fallback |
|---|---|---|---|
| Live cover | Captured map image → AI five-class percentages | Whole captured extent, not a classified pixel raster | Scan timestamp retained; source capture date/resolution not established by the classifier; retain imagery-provider attribution. Compared with NLCD 2021 and with repeat runs in `experiments/classification` |
| Example cover | Repository teaching fixture | Fixed Lower Manhattan extent | Explicit illustrative status; not saved as a live scan |
| Elevation | Mapzen Terrarium tiles → sampled grid | Source-dependent; sampled to selected local grid | Hash and observed/illustrative status retained; synthetic slope fallback; source license must be verified for a redistributed tile archive. Contains bathymetry and artefacts to −14 km along NYC shorelines; cells ≤ 0 m are treated as receiving water. Compared with USGS 3DEP in `experiments/routing/R3` |
| 1609 blocks | Welikia reconstruction → bounding boxes and five-class mapping | NYC block-index coverage; bounding boxes are not exact habitat boundaries | Source URL, accessedAt and transformation stored in index; no inferred coverage outside it |
| Island benchmark | Application estimate informed by Mannahatta/Welikia | One reference composition, not per-site | 79.1 derived by shared weights; not a WCS-published five-class measurement |
| Coefficients | Representative fixed weights documented in calibration | Screening land classes, no local soil/drainage calibration | July 2026 coefficient identity; historical calibration is not event validation |
| Cost | Application unit-rate assumptions | USD per installed m², no local market | Source year/geography/inflation undocumented; lifecycle excluded |

A simulation run's content hash does not fill missing source metadata. Future work should archive source date, geographic coverage, native resolution, retrieval timestamp, license and source bytes before claiming exact replay.

## Candidate outcome datasets

USGS provides event-based streamflow, high-water marks and temporary sensor records through the [Flood Event Viewer](https://www.usgs.gov/tools/flood-event-viewer) and [Short-Term Network](https://stn.wim.usgs.gov/). Candidate events must be checked for mechanism: coastal surge and river overflow are outside this local rainfall-screening model.

[NYC 311 reporting](https://www.nyc.gov/site/311reporting/faq/faq.page) provides location-based service-request information. Reports are complaints, not measured depth, and location validation/availability affects geographic totals. Treat complaint association as a separate exploratory question, not physical validation.

The 311 route has now been taken, as an exploratory association and not as physical validation: see [PREREGISTRATION](../experiments/PREREGISTRATION.md) and results R4 (development) and R5 (holdout) in [experiments](../experiments/INDEX.md). The USGS event archives remain unused; the storms tested were pluvial, and no high-water marks were matched.

## Predeclare the question

1. First validate classified cover against an independently sourced, date-matched land-cover map or blinded manual annotation. Record class confusion and extent sensitivity. Do not tune against held-out study blocks.
2. For an observed pluvial event, ask whether within-event modeled accumulation ranks associate with independently observed wet locations, after explicit coverage and geolocation filtering. Absence of a complaint is not a dry observation.
3. Hold out entire events and spatial catchments. Freeze coefficients, classifier version, inclusion/exclusion criteria, study extents and matching radii before inspecting holdout performance.
4. Compare against simple baselines (impervious fraction and elevation-only accumulation). Report effect sizes, coverage, sensitivity to matching choices and failures; never select only persuasive maps.
5. Do not evaluate RMSE of modeled flood depth or peak discharge: this implementation does not solve either quantity physically. Such validation requires a suitable hydraulic model and observations with matching datums and timing.

## What the first contact established, and what it did not

Steps 1–4 above have now been carried out once, on committed fixtures, with the protocol committed before outcomes were read:

- **Step 1** (classification against an independent map): pervious share differs from NLCD 2021 by 6.7 pp on average across 16 frames; repeat runs of one frame span 29 pp. Aggregate classes only; no pixel-level confusion matrix is defensible from these data.
- **Steps 2–4** (association with observed wet locations, holdout, baselines): on the holdout storm, routed accumulation did not beat the low-elevation baseline (AUC 0.50 vs 0.62).

This is not an accuracy claim for the score, the water budget or any depth. The repository still has no event-matched archive of antecedent conditions, drainage capacity, source imagery or measured runoff, and 311 reports are not measurements. Step 5 stands: RMSE of flood depth or peak discharge would need a hydraulic model and matching observations.
