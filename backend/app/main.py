"""Vers3Dynamics — Urban Resilience Intelligence API (reference implementation).

This FastAPI service mirrors the Lovable-hosted `analyze-terrain` edge function
but runs a local CV segmentation model instead of a vision LLM. Deploy it to
any container platform and point the frontend's analysis call at `/analyze`.
"""
from __future__ import annotations

import os
from uuid import uuid4

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .models.schemas import AnalyzeResponse, HealthResponse
from .services.recommendations import build_recommendations
from .services.scoring import absorption_score, flood_risk
from .services.segmentation import segment_land_cover

app = FastAPI(
    title="Vers3Dynamics — Urban Resilience API",
    description="Analyze satellite imagery for urban permeability and flood vulnerability.",
    version="0.1.0",
)

_allowed = [
    o.strip()
    for o in os.getenv("ALLOWED_ORIGINS", "*").split(",")
    if o.strip()
] or ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse()


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(
    image: UploadFile = File(..., description="Satellite/aerial JPEG or PNG"),
    name: str = Form("Untitled site"),
    location_label: str | None = Form(None),
    center_lat: float = Form(...),
    center_lng: float = Form(...),
    zoom: float = Form(15),
) -> AnalyzeResponse:
    if not (image.content_type or "").startswith("image/"):
        raise HTTPException(status_code=400, detail="Upload must be an image.")

    raw = await image.read()
    if len(raw) < 128:
        raise HTTPException(status_code=400, detail="Image is empty or too small.")

    cover = segment_land_cover(raw)
    score = absorption_score(cover)
    risk = flood_risk(score)
    recs = build_recommendations(cover, score, risk, location_label or "")

    return AnalyzeResponse(
        id=str(uuid4()),
        name=name[:120],
        location_label=(location_label or "")[:200] or None,
        center_lat=center_lat,
        center_lng=center_lng,
        zoom=zoom,
        bbox=None,
        land_cover=cover,
        absorption_score=score,
        flood_risk=risk,
        recommendations=recs,
        ai_notes=None,
    )
