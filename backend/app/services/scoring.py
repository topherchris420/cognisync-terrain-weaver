"""Urban Absorption Score + flood-risk banding.

KEEP IN SYNC with src/lib/absorption.ts and
supabase/functions/analyze-terrain/index.ts.

Weights are ``1 - C``, where ``C`` is the Rational Method runoff coefficient
(Q = CiA) used in real stormwater drainage design. Representative mid-range
values for urban land cover, after ASCE and Chow/Maidment/Mays,
*Applied Hydrology*:

    lawns & woodland, urban      C 0.05-0.25  -> take 0.20 -> absorbs 0.80
    bare / compacted urban soil  C 0.20-0.40  -> take 0.30 -> absorbs 0.70
    roofs                        C 0.75-0.95  -> take 0.90 -> absorbs 0.10
    asphalt & concrete           C 0.70-0.95  -> take 0.88 -> absorbs 0.12

Open water carries no weight and is EXCLUDED from the denominator. It is not
absorption capacity -- it is the body that receives the runoff. Scoring it as a
half-strength sponge rewards a site for being flood-exposed.

Replace these with locally-calibrated values if you have hydrological survey
data for your region; see docs/absorption-calibration.md.
"""
from __future__ import annotations

from ..models.schemas import FloodRisk, LandCover

WEIGHTS: dict[str, float] = {
    "vegetation": 0.80,
    "soil": 0.70,
    "buildings": 0.10,
    "pavement": 0.12,
}

ABSORBING = ("vegetation", "soil", "buildings", "pavement")

# Calibrated against 18 real scans spanning the urban density spectrum, from
# Bois de Boulogne (74.7) to Midtown Manhattan (14.0).
RISK_BANDS = {"moderate": 35.0, "low": 55.0}


def absorption_score(cover: LandCover) -> float:
    """Share of rainfall the LAND in a tile can absorb, 0-100.

    The denominator is land only: a tile that is 45% harbour is scored on the
    55% that could actually absorb something.
    """
    data = cover.model_dump()
    land = sum(float(data.get(k, 0) or 0) for k in ABSORBING)
    if land <= 0:
        return 0.0
    absorbed = sum(float(data.get(k, 0) or 0) * WEIGHTS[k] for k in ABSORBING)
    return round((absorbed / land) * 100, 1)


def flood_risk(score: float) -> FloodRisk:
    if score >= RISK_BANDS["low"]:
        return "low"
    if score >= RISK_BANDS["moderate"]:
        return "moderate"
    return "high"
