"""Generate climate-adaptation recommendations for a site.

Uses OpenAI when `OPENAI_API_KEY` is set, otherwise falls back to a rule-based
recommender so the service always returns something useful.
"""
from __future__ import annotations

import json
import os
from typing import Iterable

from ..models.schemas import FloodRisk, LandCover, Recommendation


def _rule_based(cover: LandCover, score: float, risk: FloodRisk) -> list[Recommendation]:
    recs: list[Recommendation] = []
    impervious = cover.pavement + cover.buildings

    if impervious > 55:
        recs.append(
            Recommendation(
                title="Convert parking to permeable pavement",
                description=(
                    "With impervious surfaces at {p:.0f}%, prioritize permeable "
                    "pavers or porous asphalt in the largest surface lots to "
                    "restore infiltration capacity."
                ).format(p=impervious),
                priority="high",
                category="gray",
            )
        )

    if cover.vegetation < 20:
        recs.append(
            Recommendation(
                title="Expand urban tree canopy",
                description=(
                    "Vegetation is only {v:.0f}% of the footprint. Adding street "
                    "trees and pocket parks would meaningfully improve absorption "
                    "and reduce heat-island effect."
                ).format(v=cover.vegetation),
                priority="high" if cover.vegetation < 10 else "medium",
                category="green",
            )
        )

    if risk in ("moderate", "high"):
        recs.append(
            Recommendation(
                title="Install bioswales along drainage corridors",
                description=(
                    "Given a {r} flood-risk band, route stormwater through "
                    "vegetated bioswales to slow runoff and capture pollutants "
                    "before it reaches the sewer network."
                ).format(r=risk),
                priority="high" if risk == "high" else "medium",
                category="green",
            )
        )
        recs.append(
            Recommendation(
                title="Add underground detention basins",
                description=(
                    "Detention basins under public plazas or parking areas can "
                    "buffer peak runoff during intense rainfall events."
                ),
                priority="medium",
                category="blue",
            )
        )

    if cover.water > 10:
        recs.append(
            Recommendation(
                title="Rehabilitate existing water bodies",
                description=(
                    "The site already has {w:.0f}% water coverage. Restoring "
                    "wetland edges and shoreline vegetation multiplies their "
                    "hydrological value."
                ).format(w=cover.water),
                priority="low",
                category="blue",
            )
        )

    if not recs:
        recs.append(
            Recommendation(
                title="Maintain current green infrastructure",
                description="Site is already resilient — focus on preservation and long-term monitoring.",
                priority="low",
                category="green",
            )
        )
    return recs[:4]


def _openai_recommendations(
    cover: LandCover, score: float, risk: FloodRisk, location: str
) -> list[Recommendation] | None:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None
    try:
        import requests  # local import — optional dep

        model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        prompt = (
            "You are an urban climate-adaptation advisor. "
            f"Location: {location or 'unspecified'}. "
            f"Land cover: pavement {cover.pavement}%, buildings {cover.buildings}%, "
            f"vegetation {cover.vegetation}%, water {cover.water}%, soil {cover.soil}%. "
            f"Absorption score: {score}/100, flood risk: {risk}. "
            "Return STRICT JSON: {\"recommendations\": [{\"title\": str, "
            "\"description\": str, \"priority\": \"high|medium|low\", "
            "\"category\": \"green|blue|gray\"}]}. Provide 4 items."
        )
        resp = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "response_format": {"type": "json_object"},
                "temperature": 0.5,
            },
            timeout=30,
        )
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]
        payload = json.loads(content)
        items: Iterable[dict] = payload.get("recommendations", [])
        return [Recommendation(**item) for item in items][:4]
    except Exception as exc:  # noqa: BLE001
        print(f"[recommendations] OpenAI fallback failed: {exc}")
        return None


def build_recommendations(
    cover: LandCover, score: float, risk: FloodRisk, location: str = ""
) -> list[Recommendation]:
    ai = _openai_recommendations(cover, score, risk, location)
    if ai:
        return ai
    return _rule_based(cover, score, risk)
