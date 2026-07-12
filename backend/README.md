# Vers3Dynamics — Reference FastAPI backend

This folder is **reference-only starter code** for teams who want to swap the
Lovable-hosted edge function for a self-hosted Python service that runs a real
computer-vision segmentation model (e.g. DeepLabV3, U-Net, or Segment Anything)
instead of a vision LLM.

The Lovable frontend already works out of the box against the built-in
`analyze-terrain` edge function. Nothing here is executed by Lovable's sandbox.

## What's inside

```
backend/
├── app/
│   ├── main.py                 # FastAPI app, /analyze endpoint
│   ├── models/
│   │   └── schemas.py          # Pydantic request/response schemas
│   └── services/
│       ├── segmentation.py     # Land-cover segmentation model (stub)
│       ├── scoring.py          # Urban Absorption Score + flood risk
│       └── recommendations.py  # Adaptation recommendation generator (stub)
├── requirements.txt
├── Dockerfile
└── .env.example
```

## Running locally

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Then POST an image:

```bash
curl -X POST http://localhost:8000/analyze \
  -F "image=@/path/to/satellite_tile.jpg" \
  -F "name=Riverside Park" \
  -F "center_lat=40.7998" -F "center_lng=-73.9599" -F "zoom=15"
```

## Deploying

- **Render / Railway / Fly.io** — build from the included `Dockerfile`.
- **Cloud Run** — same Dockerfile, expose port `8080`.
- Set `ALLOWED_ORIGINS` to your Lovable app origin so the browser can call it.

## Pointing the Lovable frontend at your Python backend

The frontend calls `supabase.functions.invoke("analyze-terrain", ...)`. Replace
that call with a direct `fetch(POST /analyze)` against your Python service URL,
or make the edge function proxy to your service. Either approach keeps the rest
of the UI unchanged.

## Swapping in a real segmentation model

`app/services/segmentation.py` ships a naive HSV-based classifier so the
service returns real-looking numbers from day one without heavy dependencies.
For production accuracy, replace `segment_land_cover()` with any of:

- **DeepLabV3 / DeepLabV3+** — `torchvision.models.segmentation.deeplabv3_resnet101`
- **U-Net** — `segmentation-models-pytorch`
- **Segment Anything (SAM / SAM2)** — Meta's foundation model
- **A fine-tuned model** on datasets like SpaceNet, LoveDA, or OpenEarthMap

The interface is intentionally tiny — the rest of the pipeline consumes a
`LandCover` dict and doesn't care where those percentages came from.

## Roadmap hooks

The service is structured to accept future modules under `app/services/`:
- `hydrology.py` — SWMM / MikeUrban runoff simulation
- `sensors.py` — IoT ingestion (MQTT, LoRaWAN gateway relay)
- `digital_twin.py` — vector-tile export + WebGL twin layer
