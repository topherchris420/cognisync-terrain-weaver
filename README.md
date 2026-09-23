```
███╗   ███╗   █████╗   ███╗   ██╗  ███╗   ██╗   █████╗   ██╗  ██╗   █████╗   ████████╗  ████████╗   █████╗
████╗ ████║  ██╔══██╗  ████╗  ██║  ████╗  ██║  ██╔══██╗  ██║  ██║  ██╔══██╗  ╚══██╔══╝  ╚══██╔══╝  ██╔══██╗
██╔████╔██║  ███████║  ██╔██╗ ██║  ██╔██╗ ██║  ███████║  ███████║  ███████║     ██║        ██║     ███████║
██║╚██╔╝██║  ██╔══██║  ██║╚██╗██║  ██║╚██╗██║  ██╔══██║  ██╔══██║  ██╔══██║     ██║        ██║     ██╔══██║
██║ ╚═╝ ██║  ██║  ██║  ██║ ╚████║  ██║ ╚████║  ██║  ██║  ██║  ██║  ██║  ██║     ██║        ██║     ██║  ██║
╚═╝     ╚═╝  ╚═╝  ╚═╝  ╚═╝  ╚═══╝  ╚═╝  ╚═══╝  ╚═╝  ╚═╝  ╚═╝  ╚═╝  ╚═╝  ╚═╝     ╚═╝        ╚═╝     ╚═╝  ╚═╝
```

# Mannahatta · Urban Resilience Intelligence

[![status](https://img.shields.io/badge/status-v0.4-brightgreen.svg?style=for-the-badge)](https://github.com/topherchris420/cognisync-terrain-weaver)
[![license](https://img.shields.io/badge/license-MIT-blue.svg?style=for-the-badge)](./LICENSE)
[![CI](https://img.shields.io/badge/CI-Passing-success.svg?style=for-the-badge)](https://github.com/topherchris420/cognisync-terrain-weaver/actions)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue.svg?style=for-the-badge)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF.svg?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge)](https://github.com/topherchris420/cognisync-terrain-weaver/pulls)

> **Explore how your neighborhood absorbs rainfall, predict flood risks, and design green solutions—right in your browser.**

---

## 💡 What is Mannahatta? 

**Mannahatta** is an easy-to-use, open-source web application that helps anyone—from curious residents to city planners—see how well city blocks handle rainwater and heavy storms.

### The Problem
In modern cities, concrete buildings and asphalt roads cover up natural soil and plants. When heavy rain hits, water cannot soak into the ground. Instead, it rushes down streets as **stormwater runoff**, overloading sewer systems and causing flash floods.

### The Solution
Mannahatta lets you point a map at any city neighborhood to immediately see:
1. **How much water the ground can absorb** (an *Urban Absorption Score* from 0 to 100).
2. **Where floodwater will flow** during severe storms.
3. **How adding nature back** (like planting trees, rain gardens, green roofs, or porous pavement) can reduce flooding and what it would cost.

---

## 🗺 Table of Contents

- [💡 What is Mannahatta?](#-what-is-mannahatta-in-plain-english)
- [✨ The Story Behind the Name](#-the-story-behind-the-name)
- [🚀 Quick Start: How to Use Mannahatta](#-quick-start-how-to-use-mannahatta)
- [🌿 Green Solutions You Can Test](#-green-solutions-you-can-test)
- [🔬 For Engineers & Scientists (Technical Deep-Dive)](#-for-engineers--scientists-technical-deep-dive)
  - [🏛 Architecture & Hydrodynamics](#-architecture--hydrodynamics)
  - [📊 The Urban Absorption Score Calculation](#-the-urban-absorption-score-calculation)
  - [🌊 Hydrological Storm Engine & D8 Flow](#-hydrological-storm-engine--d8-flow)
  - [📑 GIS Exports & Interoperability](#-gis-exports--interoperability)
- [💻 Tech Stack & Local Setup](#-tech-stack--local-setup)
- [📁 Repository Blueprint](#-repository-blueprint)
- [🗺 Product Roadmap](#-product-roadmap)
- [🤝 Contributing & License](#-contributing--license)

---

## ✨ The Story Behind the Name

Before New York City was a sea of concrete and skyscrapers, the island was known as **Mannahatta** ("Island of Many Hills") by the Lenape people. In 1609, the island had over 66 miles (106 km) of natural streams, lush wetlands, and thick forests that naturally absorbed rain.

Today, Mannahatta (the app) uses that 1609 natural baseline as a benchmark ($79.1 / 100$). It compares modern concrete neighborhoods against their original natural potential, showing us how we can bring nature back into our cities to prevent flooding.

---

## 🚀 Quick Start: How to Use Mannahatta

You don't need any special engineering knowledge to use Mannahatta! Here is how to get started in 4 simple steps:

### 1. Choose a Location 📍
Search for any address or city block (or pick a preset like *Manhattan*, *Copenhagen*, *Jakarta*, *Phoenix*, or *Lagos*).

### 2. View the Absorption Score 📊
Mannahatta analyzes satellite imagery to classify ground surfaces into 5 types: *Vegetation*, *Bare Soil*, *Water*, *Buildings*, and *Pavement*. You get an **Urban Absorption Score (0–100)**:
- 🟢 **Resilient (55–100)**: Parks and soil absorb most rainfall naturally. Low flood risk.
- 🟡 **Vulnerable (35–54)**: Moderate concrete cover. Up to half of rainfall turns into runoff.
- 🔴 **Critical (0–34)**: Mostly concrete and asphalt. High flood risk during storms.

### 3. Simulate a Storm 🌧
Run a **50 mm** storm simulation to watch simulated rain flow across the 3D terrain. Animated arrows show downhill water flow paths and high-risk flood accumulation areas.

### 4. Design Green Infrastructure 🌳
Use the built-in drawing tool to draw green solutions directly on the map. Instantly see how much stormwater they save, how much the score improves, and the estimated setup cost. Compare "Before" and "After" maps with an interactive split-screen slider!

---

## 🌿 Green Solutions You Can Test

In the app's **Mitigation Studio**, you can draw 4 types of nature-based solutions ("green infrastructure") over paved or roof areas:

| Green Solution | What It Does | Best Used On |
|---|---|---|
| 🌳 **Tree Canopy** | Tree leaves catch rain and root systems absorb ground water. | Sidewalks, parking lots, open ground |
| 🌾 **Bioswales & Rain Gardens** | Shallow, vegetated ditches designed to collect and soak up rainwater runoff. | Pavement edges, road shoulders |
| 🧱 **Permeable Pavement** | Special porous asphalt or brick pavers that allow water to drain straight through. | Parking lots, sidewalks, driveways |
| 🪴 **Green Roofs** | Planted rooftop gardens that capture rain before it reaches street level. | Building rooftops |

The app automatically calculates the estimated implementation cost (CAPEX in USD) and how many cubic meters ($m^3$) of stormwater runoff are saved each year.

---

## 🔬 For Engineers & Scientists (Technical Deep-Dive)

> **Note for developers, GIS analysts, and hydrologists:** The sections below cover the mathematical models, edge functions, raster algorithms, and tech stack driving Mannahatta.

### Workbench Capabilities

Open **Explore an example**, then **Mitigation** to try the rainfall sensitivity workbench without requiring an analysis-service request. Compare current and proposed runoff across 0–200 mm of rain, inspect conserved water budgets, and expand the chart's exact data table. This is a fixed-coefficient, land-only planning estimate, distinct from the terrain-routed D8 storm; saturation, sewer capacity, flood depth, and peak discharge are not inferred from this chart.

Physical intervention areas and costs exclude open water. Absorption scores remain normalized over land; retention volumes use unrounded coefficients so small interventions retain their benefit. See [delivery and validation scope](docs/elevation-delivery.md).

### 🏛 Architecture & Hydrodynamics

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

### 📊 The Urban Absorption Score Calculation

The **Urban Absorption Score** is a standardized **0–100** index representing the fraction of precipitation naturally absorbed into the ground.

Each surface class weight ($w_i = 1 - C_i$) is calculated directly from the **Rational Method** runoff coefficient ($Q = C i A$), standard in urban stormwater hydrology (ASCE / Chow, Maidment & Mays):

$$\text{Absorption} = \frac{\sum (\text{Area}_i \times w_i)}{\text{Total Land Area}} \times 100$$

| Surface Class | Rational Coefficient ($C$) | Absorption Weight ($w_i$) | Hydrological Rationale |
|---|:---:|:---:|---|
| 🌿 **Vegetation** | `0.05 – 0.25` | **0.80** | Grassland, turf, and urban canopy absorb heavily, shedding 5%–25% in severe storms |
| 🪵 **Bare Soil** | `0.20 – 0.40` | **0.70** | Naturally permeable, though often compacted in dense urban conditions |
| 🏢 **Buildings** | `0.75 – 0.95` | **0.10** | Engineered roofs; virtually 100% impervious shedding direct runoff |
| 🛣 **Pavement** | `0.70 – 0.95` | **0.12** | Asphalt, concrete roads, parking lots, and sidewalks |
| 💧 **Water** | *Excluded* | *Excluded* | Open water bodies represent existing hydrologic storage; excluded from denominator |

### 🌊 Hydrological Storm Engine & D8 Flow

Storm routing runs directly **in the browser**. The same sealed storm and terrain are applied to NOW (classified land cover) and POSSIBLE (drawn green infrastructure). The live OpenTopography edge function is no longer required for a closed water-balance.

When a user triggers a storm simulation, the engine models a **50 mm / 60 min** uniform design cloudburst:

```
                       D8 Steepest Downhill Direction Matrix

                                 [ -1, -1 ]  [ -1,  0 ]  [ -1, +1 ]
                                 [  0, -1 ]  [  0,  0 ]  [  0, +1 ]
                                 [ +1, -1 ]  [ +1,  0 ]  [ +1, +1 ]
```

1. **Elevation**: Mapzen Terrarium tiles (SRTM-derived, CORS-open) sampled onto the study grid. If tiles are unreachable, a deterministic slope surface is used and labeled *illustrative*.
2. **Land-cover retention**: Each cell starts at $1 - C$, where $C$ is the composite Rational Method runoff coefficient of the classified mix. Drawn interventions add a retention delta only on overlaying cells.
3. **D8 routing**: Steepest-downhill accumulation, flow paths, inundation zones, and impact points.
4. **Closed water-balance**: $\text{rainfall} = \text{infiltrated} + \text{stored} + \text{runoff}$, plus an SCS-style triangular hydrograph scaled so $\int Q \, dt$ equals runoff volume.
5. **Paired identities**: NOW and POSSIBLE share one storm hash and one elevation hash. Comparison is prevented until those identities match.

### 📑 GIS Exports & Interoperability

- 📄 **Executive Vector PDF Dossiers**: Formatted multi-page reports complete with score gauges, land-cover ledgers, flood-risk warnings, and intervention economic tables (`pdf-export.ts`).
- 🗺 **RFC 7946 GeoJSON Layers**: Standard vector layers with spatial properties for direct import into **QGIS**, **ArcGIS Pro**, **Felt**, or **PostGIS**.
- 📊 **Tabular CSV Datasets**: Raw attribute spreadsheets for financial modeling and business intelligence tools.

---

## 💻 Tech Stack & Local Setup

### Tech Stack
- **Frontend Client**: React 18, TypeScript, Vite 5, Tailwind CSS, Lucide React icons, Radix UI
- **Maps & GIS Canvas**: MapLibre GL JS, `@turf/turf`, `@mapbox/mapbox-gl-draw`
- **Charts & Reports**: Recharts, `html-to-image`, `jspdf`
- **Edge Backend**: Deno, TypeScript, Supabase Postgres + PostGIS
- **AI & Computer Vision**: Google Gemini Vision API (`analyze-terrain`) for live land-cover classification
- **Terrain Data**: Mapzen Terrarium DEM tiles (client-side) / OpenTopography API (edge function)
- **Testing**: Vitest, ESLint 9, TypeScript `tsc --noEmit`

### Prerequisites
- **Node.js**: `v18.0.0` or higher
- **Package Manager**: `npm` (v9+)

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

Navigate to `http://localhost:43147` in your web browser.

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
  - 50 mm cloudburst simulation over elevation DEM grids
  - D8 flow routing with animated WebGL particle flow vectors
  - Split-screen counterfactual reality comparison slider
- 🟢 **v0.4 — Local-first hydrology & 3D terrain** *(Released)*
  - Browser D8 engine with land-cover retention and intervention modifiers
  - Closed water-balance, SCS hydrograph, Terrarium DEM, 3D hillshade
  - NOW and POSSIBLE are distinct routed surfaces under one sealed storm
- 🟡 **v0.5 — Sensor Telemetry & SWMM Integration** *(In Progress)*
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
