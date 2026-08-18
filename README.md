# Mannahatta · Urban Resilience Intelligence

[![status](https://img.shields.io/badge/status-v0.3-brightgreen)](https://github.com/topherchris420/cognisync-terrain-weaver)
[![license](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)
[![CI](https://github.com/topherchris420/cognisync-terrain-weaver/actions/workflows/ci.yml/badge.svg)](https://github.com/topherchris420/cognisync-terrain-weaver/actions/workflows/ci.yml)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-orange)](https://github.com/topherchris420/cognisync-terrain-weaver/pulls)

**Point it at any city block. Get a quantitative climate-resilience report back in seconds.**

Mannahatta is an open-source geospatial analytics platform that transforms satellite imagery into a rigorous land-cover breakdown, an **Urban Absorption Score**, flood-risk banding, and prioritized green-infrastructure adaptation strategies. It allows planners, engineers, and policymakers to stress-test depaving, bioswales, green roofs, and tree canopy interventions, simulate 50mm design storm hydrographs, inspect animated flow vectors, and export publication-ready PDF dossiers, GeoJSON layers, and CSV data.

---

## Contents

- [Core Capabilities](#core-capabilities)
- [Workstation Architecture](#workstation-architecture)
- [The Urban Absorption Score](#the-urban-absorption-score)
- [The 1609 Ecological Baseline](#the-1609-ecological-baseline)
- [Hydrological Runoff Simulation](#hydrological-runoff-simulation)
- [Green Infrastructure Mitigation Studio](#green-infrastructure-mitigation-studio)
- [GIS Interoperability & Exports](#gis-interoperability--exports)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Roadmap](#roadmap)
- [Contributing & License](#contributing--license)

---

## Core Capabilities

| Capability | Module / Layer |
|---|---|
| **High-Res Interactive Satellite Imagery** | MapLibre GL + Esri World Imagery (automatic Sentinel-2 cloudless fallback) |
| **Location Search & Watershed Bookmarks** | OpenStreetMap Nominatim search + quick-jump bookmarks (Manhattan, Copenhagen, Jakarta, Phoenix, Lagos) |
| **Live Geolocation & Bounding Box Sizing** | Real-time viewport bounds, spherical earth surface area ($km^2$ and hectares) |
| **5-Class Surface Permeability Ledger** | Vegetation, Bare Soil, Water, Buildings, Pavement classification with Rational Method runoff weights |
| **Urban Absorption Score (0–100)** | Quantitative score and risk banding (**Resilient**, **Vulnerable**, **Critical**) |
| **1609 Pre-Development Baseline** | Ecological benchmark comparison against historical Manhattan pre-development watershed ($79.1$) |
| **50mm Design Storm Hydrograph Simulation** | Precipitation volume vs modeled runoff vs natural infiltration ($m^3$) with D8 flow accumulation |
| **Animated Flow Vectors & Inundation Heatmaps** | WebGL particle flow paths and flood risk zones with layer visibility controls |
| **Green Infrastructure Mitigation Studio** | Interactive placement of bioswales, permeable paving, green roofs, and urban tree canopy |
| **Counterfactual Scenario Comparison** | Synchronized split-screen comparative slider between Baseline and Mitigated scenarios |
| **Open Data & Dossier Export** | Publication-grade PDF Resilience Dossiers, GeoJSON vector layers, and CSV tables |

---

## Workstation Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        GIS Workstation (React + Vite)                  │
│   MapLibre GL  ▸  captureImage()  ▸  supabase.functions.invoke(...)    │
└─────────────────────────┬──────────────────────────────────────────────┘
                          │  POST { image_data_url, lat, lng, zoom, bbox }
                          ▼
┌────────────────────────────────────────────────────────────────────────┐
│               Edge Function: analyze-terrain (Deno / TS)                │
│   1. Vision Analysis   → 5-class land-cover classification             │
│   2. Weighted Scoring  → Urban Absorption Score + flood-risk band       │
│   3. Recommendations   → Prioritized Green/Blue/Gray interventions     │
│   4. Persistence       → INSERT INTO public.analyses                   │
└─────────────────────────┬──────────────────────────────────────────────┘
                          ▼
┌────────────────────────────────────────────────────────────────────────┐
│               Edge Function: run-simulation (Deno / TS)                 │
│   1. Topography        → SRTM DEM via OpenTopography                   │
│   2. Flow Direction    → D8 steepest downhill routing                   │
│   3. Accumulation      → Hydrodynamic flow path vectors + risk zones    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## The Urban Absorption Score

A single 0–100 index representing **the fraction of rainfall the land surface can naturally absorb**.

Each surface weight is derived as `1 − C`, where `C` is the Rational Method runoff coefficient ($Q = CiA$) standard in stormwater engineering (ASCE / Chow, Maidment & Mays):

| Class | `C` Coefficient Range | Absorption Weight | Hydrological Rationale |
|---|:---:|:---:|---|
| **Vegetation** | 0.05 – 0.25 | **0.80** | Lawns and woodland still shed 5–25% under heavy precipitation |
| **Bare Soil** | 0.20 – 0.40 | **0.70** | Permeable, but compacted in urban environments |
| **Buildings** | 0.75 – 0.95 | **0.10** | Engineered roofs — effectively impervious |
| **Pavement** | 0.70 – 0.95 | **0.12** | Asphalt and concrete roads, parking, and sidewalks |
| **Water** | — | **Excluded** | Existing hydrologic capacity; excluded from the denominator |

### Flood Risk Classification
- **55–100 · Resilient (Low Risk)**: The site naturally absorbs the majority of storm precipitation.
- **35–54 · Vulnerable (Moderate Risk)**: Roughly half the volume runs off, placing heavy burden on municipal drainage.
- **0–34 · Critical (High Risk)**: Two-thirds or more sheds directly as surface runoff; vulnerable to cloudburst inundation.

---

## The 1609 Ecological Baseline

Every scan is compared against an ecological reference benchmark: Manhattan in 1609 before urbanization.

Derived from the Wildlife Conservation Society's Mannahatta Project (Eric W. Sanderson), the pre-development island featured 66 miles of streams, extensive freshwater wetlands, mature forests, and zero engineered impervious surfaces.

Using the same absorption model, Manhattan in 1609 scores **79.1 / 100** (not 100, because natural woodland still sheds 5–25% during intense precipitation). This provides an honest, scientifically grounded ecological north star.

---

## Hydrological Runoff Simulation

The simulation engine models how water moves across the terrain under a **50mm / 2-hour design storm event**:

1. **Digital Elevation Model**: Fetches real SRTM topography for the bounding box (with fallback to synthetic slope).
2. **D8 Hydrodynamic Routing**: Routes runoff downslope to identify flow convergence channels.
3. **Volumetric Ledger**:
   - $\text{Total Precipitation Volume} = \text{Area } (m^2) \times 0.05\text{ m}$
   - $\text{Runoff Volume } (m^3) = \text{Area } (m^2) \times 0.05\text{ m} \times C_{\text{composite}}$
   - $\text{Infiltrated Volume } (m^3) = \text{Total Volume} - \text{Runoff Volume}$
4. **Map Overlays**: Renders animated blue flow vectors with opacity scaled by discharge volume, and graded flood inundation risk polygons.

---

## Green Infrastructure Mitigation Studio

Planners can simulate the impact of retrofitting impervious surfaces:

| Intervention | Source Surface | Effective Weight | Planning Unit Cost |
|---|---|:---:|:---:|
| **Street Trees & Urban Canopy** | Pavement | **1.00** | $45 / m² |
| **Bioswales & Rain Gardens** | Pavement | **0.90** | $65 / m² |
| **Permeable Pavement** | Pavement | **0.75** | $150 / m² |
| **Green Roofs** | Buildings | **0.60** | $180 / m² |

The engine calculates:
- $\Delta\text{Score} = \text{share} \times \text{fraction} \times (w_{\text{target}} - w_{\text{source}}) \times 100$
- **Annual Stormwater Retention Gain** ($m^3/\text{yr}$)
- **Capital Expenditure (CAPEX)** ($)
- **Payback Period** (Years)

---

## GIS Interoperability & Exports

- **PDF Resilience Dossier**: Complete, formatted assessment reports with charts, land-cover tables, risk scores, and mitigation recommendations (`src/lib/pdf-export.ts`).
- **GeoJSON (RFC 7946)**: Footprint polygons with attributes for direct import into **QGIS**, **ArcGIS**, **Felt**, or **PostGIS**.
- **CSV**: Flat attribute tables for spreadsheets and business intelligence dashboards.

---

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, MapLibre GL JS, Radix UI, Lucide Icons, jsPDF
- **State & Data**: TanStack Query, React Router, Supabase JS Client
- **Backend / Edge Functions**: Deno, TypeScript, Supabase Postgres, Google Gemini Vision API
- **Testing**: Vitest, React Testing Library, jsdom (110+ unit & integration tests)
- **Mobile**: Capacitor support for iOS and Android

---

## Getting Started

### Prerequisites
- Node.js (v18+)
- npm or bun

### Installation

```bash
# Clone the repository
git clone https://github.com/topherchris420/cognisync-terrain-weaver.git
cd cognisync-terrain-weaver

# Install dependencies
npm install

# Start development server
npm run dev
```

The application will be available at `http://localhost:8080`.

### Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start local Vite development server |
| `npm run build` | Build optimized production bundle |
| `npm run typecheck` | Run TypeScript typechecking (`tsc --noEmit`) |
| `npm test` | Run Vitest test suite |
| `npm run lint` | Run ESLint across codebase |

---

## Project Structure

```
src/
├── pages/
│   ├── Analyze.tsx        # GIS Workstation (Map, Workbench Drawer, Storm Sim, Studio)
│   ├── Dashboard.tsx      # Public portfolio & site comparison feed
│   ├── Auth.tsx           # Authentication
│   └── NotFound.tsx       # 404 Route
├── components/
│   ├── AppNav.tsx                 # Permanent workstation header
│   ├── MapView.tsx                # MapLibre GL raster/vector map canvas
│   ├── LocationSearch.tsx         # Nominatim geocoder + city presets
│   ├── AbsorptionScoreGauge.tsx   # 0–100 Absorption Score dial
│   ├── LandCoverBreakdown.tsx     # 5-class composition ledger & weights
│   ├── BaselineComparison.tsx     # 1609 ecological benchmark comparison
│   ├── RecommendationsList.tsx    # Prioritized green adaptation actions
│   ├── ScenarioStudio.tsx         # Mitigation ROI & parameter modeling
│   ├── FlowLayer.tsx              # Animated hydrodynamic flow vector overlay
│   ├── RiskHeatmap.tsx            # Flood inundation risk zone overlay
│   ├── MapEditor.tsx              # Polygon drawing tool for mitigations
│   └── catalyst/
│       └── CompareRealities.tsx   # Dual-map split-screen comparison slider
├── lib/
│   ├── absorption.ts      # Score calculation & risk band algorithms
│   ├── baseline.ts        # 1609 pre-development ecological model
│   ├── scenario.ts        # Mitigation math, CAPEX, and payback
│   ├── simulation.ts      # Runoff depth & volume calculations
│   ├── geo.ts             # Bounding box math, GeoJSON/CSV exporters
│   ├── geocode.ts         # Location search & city presets
│   └── pdf-export.ts      # Vector PDF dossier generator
└── supabase/
    └── functions/
        ├── analyze-terrain/  # Vision classification & scoring edge function
        └── run-simulation/   # D8 flow accumulation edge function
```

---

## Roadmap

- **v0.1** ✅ — Land cover classification, absorption scoring, adaptation engine
- **v0.2** ✅ — Scenario Studio (what-if interventions + investment analytics), GeoJSON/CSV export, portfolio comparison
- **v0.3** ✅ — Hydrological runoff simulation: 50mm design storm D8 flow accumulation over SRTM elevation, animated flow vectors, flood risk zones, and split-screen comparison
- **v0.4** 🚧 — EPA SWMM integration and live IoT rain gauge / soil moisture sensor telemetry over MQTT
- **v1.0** — City-scale digital twin sync and open REST/GraphQL API

---

## Contributing & License

Contributions are welcome! Feel free to submit pull requests or open issues for calibrated runoff coefficients, new green infrastructure templates, or additional map layers.

Distributed under the **MIT License**.

Built by **[Vers3Dynamics](https://vers3dynamics.com)**.
