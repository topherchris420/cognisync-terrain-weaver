"""Land-cover segmentation.

The default implementation is a fast HSV-based heuristic that turns any RGB
satellite tile into rough per-class percentages so the API returns real numbers
without a heavy ML dependency. Swap `segment_land_cover` for a proper model
(DeepLabV3, U-Net, SAM, ...) when you're ready.
"""
from __future__ import annotations

from io import BytesIO
from typing import Optional

import numpy as np
from PIL import Image

from ..models.schemas import LandCover


def _load_rgb(image_bytes: bytes, max_size: int = 512) -> np.ndarray:
    img = Image.open(BytesIO(image_bytes)).convert("RGB")
    # Downscale for speed — segmentation percentages are scale-invariant here.
    img.thumbnail((max_size, max_size), Image.LANCZOS)
    return np.asarray(img, dtype=np.uint8)


def _rgb_to_hsv(arr: np.ndarray) -> np.ndarray:
    """Vectorized RGB->HSV, output in [0, 1]."""
    rgb = arr.astype(np.float32) / 255.0
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    maxc = np.max(rgb, axis=-1)
    minc = np.min(rgb, axis=-1)
    v = maxc
    delta = maxc - minc

    s = np.where(maxc > 0, delta / (maxc + 1e-6), 0)

    rc = (maxc - r) / (delta + 1e-6)
    gc = (maxc - g) / (delta + 1e-6)
    bc = (maxc - b) / (delta + 1e-6)

    h = np.zeros_like(maxc)
    mask = delta > 0
    h_r = (bc - gc)
    h_g = 2.0 + (rc - bc)
    h_b = 4.0 + (gc - rc)

    h = np.where((maxc == r) & mask, h_r, h)
    h = np.where((maxc == g) & mask, h_g, h)
    h = np.where((maxc == b) & mask, h_b, h)
    h = (h / 6.0) % 1.0

    return np.stack([h, s, v], axis=-1)


def segment_land_cover(image_bytes: bytes) -> LandCover:
    """Return per-class land-cover percentages that sum to ~100."""
    rgb = _load_rgb(image_bytes)
    hsv = _rgb_to_hsv(rgb)
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]

    # Heuristic bands. Tuned for typical satellite basemaps.
    water = (h > 0.5) & (h < 0.72) & (s > 0.20) & (v > 0.15) & (v < 0.75)
    vegetation = (h > 0.18) & (h < 0.42) & (s > 0.18) & (v > 0.10) & (v < 0.85)
    soil = (
        (((h < 0.11) | (h > 0.95)) | ((h > 0.05) & (h < 0.13)))
        & (s > 0.15)
        & (v > 0.20)
        & (v < 0.85)
    )
    # Buildings tend to be brighter, low-saturation, warm-neutral rooftops.
    buildings = (s < 0.18) & (v > 0.55)
    # Pavement / asphalt / concrete: darker, low-saturation.
    pavement = (s < 0.20) & (v <= 0.55) & (v > 0.08)

    # Resolve overlaps by priority: water > vegetation > soil > buildings > pavement.
    counted = np.zeros_like(h, dtype=bool)
    classes = {}

    for name, mask in [
        ("water", water),
        ("vegetation", vegetation),
        ("soil", soil),
        ("buildings", buildings),
        ("pavement", pavement),
    ]:
        m = mask & ~counted
        classes[name] = float(m.mean() * 100)
        counted |= m

    total = sum(classes.values())
    if total <= 0:
        # Fully unclassifiable — mark everything as pavement so score = worst case.
        return LandCover(pavement=100)
    # Renormalize to exactly 100.
    scale = 100.0 / total
    for k in classes:
        classes[k] = round(classes[k] * scale, 1)
    # Correct rounding drift on the largest class.
    drift = 100.0 - sum(classes.values())
    largest = max(classes, key=classes.get)
    classes[largest] = round(classes[largest] + drift, 1)

    return LandCover(**classes)
