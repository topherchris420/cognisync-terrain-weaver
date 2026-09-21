# Hydrological Runoff Simulation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add hydrological runoff simulation that visualizes water flow paths on the map and quantifies flood risk using elevation data and user-configured rainfall.

**Architecture:** Tiered hybrid — client provides instant flow direction visualization using land-cover data, server performs heavy flow accumulation and risk zone calculations using SRTM elevation data.

**Tech Stack:** React + TypeScript + MapLibre GL + Supabase Edge Functions (Deno) + SRTM API

## Global Constraints

- Must integrate with existing Analyze page flow
- Use existing shadcn/ui components
- Follow existing naming patterns (camelCase functions, PascalCase types)
- Cache results in Postgres for 24h
- Limit simulation area to 1km² max

---

## File Structure

### New Files to Create

| File | Responsibility |
|------|----------------|
| `src/components/SimulationPanel.tsx` | Config UI: rainfall slider, run button, results display |
| `src/components/FlowLayer.tsx` | Renders animated flow direction arrows on map |
| `src/components/RiskHeatmap.tsx` | Renders risk zone polygons on map |
| `src/lib/simulation.ts` | Client-side SimulationEngine for instant feedback |
| `src/lib/simulation-types.ts` | TypeScript interfaces for simulation data |
| `supabase/functions/run-simulation/index.ts` | Edge function for full analysis |

### Existing Files to Modify

| File | Change |
|------|--------|
| `src/pages/Analyze.tsx` | Add simulation panel, integrate FlowLayer/RiskHeatmap |
| `src/lib/types.ts` | Add simulation types if needed |
| `src/components/MapView.tsx` | Expose methods to add/remove simulation layers |

---

## Task 1: Create Simulation Types

**Files:**
- Create: `src/lib/simulation-types.ts`

**Interfaces (exact as per spec):**

```typescript
export interface SimulationRequest {
  bbox: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  rainfall_mm: number;
  resolution: "low" | "medium" | "high";
  include_drainage: boolean;
}

export interface FlowPath {
  points: [number, number][];
  volume_m3: number;
  velocity_mps: number;
}

export interface RiskZone {
  polygon: [number, number][];
  level: "low" | "moderate" | "high" | "severe";
  affected_area_km2: number;
}

export interface ImpactPoint {
  location: [number, number];
  accumulated_volume_m3: number;
  flood_depth_m: number;
  risk_level: string;
}

export interface SimulationResponse {
  flow_paths: FlowPath[];
  risk_zones: RiskZone[];
  impact_points: ImpactPoint[];
  metadata: {
    processed_area_km2: number;
    cells_analyzed: number;
    computation_time_ms: number;
  };
}
```

- [ ] **Step 1: Write simulation-types.ts**

Create file with all interfaces above.

- [ ] **Step 2: Commit**

```bash
git add src/lib/simulation-types.ts
git commit -m "feat(types): add simulation type definitions"
```

---

## Task 2: Create Client-Side SimulationEngine

**Files:**
- Create: `src/lib/simulation.ts`

**Purpose:** Provides instant flow direction visualization using only land-cover data (no server needed). This is the client-side "quick feedback" before user runs full simulation.

**Interface:**
- Consumes: `land_cover` from existing analysis result
- Produces: `{ direction: 'downhill' | 'lateral' | 'uphill', points: [lat, lng][] }[]`

```typescript
import type { LandCoverKey } from "./types";

const FLOW_DIRECTION: Record<LandCoverKey, number> = {
  vegetation: 0.1,  // high infiltration
  soil: 0.15,
  water: 0.5,
  buildings: 0.95,  // water flows off
  pavement: 0.9,
};

/**
 * Calculate basic flow directions from land-cover data.
 * Returns direction vectors for rendering quick-feedback arrows.
 */
export function calculateFlowDirections(
  landCover: Record<LandCoverKey, number>,
  gridResolution: number
): { direction: string; points: [number, number][] }[] {
  // Implementation uses land-cover weights to determine flow
  // Returns array of direction vectors
}

export function getFlowColor(intensity: number): string {
  // Returns blue with opacity based on flow intensity
}
```

- [ ] **Step 1: Write simulation.ts with calculateFlowDirections function**

- [ ] **Step 2: Commit**

```bash
git add src/lib/simulation.ts
git commit -m "feat: add client-side simulation engine"
```

---

## Task 3: Create FlowLayer Component

**Files:**
- Create: `src/components/FlowLayer.tsx`

**Purpose:** Renders animated flow direction arrows on the MapLibre map.

**Interface:**
- Props: `flowPaths?: FlowPath[]` (from simulation response)
- Exposes: `addToMap()`, `removeFromMap()`, `updatePaths()`

```typescript
import { useMap } from "react-map-gl/maplibre";
import type { FlowPath } from "@/lib/simulation-types";

interface FlowLayerProps {
  flowPaths?: FlowPath[];
}

export function FlowLayer({ flowPaths }: FlowLayerProps) {
  // Uses MapLibre addLayer with line type
  // Animated dashed lines with arrow symbols
  // Colors: blue (#3b82f6) with varying opacity
}
```

- [ ] **Step 1: Write FlowLayer.tsx**

Use MapLibre's `addLayer` with line layer type. Use `line-dasharray` for animation effect.

- [ ] **Step 2: Commit**

```bash
git add src/components/FlowLayer.tsx
git commit -m "feat: add FlowLayer component for map visualization"
```

---

## Task 4: Create RiskHeatmap Component

**Files:**
- Create: `src/components/RiskHeatmap.tsx`

**Purpose:** Renders risk zone polygons on the map with color coding.

**Interface:**
- Props: `riskZones?: RiskZone[]`
- Colors: low=green (#22c55e), moderate=yellow (#eab308), high=orange (#f97316), severe=red (#ef4444)

```typescript
import { useMap } from "react-map-gl/maplibre";
import type { RiskZone } from "@/lib/simulation-types";

interface RiskHeatmapProps {
  riskZones?: RiskZone[];
}

export function RiskHeatmap({ riskZones }: RiskHeatmapProps) {
  // Uses fill layer type with transparency
  // Each risk level has distinct color and 40% opacity
}
```

- [ ] **Step 1: Write RiskHeatmap.tsx**

- [ ] **Step 2: Commit**

```bash
git add src/components/RiskHeatmap.tsx
git commit -m "feat: add RiskHeatmap component for risk visualization"
```

---

## Task 5: Create SimulationPanel Component

**Files:**
- Create: `src/components/SimulationPanel.tsx`

**Purpose:** Configuration UI in the Analyze page sidebar — rainfall slider, run button, results display.

**Interface:**
- Props: `onRunSimulation: (params) => void`, `simulationResult?: SimulationResponse`, `isLoading?: boolean`
- Internal state: `rainfall_mm`, `resolution`

```typescript
import { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { SimulationRequest, SimulationResponse } from "@/lib/simulation-types";

interface SimulationPanelProps {
  onRunSimulation: (params: SimulationRequest) => void;
  simulationResult?: SimulationResponse;
  isLoading?: boolean;
}

export function SimulationPanel({
  onRunSimulation,
  simulationResult,
  isLoading,
}: SimulationPanelProps) {
  const [rainfallMm, setRainfallMm] = useState(50);
  const [resolution, setResolution] = useState<"low" | "medium" | "high">("medium");

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Runoff Simulation</h3>

      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">
          Rainfall: {rainfallMm}mm
        </label>
        <Slider
          value={[rainfallMm]}
          onValueChange={([v]) => setRainfallMm(v)}
          min={10}
          max={200}
          step={10}
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">Resolution</label>
        <select
          value={resolution}
          onChange={(e) => setResolution(e.target.value as typeof resolution)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="low">Low (faster)</option>
          <option value="medium">Medium</option>
          <option value="high">High (slower)</option>
        </select>
      </div>

      <Button
        onClick={() => onRunSimulation({ rainfall_mm: rainfallMm, resolution })}
        disabled={isLoading}
        className="w-full"
      >
        {isLoading ? "Simulating..." : "Run Full Simulation"}
      </Button>

      {simulationResult && (
        <div className="mt-4 space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Area:</span>
            <span>{simulationResult.metadata.processed_area_km2.toFixed(2)} km²</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Risk zones:</span>
            <span>{simulationResult.risk_zones.length}</span>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 1: Write SimulationPanel.tsx**

- [ ] **Step 2: Commit**

```bash
git add src/components/SimulationPanel.tsx
git commit -m "feat: add SimulationPanel component"
```

---

## Task 6: Create Edge Function — run-simulation

**Files:**
- Create: `supabase/functions/run-simulation/index.ts`

**Purpose:** Server-side simulation with SRTM elevation data.

**Interface:**
- Endpoint: POST /run-simulation
- Request body: `{ bbox, rainfall_mm, resolution, include_drainage }`
- Response: SimulationResponse

```typescript
import { serve } from "std/http/server.ts";
import { createClient } from "@supabase/supabase-js.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// SRTM tile API base URL
const SRTM_API = "https://portal.opentopography.org/API/globaldem";

interface FlowPath {
  points: [number, number][];
  volume_m3: number;
  velocity_mps: number;
}

interface RiskZone {
  polygon: [number, number][];
  level: "low" | "moderate" | "high" | "severe";
  affected_area_km2: number;
}

// Fetch elevation data from SRTM
async function fetchElevationData(bbox: {
  north: number;
  south: number;
  east: number;
  west: number;
}): Promise<number[][]> {
  // Use OpenTopography API or fall back to simple approximation
  // Returns 2D array of elevation values
}

// Calculate flow accumulation
function calculateFlowAccumulation(
  elevation: number[][],
  rainfallMm: number,
  resolution: string
): { paths: FlowPath[]; riskZones: RiskZone[] } {
  // Core hydrological algorithm:
  // 1. Determine flow direction (steepest descent)
  // 2. Calculate accumulation (D8 algorithm)
  // 3. Compute risk zones based on accumulation thresholds

  // Returns flow paths and risk zones
}

// Check cache before computation
async function getCachedResult(
  bbox: { north: number; south: number; east: number; west: number },
  rainfallMm: number
): Promise<any | null> {
  const { data } = await supabase
    .from("simulation_cache")
    .select("*")
    .eq("bbox_north", bbox.north)
    .eq("bbox_south", bbox.south)
    .eq("bbox_east", bbox.east)
    .eq("bbox_west", bbox.west)
    .eq("rainfall_mm", rainfallMm)
    .gt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .single();

  return data?.result || null;
}

// Cache result
async function cacheResult(
  bbox: { north: number; south: number; east: number; west: number },
  rainfallMm: number,
  result: any
) {
  await supabase.from("simulation_cache").insert({
    bbox_north: bbox.north,
    bbox_south: bbox.south,
    bbox_east: bbox.east,
    bbox_west: bbox.west,
    rainfall_mm: rainfallMm,
    result,
    created_at: new Date().toISOString(),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  try {
    const { bbox, rainfall_mm, resolution, include_drainage } = await req.json();

    // Validate bbox area (max 1km²)
    const latDiff = bbox.north - bbox.south;
    const lngDiff = bbox.east - bbox.west;
    const approxAreaKm2 = (latDiff * 111) * (lngDiff * 111 * Math.cos(bbox.south * Math.PI / 180));
    if (approxAreaKm2 > 1) {
      return new Response(
        JSON.stringify({ error: "Area too large. Please zoom in to under 1km²." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check cache
    const cached = await getCachedResult(bbox, rainfall_mm);
    if (cached) {
      return new Response(JSON.stringify(cached), {
        headers: { "Content-Type": "application/json", "Cache-Hit": "true" },
      });
    }

    const startTime = Date.now();

    // Fetch elevation
    const elevation = await fetchElevationData(bbox);

    // Calculate flow and risk
    const { paths, riskZones } = calculateFlowAccumulation(elevation, rainfall_mm, resolution);

    const result = {
      flow_paths: paths,
      risk_zones: riskZones,
      impact_points: [], // Populated on-demand when user clicks
      metadata: {
        processed_area_km2: approxAreaKm2,
        cells_analyzed: elevation.length * elevation[0].length,
        computation_time_ms: Date.now() - startTime,
      },
    };

    // Cache result
    await cacheResult(bbox, rainfall_mm, result);

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
```

- [ ] **Step 1: Write run-simulation edge function**

- [ ] **Step 2: Create cache table in Supabase**

SQL:
```sql
CREATE TABLE simulation_cache (
  id SERIAL PRIMARY KEY,
  bbox_north NUMERIC,
  bbox_south NUMERIC,
  bbox_east NUMERIC,
  bbox_west NUMERIC,
  rainfall_mm NUMERIC,
  result JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_simulation_cache_lookup
ON simulation_cache (bbox_north, bbox_south, bbox_east, bbox_west, rainfall_mm);
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/run-simulation/index.ts
git commit -m "feat: add run-simulation edge function"
```

---

## Task 7: Integrate Simulation Components into Analyze Page

**Files:**
- Modify: `src/pages/Analyze.tsx`
- Modify: `src/components/MapView.tsx` (if needed to expose layer methods)

**Changes:**

1. Import SimulationPanel, FlowLayer, RiskHeatmap
2. Add state for simulation result and loading
3. Add "Run Simulation" button in sidebar (or make existing analysis trigger simulation)
4. Connect SimulationPanel to edge function call
5. Pass results to FlowLayer and RiskHeatmap

```typescript
// In Analyze.tsx, add:
const [simulationResult, setSimulationResult] = useState<SimulationResponse | null>(null);
const [simulationLoading, setSimulationLoading] = useState(false);

const runSimulation = async (params: SimulationRequest) => {
  setSimulationLoading(true);
  try {
    const { data, error } = await supabase.functions.invoke("run-simulation", {
      body: {
        ...params,
        bbox: mapRef.current?.getBounds(),
      },
    });
    if (error) throw error;
    setSimulationResult(data);
  } catch (e) {
    toast.error("Simulation failed: " + e.message);
  } finally {
    setSimulationLoading(false);
  }
};

// In the results section:
{analysisResult && (
  <SimulationPanel
    onRunSimulation={runSimulation}
    simulationResult={simulationResult}
    isLoading={simulationLoading}
  />
)}

{simulationResult && (
  <>
    <FlowLayer flowPaths={simulationResult.flow_paths} />
    <RiskHeatmap riskZones={simulationResult.risk_zones} />
  </>
)}
```

- [ ] **Step 1: Modify Analyze.tsx to integrate simulation**

- [ ] **Step 2: Test the integration**

Run `npm run dev` and verify:
- Slider appears and updates value
- "Run Full Simulation" button triggers edge function call
- Flow lines appear on map after simulation completes
- Risk zones appear with correct colors

- [ ] **Step 3: Commit**

```bash
git add src/pages/Analyze.tsx
git commit -m "feat: integrate simulation into Analyze page"
```

---

## Task 8: Add Click-to-Inspect Popup

**Files:**
- Modify: `src/components/RiskHeatmap.tsx` or create new `src/components/ImpactPointPopup.tsx`

**Purpose:** Allow users to click on any point to see accumulated volume and flood depth.

**Implementation:**
- Add click handler to risk zones and flow paths
- On click, call edge function with point location for detailed analysis
- Show popup with ImpactPoint data

```typescript
// Add to RiskHeatmap or create new component:
onClick={(event) => {
  const { lngLat } = event;
  fetchImpactPoint(lngLat.lat, lngLat.lng);
}}
```

- [ ] **Step 1: Add click handler for inspection**

- [ ] **Step 2: Commit**

```bash
git add src/components/RiskHeatmap.tsx
git commit -m "feat: add click-to-inspect for impact points"
```

---

## Task 9: Error Handling & Fallbacks

**Files:**
- Modify: Edge function and client components

**Implement all error scenarios from spec:**

1. SRTM unavailable → use slope-from-land-cover approximation
2. Area too large → show "zoom in" message (already in code)
3. User cancels → handle AbortController
4. Cache miss → show loading with progress
5. Invalid bbox → show "Area not supported"

- [ ] **Step 1: Add fallback elevation logic in edge function**

```typescript
async function fetchElevationData(bbox) {
  try {
    // Try SRTM
    return await fetchSRTM(bbox);
  } catch {
    // Fallback: approximate from land-cover
    console.warn("SRTM unavailable, using fallback");
    return createFallbackElevation(bbox);
  }
}
```

- [ ] **Step 2: Add user-facing error messages in SimulationPanel**

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/run-simulation/index.ts src/components/SimulationPanel.tsx
git commit -m "fix: add error handling and fallbacks"
```

---

## Task 10: End-to-End Testing

**Verification against spec acceptance criteria:**

- [ ] User can configure rainfall amount via slider
- [ ] Flow direction arrows appear on map instantly (client-side)
- [ ] Full simulation returns flow paths + risk zones within 10 seconds
- [ ] User can click any point to see accumulated volume and flood depth
- [ ] Risk zones displayed with clear color coding
- [ ] Graceful fallbacks when external data sources unavailable
- [ ] Results cached for 24h

- [ ] **Run full test suite**

```bash
# Test with different locations
# Test with different rainfall amounts
# Test edge cases (area too large, invalid bbox)
# Verify cache is working
```

- [ ] **Commit final changes**

```bash
git add -A && git commit -m "feat: complete hydrological runoff simulation v0.2"
```

---

## Summary

| Task | Deliverable |
|------|-------------|
| 1 | Type definitions |
| 2 | Client-side simulation engine |
| 3 | FlowLayer for map visualization |
| 4 | RiskHeatmap for zones |
| 5 | SimulationPanel UI |
| 6 | Edge function with SRTM |
| 7 | Integrate into Analyze page |
| 8 | Click-to-inspect |
| 9 | Error handling |
| 10 | E2E testing |

**Plan complete and saved to `docs/superpowers/plans/2026-07-14-hydrological-runoff-simulation.md`.**

Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?