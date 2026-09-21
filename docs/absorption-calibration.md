# Calibrating the Urban Absorption Score

**Date:** 2026-07-14
**Sample:** 18 real scans, run through the production `analyze-terrain` pipeline

The landing page claims the score "is not a black box." This document is what
makes that claim true. It records what the model was, what was wrong with it,
what it is now, and the real data that decided it.

## What was wrong

### 1. Vegetation absorbed 100% of the rain

```
vegetation: 1.00
```

No surface does. The Rational Method runoff coefficient `C` — the number used in
actual stormwater drainage design — puts urban lawns and woodland at
`C ≈ 0.05–0.25`, meaning they shed 5–25% of rainfall even on sandy soil.
A weight of 1.00 is not "simplified"; it is physically impossible.

### 2. Open water was scored as a half-strength sponge

```
water: 0.50
```

This is the defect that mattered. A river or a harbour is not absorption
capacity — it is the body that **receives** the runoff. Weighting it at 0.50
meant a site scored *better* the more exposed it was to open water.

The consequence, measured:

| Site | Water in frame | Old score | Old band |
|---|---|---|---|
| **Port of Rotterdam** (container terminal) | 45.5% | **45.8** | moderate |
| **Kreuzberg, Berlin** (leafy residential) | 3% | **36.5** | high |

The model rated a container port as more flood-resilient than a Berlin
neighbourhood with trees in it, purely because the port had a harbour in shot.
Lower Manhattan does not flood less because the Hudson is there. During Sandy it
flooded *because* the Hudson was there.

## The model now

Each weight is `1 − C`, where `C` is the Rational Method runoff coefficient
(`Q = CiA`). Mid-range values for urban land cover, after ASCE and
Chow, Maidment & Mays, *Applied Hydrology*:

| Surface | `C` range | taken | **weight (absorbs)** |
|---|---|---|---|
| Lawns & woodland, urban | 0.05 – 0.25 | 0.20 | **0.80** |
| Bare / compacted urban soil | 0.20 – 0.40 | 0.30 | **0.70** |
| Roofs | 0.75 – 0.95 | 0.90 | **0.10** |
| Asphalt & concrete | 0.70 – 0.95 | 0.88 | **0.12** |
| **Open water** | — | — | **excluded** |

Water carries no weight **and is removed from the denominator**. The score asks:
*of the land here, how much rain can it take?* The water fraction is still
reported — it is real and it matters — but it is reported as water, not as
absorption.

## The calibration set

18 sites, chosen to span the density spectrum. Controls at both ends test
whether the instrument can reach its own extremes.

| Score | Class | Site |
|---:|---|---|
| **74.7** | green | Bois de Boulogne, Paris |
| 51.8 | suburb | Katy, TX |
| 50.8 | green | Tiergarten, Berlin |
| 48.3 | sponge | Ørestad, Copenhagen |
| 48.3 | sponge | Portland, OR |
| 44.0 | suburb | Gilbert, AZ |
| 41.3 | sponge | Bishan Park, Singapore |
| 41.0 | green | Central Park, NYC |
| 38.6 | paved | Port of Rotterdam, NL |
| 38.4 | core | Central, Hong Kong |
| 34.5 | megacity | Jakarta Pusat, ID |
| 34.4 | megacity | Dharavi, Mumbai |
| 33.6 | mid | Kreuzberg, Berlin |
| 32.3 | mid | Amsterdam Zuid, NL |
| 24.0 | core | Shinjuku, Tokyo |
| 19.1 | paved | Sky Harbor Airport, Phoenix |
| 14.2 | mid | Eixample, Barcelona |
| **14.0** | core | Midtown Manhattan, NY |

The scale resolves: forest at the top, Midtown at the bottom, 60 points between
them.

## The bands

```
>= 55   low       the land takes most of the rain that falls on it
35-54   moderate  roughly half runs off; drainage carries the rest
<  35   high      two thirds or more runs off; the site depends on drainage
```

These are **not** tuned to give a flattering spread. Under them, only one site in
the calibration set is "low risk" — a forest. Most urban land really is mostly
impervious, and most cities really do land in "moderate" or "high".

**That is the finding, not a defect.** It is also the product's entire thesis.

## What this calibration does NOT establish

Be clear about the limits, because the page claims rigour:

- **It is not validated against observed flooding.** No gauge data, no flood
  incident records, no measured runoff. The weights come from published
  engineering coefficients, and the bands from the observed distribution of land
  cover. Neither has been checked against a city that actually flooded.
- **The dominant source of error is the classifier, not the weights.** The vision
  model returns suspiciously round numbers — nearly every value is a multiple of
  5, and they always sum to exactly 100. That is an estimate, not a measurement.
  Refining weights to two decimal places on top of an input like that is false
  precision.
- **Frame size changes the answer.** Every scan here used a ~2.2 km box. Central
  Park scored only 41 because a 2.2 km frame centred on an 800 m-wide park is
  mostly Upper Manhattan. The score describes the frame, not the place.
- **No slope, no soil type, no antecedent moisture.** Real runoff depends on all
  three. `C` varies by a factor of three across slope and soil class alone.

## Reproducing this

The weights live in three places and a test fails if they drift:

- `src/lib/absorption.ts` — the frontend model
- `supabase/functions/analyze-terrain/index.ts` — computes and **stores** every score
- `backend/app/services/scoring.py` — the reference Python backend

`src/lib/absorption.test.ts` parses the latter two and asserts they agree with
the first. Change one, and the suite tells you about the other two.

Existing scans were backfilled by
`supabase/migrations/20260714120000_recalibrate_absorption_score.sql`.
