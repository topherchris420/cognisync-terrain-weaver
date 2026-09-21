# Hydrological Runoff Simulation — Design Specification

**Version:** 1.0  
**Status:** Approved  
**Date:** 2026-07-14

---

## 1. Overview

Add hydrological runoff simulation capability to the Vers3Dynamics platform. This feature enables users to visualize water flow paths on the map and quantify flood risk at any point. It combines animated flow visualizations with quantitative risk assessment using elevation data, land-cover classification, and user-configured rainfall amounts.

---

## 2. Goals

- Visualize water flow direction across terrain on the interactive map
- Calculate and display flood risk zones (low → moderate → high → severe)
- Allow users to click any point to see accumulated water volume and flood depth
- Provide configurable rainfall input for scenario modeling

---

## 3. Architecture

### 3.1 System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                         │
│  ┌─────────────────┐    ┌─────────────────┐                    │
│  │  MapComponent  │    │  SimulationPanel │                   │
│  │  - FlowLayer   │    │  - Config UI     │                    │
│  │  - RiskHeatmap │    │  - Results View  │                   │
│  └────────┬────────┘    └────────┬────────┘                   │
│           │                      │                             │
│           ▼                      ▼                             │
│  ┌─────────────────────────────────────────┐                   │
│  │       SimulationEngine (client)         │                   │
│  │  - Basic flow direction                  │                   │
│  │  - Instant visualization                 │                   │
│  └─────────────────┬───────────────────────┘                   │
└────────────────────┼────────────────────────────────────────────┘
                     │
                     ▼ POST /run-simulation
┌────────────────────────────────────────────────────────────────┐
│                    Edge Function (Server)                       │
│  ┌─────────────────┐    ┌─────────────────┐                    │
│  │ ElevationService│    │  FlowCalculator │                   │
│  │  - SRTM fetch   │    │  - Volume calc  │                    │
│  │  - Cache mgmt   │    │  - Risk scoring │                   │
│  └─────────────────┘    └─────────────────┘                    │
└────────────────────────────────────────────────────────────────┘
```

### 3.2 Component Responsibilities

| Component | Responsibility |
|-----------|----------------|
| SimulationPanel (client) | Config UI, rainfall slider, run button, results display |
| FlowLayer (client) | Renders animated flow lines on MapLibre |
| RiskHeatmap (client) | Renders risk zone polygons on map |
| SimulationEngine (client) | Instant flow direction based on land-cover |
| ElevationService (server) | Fetches SRTM tiles, caches for reuse |
| FlowCalculator (server) | Heavy computation: volume, risk scoring |

---

## 4. Data Flow

### 4.1 User Journey

1. **Configure** — User adjusts rainfall slider (10mm, 50mm, 100mm)
2. **Instant Feedback** — Client renders flow direction arrows immediately
3. **Deep Analysis** — User clicks "Run Full Simulation"
4. **Server Processing** — Edge function fetches SRTM, calculates flow, returns results
5. **Visualize** — Client overlays animated flow lines + risk heatmap
6. **Inspect** — User clicks point → popup shows volume, risk, drainage area

### 4.2 Data Storage

- Simulation results cached in Postgres for 24h
- Elevation tiles cached in Supabase Storage

---

## 5. API Contracts

### 5.1 Request (Client → Edge Function)

```typescript
POST /run-simulation
{
  bbox: { north: number, south: number, east: number, west: number },
  rainfall_mm: number,
  resolution: "low" | "medium" | "high",
  include_drainage: boolean
}
```

### 5.2 Response (Edge Function → Client)

```typescript
{
  flow_paths: FlowPath[],
  risk_zones: RiskZone[],
  impact_points: ImpactPoint[],
  metadata: {
    processed_area_km2: number,
    cells_analyzed: number,
    computation_time_ms: number
  }
}

interface FlowPath {
  points: [lat, lng][],
  volume_m3: number,
  velocity_mps: number
}

interface RiskZone {
  polygon: [lat, lng][],
  level: "low" | "moderate" | "high" | "severe",
  affected_area_km2: number
}

interface ImpactPoint {
  location: [lat, lng],
  accumulated_volume_m3: number,
  flood_depth_m: number,
  risk_level: string
}
```

---

## 6. Visual Output

- **Animated flow lines** — Blue arrows showing water flow direction
- **Risk zone heatmap** — Color-coded zones (green → yellow → orange → red)
- **Interactive inspection** — Click any point for detailed metrics

---

## 7. Data Sources

| Data | Source |
|------|--------|
| Elevation | SRTM (free public API) |
| Drainage | OpenStreetMap |
| Land-cover | Already available from existing analysis |

---

## 8. Error Handling

| Scenario | Handling |
|----------|----------|
| SRTM unavailable | Fall back to slope-from-land-cover; show warning |
| Area too large | Limit to 1km² max; show "zoom in" message |
| User cancels | Server abort; discard partial results |
| Cache miss / cold start | Show loading state with progress |
| Invalid bbox | Show "Area not supported" message |

---

## 9. Scope

### In Scope (v0.2)

- SRTM elevation fetching + caching
- Basic flow accumulation algorithm
- Risk zone calculation
- Map visualization (flow lines + heatmap)
- Click-to-inspect points

### Out of Scope (defer to v0.3+)

- OSM drainage infrastructure
- Historical rainfall patterns
- Real-time sensor ingestion
- 3D terrain visualization

---

## 10. Acceptance Criteria

1. User can configure rainfall amount via slider
2. Flow direction arrows appear on map instantly (client-side)
3. Full simulation returns flow paths + risk zones within 10 seconds
4. User can click any point to see accumulated volume and flood depth
5. Risk zones displayed with clear color coding (low/moderate/high/severe)
6. Graceful fallbacks when external data sources unavailable
7. Results cached for 24h to enable fast re-renders