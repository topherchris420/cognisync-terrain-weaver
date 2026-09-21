"""Pydantic request/response schemas for the resilience API."""
from __future__ import annotations

from typing import Any, Literal, Optional
from pydantic import BaseModel, Field, confloat


LandCoverClass = Literal["pavement", "buildings", "vegetation", "water", "soil"]
FloodRisk = Literal["low", "moderate", "high"]
RecPriority = Literal["high", "medium", "low"]
RecCategory = Literal["green", "blue", "gray"]


class LandCover(BaseModel):
    pavement: confloat(ge=0, le=100) = 0
    buildings: confloat(ge=0, le=100) = 0
    vegetation: confloat(ge=0, le=100) = 0
    water: confloat(ge=0, le=100) = 0
    soil: confloat(ge=0, le=100) = 0


class Recommendation(BaseModel):
    title: str
    description: str
    priority: RecPriority = "medium"
    category: RecCategory = "green"


class AnalyzeResponse(BaseModel):
    id: Optional[str] = None
    name: str
    location_label: Optional[str] = None
    center_lat: float
    center_lng: float
    zoom: float
    bbox: Optional[Any] = None
    land_cover: LandCover
    absorption_score: confloat(ge=0, le=100)
    flood_risk: FloodRisk
    recommendations: list[Recommendation]
    ai_notes: Optional[str] = None
    status: str = "complete"


class HealthResponse(BaseModel):
    status: str = "ok"
    service: str = "vers3dynamics-resilience-api"
    version: str = Field(default="0.1.0")
