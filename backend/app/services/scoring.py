"""Urban Absorption Score + flood-risk banding.

Weights are simplified runoff coefficients — replace with locally-calibrated
values if you have hydrological survey data for the region.
"""
from __future__ import annotations

from ..models.schemas import FloodRisk, LandCover

WEIGHTS: dict[str, float] = {
    "vegetation": 1.0,
    "soil": 0.85,
    "water": 0.5,
    "buildings": 0.05,
    "pavement": 0.05,
}


def absorption_score(cover: LandCover) -> float:
    data = cover.model_dump()
    total = sum(data.values()) or 1
    raw = sum(data[k] * WEIGHTS.get(k, 0) for k in data) / total
    return round(raw * 100, 1)


def flood_risk(score: float) -> FloodRisk:
    if score >= 65:
        return "low"
    if score >= 40:
        return "moderate"
    return "high"
