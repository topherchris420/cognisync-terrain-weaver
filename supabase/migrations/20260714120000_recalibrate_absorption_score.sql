-- Recalibrate the Urban Absorption Score against published runoff coefficients,
-- and backfill every existing scan.
--
-- WHY
--
-- The previous model had two defects:
--
--   1. vegetation was weighted 1.00 -- claiming vegetated ground absorbs 100% of
--      the rain that falls on it. No surface does. Even woodland on sandy soil
--      sheds 5-25% (Rational Method runoff coefficient C).
--
--   2. open water was weighted 0.50, as though a river were a half-strength
--      sponge. It is not: it is the body that RECEIVES the runoff. This rewarded
--      a site for being flood-exposed. The Port of Rotterdam scored 45.8
--      ("moderate") against 36.5 ("high") for a leafy Berlin residential
--      district -- a container terminal rated more flood-resilient than
--      Kreuzberg, purely because 45% of its frame was harbour.
--
-- THE MODEL
--
-- Each weight is (1 - C), where C is the Rational Method runoff coefficient
-- (Q = CiA) used in real stormwater drainage design. Mid-range values for urban
-- land cover, after ASCE and Chow/Maidment/Mays, Applied Hydrology:
--
--   lawns & woodland, urban      C 0.05-0.25  -> 0.20  -> absorbs 0.80
--   bare / compacted urban soil  C 0.20-0.40  -> 0.30  -> absorbs 0.70
--   roofs                        C 0.75-0.95  -> 0.90  -> absorbs 0.10
--   asphalt & concrete           C 0.70-0.95  -> 0.88  -> absorbs 0.12
--
-- Water carries no weight AND is excluded from the denominator. The score now
-- answers: of the LAND here, how much rain can it take?
--
-- Bands recalibrated against 18 real scans spanning the density spectrum:
--   >= 55  the land takes most of the rain          (was >= 65)
--   35-54  roughly half runs off                    (was 40-64)
--   <  35  two thirds or more runs off              (was < 40)
--
-- Keep in sync with src/lib/absorption.ts, supabase/functions/analyze-terrain,
-- and backend/app/services/scoring.py. A test in src/lib/absorption.test.ts
-- parses those files and fails if they drift.

BEGIN;

WITH recomputed AS (
  SELECT
    id,
    -- Land = everything except open water. A tile that is 45% harbour is scored
    -- on the 55% that could actually absorb something.
    (
      COALESCE((land_cover ->> 'vegetation')::numeric, 0) +
      COALESCE((land_cover ->> 'soil')::numeric, 0) +
      COALESCE((land_cover ->> 'buildings')::numeric, 0) +
      COALESCE((land_cover ->> 'pavement')::numeric, 0)
    ) AS land,
    (
      COALESCE((land_cover ->> 'vegetation')::numeric, 0) * 0.80 +
      COALESCE((land_cover ->> 'soil')::numeric, 0)       * 0.70 +
      COALESCE((land_cover ->> 'buildings')::numeric, 0)  * 0.10 +
      COALESCE((land_cover ->> 'pavement')::numeric, 0)   * 0.12
    ) AS absorbed
  FROM public.analyses
  WHERE land_cover IS NOT NULL
),
scored AS (
  SELECT
    id,
    CASE
      WHEN land <= 0 THEN 0
      ELSE ROUND((absorbed / land) * 100, 1)
    END AS score
  FROM recomputed
)
UPDATE public.analyses AS a
SET
  absorption_score = s.score,
  flood_risk = CASE
    WHEN s.score >= 55 THEN 'low'
    WHEN s.score >= 35 THEN 'moderate'
    ELSE 'high'
  END
FROM scored AS s
WHERE a.id = s.id;

COMMIT;
