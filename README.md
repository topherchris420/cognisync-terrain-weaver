```
  __  __    _    _  _ _  _    _  _____ _____ _
 |  \/  |  / \  | \| | \| |  / \|_   _|_   _/ \
 | |\/| | / _ \ | .` | .` | / _ \ | |   | |/ _ \
 | |  | |/ ___ \| |\  | |\  / ___ \| |   | / ___ \
 |_|  |_/_/   \_\_| \_|_| \_/_/   \_\_|   |_/_/   \_\
```

# Mannahatta · Urban Resilience Intelligence

[![status](https://img.shields.io/badge/status-v0.3-brightgreen.svg?style=for-the-badge)](https://github.com/topherchris420/cognisync-terrain-weaver)
[![license](https://img.shields.io/badge/license-MIT-blue.svg?style=for-the-badge)](./LICENSE)
[![CI](https://img.shields.io/badge/CI-Passing-success.svg?style=for-the-badge)](https://github.com/topherchris420/cognisync-terrain-weaver/actions)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue.svg?style=for-the-badge)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF.svg?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge)](https://github.com/topherchris420/cognisync-terrain-weaver/pulls)

> **Point it at any city block. Get a quantitative climate-resilience diagnostic and hydrodynamic hydrograph back in seconds.**

**Mannahatta** is an open-source, full-stack geospatial intelligence platform. It turns satellite imagery and high-resolution SRTM elevation grids into real-time surface permeability ledgers, **Urban Absorption Scores**, cloudburst flood hydrographs, and actionable green-infrastructure adaptation roadmaps.

Engineers, urban planners, and municipal climate teams can stress-test depaving interventions, bioswales, green roofs, and tree canopy expansions, simulate **50 mm** design storm hydrographs with real D8 steepest-downhill flow accumulation, inspect animated vector particle flow paths, and generate publication-grade vector PDF dossiers, GeoJSON spatial layers, and tabular CSV analytical datasets.

---

## 🗺 Table of Contents

- [✨ Mission & Origins](#-mission--origins)
- [⚡ Key Capabilities](#-key-capabilities)
- [🏛 Architecture & Hydrodynamics](#-architecture--hydrodynamics)
- [📊 The Urban Absorption Score](#-the-urban-absorption-score)
- [🌿 The 1609 Ecological Baseline](#-the-1609-ecological-baseline)
- [🌊 Hydrological Storm Engine](#-hydrological-storm-engine)
- [🛠 Green Infrastructure Mitigation Studio](#-green-infrastructure-mitigation-studio)
- [📑 GIS Exports & Data Interoperability](#-gis-exports--data-interoperability)
- [💻 Tech Stack](#-tech-stack)
- [🚀 Quickstart Guide](#-quickstart-guide)
- [📁 Repository Blueprint](#-repository-blueprint)
- [🗺 Product Roadmap](#-product-roadmap)
- [🤝 Contributing & License](#-contributing--license)

---

## ✨ Mission & Origins

Before Manhattan was a dense grid of asphalt, concrete, and high-rises, it was **Mannahatta**—the "Island of Many Hills" as known by the Lenape people. In 1609, the island boasted over 66 miles of surface streams, rich freshwater wetlands, mature old-growth forests, and zero engineered impervious surfaces.

Modern cities have capped natural hydrology with impermeable gray infrastructure. During intense cloudburst precipitation, municipal drainage systems collapse under excess runoff.

**Mannahatta** bridges 400 years of environmental change by evaluating every urban block against its pre-development ecological potential, empowering cities to design nature-based stormwater solutions with precision and economic confidence.

---

## ⚡ Key Capabilities

| Capability | Engine / Module | Description |
|---|---|---|
| 🛰 **High-Res Satellite Canvas** | `MapView.tsx` | MapLibre GL raster/vector canvas backed by Esri World Imagery with Sentinel-2 cloudless fallback |
| 🔍 **Global Geocoding & Presets** | `LocationSearch.tsx` | OpenStreetMap Nominatim geocoder with quick-jump presets (*Manhattan*, *Copenhagen*, *Jakarta*, *Phoenix*, *Lagos*) |
| 📐 **Bounding Box Surface Calc** | `geo.ts` | Real-time viewport bounding box area calculation in $km^2$ and hectares ($ha$) |
| 🧪 **5-Class Surface Permeability** | `analyze-terrain` | Computer-vision satellite breakdown into *Vegetation*, *Bare Soil*, *Water*, *Buildings*, and *Pavement* |
| 🎯 **Urban Absorption Score (0–100)** | `absorption.ts` | Weighted surface permeability score with risk banding (*Resilient*, *Vulnerable*, *Critical*) |
| 🌲 **1609 Ecological Baseline** | `baseline.ts` | Pre-development reference benchmark ($79.1 / 100$) derived from Lenapehoking historical ecology |
| 🌊 **50 mm Cloudburst Simulation** | `run-simulation` | D8 hydrodynamic flow accumulation over SRTM elevation DEM grids ($m^3$ infiltration vs runoff) |
| 🌀 **Animated WebGL Flow Vectors** | `FlowLayer.tsx` | Particle flow direction paths and flood risk inundation heatmaps with toggleable layers |
| 🛠 **Mitigation Scenario Studio** | `ScenarioStudio.tsx` | Interactive polygon drawing for bioswales, green roofs, permeable pavement, and tree canopy |
| 🪞 **Counterfactual Comparison** | `CompareRealities.tsx` | Synchronized dual-map split-screen visual slider comparing baseline vs mitigated states |
| 📁 **GIS Dossier & Vector Export** | `pdf-export.ts` | One-click export of executive vector PDF dossiers, RFC 7946 GeoJSON layers, and tabular CSV datasets |

---

## 🏛 Architecture & Hydrodynamics

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND GIS WORKSTATION                                  │
│                      (React 18 + Vite + TypeScript + MapLibre GL)                     │
│                                                                                        │
│   ┌───────────────────────┐  viewport bbox  ┌──────────────────────────────────────┐   │
│   │ Map Canvas & Controls ├────────────────►│ Hydrodynamic Simulation Panel        │   │
│   └───────────┬───────────┘                 └──────────────────┬───────────────────┘   │
└───────────────┼────────────────────────────────────────────────┼───────────────────────┘
                │                                                │
                │ POST { image_data_url, bbox }                  │ POST { bbox, storm, surface }
                ▼                                                ▼
┌──────────────────────────────────────────┐   ┌──────────────────────────────────────────┐
│   Edge Function: analyze-terrain        │   │   Edge Function: run-simulation          │
│   (Deno / Supabase Functions)            │   │   (Deno / OpenTopography SRTM DEM API)   │
│                                          │   │                                          │
│   1. Gemini Vision Classification        │   │   1. Fetch SRTM 30 m Elevation Grid      │
│   2. 5-Class Surface Area Breakdown      │   │   2. Compute D8 Steepest Downhill Vectors│
│   3. Rational Method Runoff Weighting    │   │   3. Accumulate Storm Runoff Hydrograph  │
│   4. Absorption Score & Risk Banding     │   │   4. Generate Inundation Polygons        │
└───────────────────┬──────────────────────┘   └───────────────────┬──────────────────────┘
                    │                                              │
                    └──────────────────────┬───────────────────────┘
                                           ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              SUPABASE PERSISTENCE & CACHE                              │
│         (PostgreSQL + PostGIS + Terrain Analysis Cache + Hydro Simulation Cache)        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 📊 The Urban Absorption Score

The **Urban Absorption Score** is a standardized **0–100** index representing the fraction of precipitation naturally absorbed into the ground.

Each surface class weight ($w_i = 1 - C_i$) is calculated directly from the **Rational Method** runoff coefficient ($Q = CiA$), standard in urban stormwater hydrology (ASCE / Chow, Maidment & Mays):

```
             ∑ ( Area_i × Weight_i )
Absorption = ─────────────────────── × 100
                 Total Land Area
```

| Surface Class | Rational Coefficient ($C$) | Absorption Weight ($w_i$) | Hydrological Rationale |
|---|:---:|:---:|---|
| 🌿 **Vegetation** | `0.05 – 0.25` | **0.80** | Grassland, turf, and urban canopy absorb heavily, shedding 5%–25% in severe storms |
| 🪵 **Bare Soil** | `0.20 – 0.40` | **0.70** | Naturally permeable, though often compacted in dense urban conditions |
| 🏢 **Buildings** | `0.75 – 0.95` | **0.10** | Engineered roofs; virtually 100% impervious shedding direct runoff |
| 🛣 **Pavement** | `0.70 – 0.95` | **0.12** | Asphalt, concrete roads, parking lots, and sidewalks |
| 💧 **Water** | *Excluded* | *Excluded* | Open water bodies represent existing hydrologic storage; excluded from denominator |

### Flood Risk Banding Classification

- 🟢 **55 – 100 · Resilient (Low Risk)**: Natural soils and canopy absorb the vast majority of storm precipitation.
- 🟡 **35 – 54 · Vulnerable (Moderate Risk)**: Up to half of storm precipitation turns into surface runoff, straining municipal sewers.
- 🔴 **0 – 34 · Critical (High Risk)**: Two-thirds or more sheds immediately as surface runoff; extreme risk for cloudburst inundation.

---

## 🌿 The 1609 Ecological Baseline

Every scanned urban site is benchmarked against Manhattan’s **1609 pre-development ecological baseline**.

Based on Eric W. Sanderson's landmark *Welikia Project* (Wildlife Conservation Society), pre-colonial Mannahatta featured:
- **66 miles** of natural surface streams and creeks
- **21+** distinct wetland and marsh habitats
- **Zero** engineered impervious surfaces

Using Mannahatta's surface absorption formula, pre-development Manhattan scores **79.1 / 100** (not 100, because pristine woodland and soils still shed 5%–25% during intense storms). This historical benchmark gives cities a clear, scientifically honest target for urban ecological restoration.

---

## 🌊 Hydrological Storm Engine

When a user triggers a storm simulation, the hydro-engine models surface runoff under a **50 mm / 120 min design cloudburst event**:

```
                       D8 Steepest Downhill Direction Matrix

                                 [ -1, -1 ]  [ -1,  0 ]  [ -1, +1 ]
                                 [  0, -1 ]  [  0,  0 ]  [  0, +1 ]
                                 [ +1, -1 ]  [ +1,  0 ]  [ +1, +1 ]
```

1. **Elevation Grid Ingestion**: Retrieves real SRTM 30 m elevation data from OpenTopography (with fallback to synthetic topographic slope).
2. **D8 Hydrodynamic Routing**: Calculates downhill gradient vectors across all grid cells to establish stream channel convergence.
3. **Volumetric Hydrograph**:
   - $\text{Total Precipitation Volume } (m^3) = \text{Area } (m^2) \times 0.050\text{ m}$
   - $\text{Runoff Volume } (m^3) = \text{Area } (m^2) \times 0.050\text{ m} \times C_{\text{composite}}$
   - $\text{Infiltration Volume } (m^3) = \text{Total Volume} - \text{Runoff Volume}$
4. **WebGL Particle Rendering**: Displays real-time flow paths with velocity vectors scaled by accumulated discharge ($m^3/\text{s}$).

---

## 🛠 Green Infrastructure Mitigation Studio

Planners can draw custom intervention polygons over impervious surfaces to model green infrastructure retrofits in real time:

| Intervention Strategy | Target Surface | Effective Weight ($w_{\text{target}}$) | Unit Capital Cost |
|---|---|:---:|:---:|
| 🌳 **Urban Tree Canopy** | Pavement / Soil | **1.00** | $45 / m² |
| 🌾 **Bioswales & Rain Gardens** | Pavement | **0.90** | $65 / m² |
| 🧱 **Permeable Paving** | Pavement | **0.75** | $150 / m² |
| 🪴 **Extensive Green Roofs** | Buildings | **0.60** | $180 / m² |

### Investment & Impact Economics

The engine calculates financial and ecological ROI:
- **Absorption Gain**: $\Delta\text{Score} = \text{AreaFraction} \times (w_{\text{target}} - w_{\text{source}}) \times 100$
- **Annual Stormwater Retention Gain**: Expressed in $m^3 / \text{yr}$ saved from municipal storm sewers
- **Capital Expenditure (CAPEX)**: Total projected implementation cost in USD ($)
- **Payback Horizon**: Estimated break-even timeframe based on municipal stormwater utility fee offsets

---

## 📑 GIS Exports & Data Interoperability

- 📄 **Executive Vector PDF Dossiers**: Formatted multi-page reports complete with score gauges, land-cover ledgers, flood-risk warnings, and intervention economic tables (`pdf-export.ts`).
- 🗺 **RFC 7946 GeoJSON Layers**: Standard vector layers with spatial properties for direct import into **QGIS**, **ArcGIS Pro**, **Felt**, or **PostGIS**.
- 📊 **Tabular CSV Datasets**: Raw attribute spreadsheets for financial modeling and business intelligence tools.

---

## 💻 Tech Stack

### Frontend Client
- **Framework**: React 18, TypeScript, Vite 5
- **Styling & UI**: Tailwind CSS, Radix UI primitives, Lucide React icons, Sonner toasts
- **Map & Spatial Canvas**: MapLibre GL JS, `@turf/turf`, `@mapbox/mapbox-gl-draw`
- **Charts & Graphics**: Recharts, `html-to-image`, `jspdf`

### Edge Functions & Serverless Backend
- **Runtime**: Deno, TypeScript
- **Database & Auth**: Supabase Postgres + PostGIS, `@supabase/supabase-js`
- **Vision AI**: Google Gemini Vision API (`analyze-terrain`)
- **Topography API**: OpenTopography SRTM GL1 API (`run-simulation`)

### Verification & Testing
- **Test Runner**: Vitest, `@testing-library/react`, `jsdom` (50+ test suites, 290+ tests)
- **Linting & Types**: ESLint 9, TypeScript `tsc --noEmit`

---

## 🚀 Quickstart Guide

### Prerequisites
- **Node.js**: `v18.0.0` or higher
- **Package Manager**: `npm` (v9+) or `bun`

### Installation & Local Setup

```bash
# 1. Clone the repository
git clone https://github.com/topherchris420/cognisync-terrain-weaver.git
cd cognisync-terrain-weaver

# 2. Install dependencies
npm install

# 3. Launch Vite development server
npm run dev
```

Navigate to `http://localhost:8080` in your web browser.

### CLI Command Matrix

| Command | Action |
|---|---|
| `npm run dev` | Starts local Vite hot-reloading dev server |
| `npm run build` | Builds optimized production bundle in `dist/` |
| `npm test` | Runs complete Vitest test suite |
| `npm run typecheck` | Validates strict TypeScript compilation (`tsc --noEmit`) |
| `npm run lint` | Runs ESLint analysis across codebase |
| `npm run preview` | Previews local production build |

---

## 📁 Repository Blueprint

```
mannahatta/
├── src/
│   ├── pages/
│   │   ├── Analyze.tsx            # GIS Workstation (Map, Workbench Drawer, Storm Sim, Studio)
│   │   ├── Dashboard.tsx          # Public resilience portfolio & comparative analytics feed
│   │   ├── Auth.tsx               # User authentication
│   │   └── NotFound.tsx           # 404 Route
│   ├── components/
│   │   ├── AppNav.tsx             # Permanent workstation navigation bar
│   │   ├── MapView.tsx            # MapLibre GL raster/vector map canvas
│   │   ├── LocationSearch.tsx     # Nominatim geocoder + city quick-jump presets
│   │   ├── AbsorptionScoreGauge.tsx# Interactive 0–100 Absorption Score dial
│   │   ├── LandCoverBreakdown.tsx # 5-class land cover composition ledger & weights
│   │   ├── BaselineComparison.tsx # 1609 ecological benchmark comparison widget
│   │   ├── RecommendationsList.tsx# Prioritized green adaptation actions panel
│   │   ├── ScenarioStudio.tsx     # Green infrastructure ROI & parameter modeling studio
│   │   ├── FlowLayer.tsx          # WebGL animated flow vector overlay
│   │   ├── RiskHeatmap.tsx        # Inundation risk zone vector layer
│   │   ├── MapEditor.tsx          # Polygon drawing toolbar for mitigations
│   │   └── catalyst/
│   │       └── CompareRealities.tsx# Dual-map split-screen slider widget
│   ├── lib/
│   │   ├── absorption.ts          # Score calculation & risk band algorithms
│   │   ├── baseline.ts            # 1609 pre-development ecological model
│   │   ├── scenario.ts            # Mitigation ROI, CAPEX, and payback math
│   │   ├── simulation.ts          # Runoff depth & hydrograph volume calculations
│   │   ├── geo.ts                 # Viewport bounding box math, GeoJSON/CSV exporters
│   │   ├── geocode.ts             # Location search & city presets
│   │   └── pdf-export.ts          # Vector PDF dossier generator
│   └── integrations/
│       └── supabase/              # Supabase client & auto-generated DB types
└── supabase/
    └── functions/
        ├── analyze-terrain/       # Vision land-cover classification edge function
        └── run-simulation/        # D8 flow accumulation hydrology edge function
```

---

## 🗺 Product Roadmap

- 🟢 **v0.1 — Computer Vision Baseline** *(Released)*
  - Satellite land-cover classification into 5 permeability classes
  - Urban Absorption Score (0–100) & flood-risk banding
  - 1609 Mannahatta ecological baseline comparison
- 🟢 **v0.2 — Mitigation Scenario Studio** *(Released)*
  - Interactive intervention drawing (bioswales, tree canopy, green roofs, permeable paving)
  - CAPEX financial modeling & annual runoff reduction estimates
  - GeoJSON, CSV, and PDF dossier exports
- 🟢 **v0.3 — Hydrodynamic Storm Engine** *(Released)*
  - 50 mm cloudburst simulation over SRTM elevation DEM grids
  - D8 flow routing with animated WebGL particle flow vectors
  - Split-screen counterfactual reality comparison slider
- 🟡 **v0.4 — Sensor Telemetry & SWMM Integration** *(In Progress)*
  - Live IoT rain gauge and soil moisture sensor telemetry over MQTT
  - EPA SWMM (Storm Water Management Model) engine sync
- 🔵 **v1.0 — City Digital Twins & Open API** *(Planned)*
  - Autonomous city-wide digital twin monitoring
  - Open REST and GraphQL APIs for municipal integrations

---

## 🤝 Contributing & License

Contributions are eagerly welcomed! Whether you are calibrating Rational Method runoff coefficients for new climate zones, adding novel green-infrastructure interventions, or optimizing WebGL particle rendering:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/climate-intervention`)
3. Commit your changes (`git commit -m 'feat: add deep bioswale infiltration model'`)
4. Push to your branch (`git push origin feature/climate-intervention`)
5. Open a Pull Request

Distributed under the **MIT License**. See [`LICENSE`](./LICENSE) for details.

Built with 💚 by **[Vers3Dynamics](https://vers3dynamics.com)**.
