# Preregistration: first empirical contact

Written and committed **before** any outcome data were downloaded or inspected.
Later changes to this file must be additions with a date, never silent edits.
The git history of this file is the evidence that the order was respected.

Date: 2026-09-29

## Principle

Calibration data may change the model. Validation data may only judge it.
No parameter, threshold, area selection or matching radius below may be tuned
on the holdout. If the model is revised after looking at development data, the
revision is evaluated on the holdout exactly once, and that result is kept
whatever it says.

## Study areas (chosen by description or by seeded sampling, never by outcome)

Eight named areas, about 1 km² each, chosen for the diversity of conditions
they represent. Their identities are fixed here:

| id | condition | centre (lat, lng) |
|---|---|---|
| `midtown-dense` | dense urban core | 40.7549, -73.9840 |
| `central-park-south` | park-heavy | 40.7700, -73.9740 |
| `lower-manhattan-example` | waterfront; the app's example extent | bbox -74.014, 40.703, -74.004, 40.712 |
| `jackson-heights` | mixed residential | 40.7505, -73.8850 |
| `washington-heights` | strongly sloped | 40.8500, -73.9370 |
| `canarsie` | nearly flat, low-lying | 40.6380, -73.9010 |
| `long-island-city` | high-impervious industrial | 40.7420, -73.9380 |
| `forest-hills-gardens` | high tree canopy | 40.7150, -73.8430 |

Forty further tiles (0.012° × 0.009°, about 1 km²) are sampled from a regular
grid over New York City with a seeded generator (`mulberry32`, seed
`20260929`), in sampling order, accepting a tile only if its four corners and
centre fall on land inside the shoreline-clipped NYC borough boundaries. No
outcome information enters the sample.

## Question R1: does routed accumulation locate reported street flooding?

- **Outcome:** NYC 311 service requests with complaint type `Sewer` and
  descriptor `Street Flooding (SJ)` inside an event window, deduplicated by
  location within each event. Sensitivity: add `Catch Basin
  Clogged/Flooding (Use Comments) (SC)`. Basement `Sewer Backup` is excluded
  (it is not surface flooding).
- **Model quantity:** D8 accumulation from the unmodified app engine on
  Terrarium elevation at the `medium` (72 × 72) grid.
- **Metric:** AUC = probability that the cell containing a complaint ranks
  higher than a random cell of the same study area (ties count half), pooled
  over areas. Reported with the number of complaints and areas.
- **Baselines that must be beaten:** 0.5 (no information) and "lowness"
  (1 − elevation percentile within the area). Because the app applies one
  composite land-cover coefficient to every cell, accumulation ranks within an
  area do not depend on land cover or rainfall depth; this is a test of
  terrain routing only.
- **Matching:** primary radius 0 (the containing cell). Sensitivity: the
  maximum over a 1-cell neighbourhood. Declared now; neither is chosen by
  result.
- **Split:**
  - development events: 2021-08-21 12:00 → 2021-08-23 00:00 (Henri) and
    2021-09-01 18:00 → 2021-09-02 12:00 (Ida), local time;
  - **holdout event:** 2023-09-29 00:00 → 2023-09-30 06:00.
  Development events may inform diagnosis and one revision of the routing
  model. The holdout is computed once, after that revision is frozen.
- **What a result would mean:** AUC meaningfully above both baselines on the
  holdout would be modest evidence that routed accumulation carries
  information about where people report street flooding. It would not
  validate depth, timing, drainage capacity, or any flood probability.
  Complaints are reports, not measurements: absence of a complaint is not a
  dry observation, and reporting depends on population and road use.

## Question C1: how does the classifier agree with an independent reference?

- **Reference:** USGS NLCD 2021 land cover (open water, class 11) and percent
  developed imperviousness, 30 m, via the MRLC WCS. Independent of the
  classifier's imagery and model. Five years older than the scans.
- **Classifier outputs:** existing scans in the public feed that carry a
  bounding box inside NLCD coverage. No new classification requests are made.
- **Compared classes:** open water; impervious (buildings + pavement);
  pervious land (vegetation + soil). Buildings and pavement are not separable
  in NLCD and are not compared separately.
- **Metrics:** signed and absolute error in percentage points per class;
  score interval implied by the reference (pervious weights 0.70–0.80,
  impervious 0.10–0.12) and whether the stored classification's score falls
  inside it.
- No calibration/holdout split: there are too few distinct frames. Results
  are descriptive and must be reported as such.

## Question C2: is the classifier stable on an identical frame?

Repeat classifications of an identical bounding box already present in the
public feed. Metrics: per-class range and standard deviation, score range,
bulk-runoff range at 50 mm, share of values that are multiples of 5.
Imagery bytes were not archived, so provider/imagery identity cannot be
verified; this is stated as a limitation, not assumed away.
