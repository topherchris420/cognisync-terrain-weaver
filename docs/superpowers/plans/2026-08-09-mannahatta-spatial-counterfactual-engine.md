# Mannahatta Spatial Counterfactual Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Mannahatta into a map-first NYC spatial counterfactual engine where a user storms the current city, edits real map geometry, reruns the identical storm, and compares the physically changed future.

**Architecture:** Introduce one canonical `CounterfactualSession` that owns place, evidence, edits, immutable storm, paired surfaces, paired simulations, time, comparison, and export lineage. Keep the existing React, MapLibre, Supabase, D8 routing, absorption, scenario-economics, Catalyst, and export foundations, but move scientific logic behind strict pure contracts and render the product as map chrome over synchronized reality scenes.

**Tech Stack:** React 18, TypeScript 5.5, Vite 5, MapLibre GL 5, Mapbox GL Draw, Turf 7, Supabase Edge Functions, PostgreSQL, Tailwind/shadcn, Zod 4, Vitest 4, React Testing Library.

## Global Constraints

- Do not add npm, Deno, Python, or native runtime dependencies.
- Preserve the existing absorption weights, scenario economics, Catalyst behavior, simulation-area cap of 50 km², legacy exports, routes, and passing tests.
- Manhattan/NYC is the high-confidence release area. Outside NYC, label lower-resolution or partial fallback data explicitly.
- Never fabricate historical geometry, source precision, sewer behavior, surveyed terrain changes, or a successful optimization result.
- NOW and POSSIBLE must use one immutable `StormDefinition`, one storm hash, one model version, and the same elevation surface.
- `includeDrainage` must remain `false` and unsupported true values must fail validation.
- Immediate edit metrics are labeled `estimated until storm rerun`; only a completed hydrology response is labeled `modeled`.
- Every spatial layer, derived surface, simulation, Catalyst strategy, shared session, and counterfactual export must carry provenance and scientific status.
- The official NYC 2017 six-inch land-cover raster is cataloged as observed evidence, but it is not presented as browser-available unless a real processed tile endpoint exists. The initial live overlay uses an explicit partial composite of official NYC vectors and an `unclassified` remainder.
- Observed tree inventory points remain points; do not manufacture canopy polygons.
- 1609 geometry is data-gated. When no approved licensed spatial asset exists, the camera and present map remain visible and the UI explains that spatial reconstruction is unavailable.
- The root route is a full-viewport map. No permanent dashboard sidebar competes with it.
- Keyboard access, visible focus, touch targets, reduced motion, screen-reader labels, and responsive behavior are release requirements.
- Painting plus client-side projection must complete within 150 ms for supported viewports.
- All commits use the repository Lore Commit Protocol, including verification and known-gap trailers.

---

## File and Responsibility Map

### Canonical model and state

- Create `src/lib/counterfactual/types.ts` — strict provenance, storm, intervention, surface, simulation, scene, temporal, and session contracts.
- Create `src/lib/counterfactual/hashing.ts` — canonical serialization and stable identifiers.
- Create `src/lib/counterfactual/provenance.ts` — lineage validation and confidence/status downgrade rules.
- Create `src/lib/counterfactual/session.ts` — reducer, initial state, reset semantics, and selectors.
- Create `src/hooks/useCounterfactualSession.ts` — React wrapper around the pure reducer.
- Modify `src/lib/simulation-types.ts` — re-export the shared hydrology contract while retaining legacy aliases.

### Spatial evidence

- Create `src/lib/spatial-data/types.ts` — layer registry, spatial feature, coverage, and query-result contracts.
- Create `src/lib/spatial-data/registry.ts` — official source definitions, vintages, URLs, availability, and caveats.
- Create `src/lib/spatial-data/context.ts` — client edge invocation, response validation, and derived unclassified coverage.
- Create `supabase/functions/_shared/spatial-context.ts` — pure Socrata query construction and GeoJSON normalization.
- Create `supabase/functions/spatial-context/index.ts` — bbox validation, official API requests, partial-failure reporting, and provenance.
- Create `scripts/fetch-lower-manhattan-spatial-context.mjs` — reproducible guided-example fetch and SHA-256 manifest generation using Node built-ins.
- Create `public/data/lower-manhattan-spatial-context.geojson` and `public/data/lower-manhattan-spatial-context.manifest.json` — declared, versioned guided-example evidence.
- Create `src/components/analyze/SpatialLandCoverLayer.tsx` — MapLibre sources/layers and inspect interaction.
- Create `src/components/analyze/SourceInspector.tsx` — source, vintage, confidence, resolution, and caveat drawer.

### Direct editing and projected metrics

- Create `src/lib/counterfactual/eligibility.ts` — geometry clipping and typed invalid-region reasons.
- Create `src/lib/counterfactual/modifiers.ts` — feature rasterization, overlap handling, and surface hashes.
- Create `src/lib/counterfactual/projected-metrics.ts` — existing scenario-economics adapter and estimated runoff/risk.
- Rewrite `src/components/MapEditor.tsx` — controlled GeoJSON editor that emits intervention features.
- Create `src/components/analyze/DirectEditTray.tsx` — map-native tools, brush state, undo, clear, and disabled-evidence explanations.
- Create `src/components/analyze/ScenarioProjectionHUD.tsx` — cost, absorption, runoff, and risk with estimated/modeled status.
- Reduce `src/components/ScenarioStudio.tsx` to a detail drawer driven by the same geometry-derived scenario.

### Hydrology and playback

- Create `supabase/functions/_shared/hydrology-contract.ts` — dependency-free request/response contract and validators.
- Create `supabase/functions/_shared/hydrology-core.ts` — pure D8 routing, rainfall excess, modifiers, water balance, and deterministic result construction.
- Rewrite `supabase/functions/run-simulation/index.ts` — thin HTTP/cache/elevation adapter over the pure core.
- Create `supabase/migrations/20260809000000_counterfactual_surface_cache.sql` — cache identity by storm, surface, and model.
- Modify `src/lib/simulation.ts` — V2 request builder, legacy adapter, client validation, and paired-run helper.
- Create `src/lib/storm-playback.ts` — shared animation clock selectors.
- Create `src/hooks/useStormPlayback.ts` — play, pause, seek, replay, reduced-motion state.
- Modify `src/components/FlowLayer.tsx` and `src/components/RiskHeatmap.tsx` — render only computed response features up to playback progress.
- Create `src/components/analyze/StormModeDock.tsx` — immutable storm summary and playback control.

### Product scene, optimization, time, compare, export

- Normalize `src/components/MapView.tsx` — one ready payload and controlled camera contract.
- Create `src/components/analyze/AnalyzeScene.tsx` and `src/components/analyze/MapChrome.tsx` — full-viewport composition.
- Rewrite `src/pages/Analyze.tsx` — route-level orchestration only.
- Rewrite `src/hooks/useCinematicOnboarding.ts` — explicit first-run phase machine with no fake records or simulations.
- Create `src/lib/catalyst-optimization.ts` — constraint parser, spatial candidate evaluation, deterministic feasibility result.
- Modify `src/lib/catalyst.ts`, `src/integrations/catalyst/localCompiler.ts`, and `src/components/catalyst/CatalystFuturePanel.tsx` — delegate to the unified optimizer.
- Create `src/lib/temporal-layers.ts` — epoch evidence gate and active evidence-stack selector.
- Modify `src/components/catalyst/TemporalLens.tsx` and `src/components/catalyst/EpochVeil.tsx` — map-native time control without unsupported geometry.
- Rewrite `src/components/catalyst/CompareRealities.tsx` — full-screen synchronized dual scene and shared storm clock.
- Create `src/lib/counterfactual/export.ts` — fail-closed counterfactual payload builder.
- Modify `src/lib/pdf-export.ts` and `src/lib/geo.ts` — optional paired evidence while preserving legacy exports.
- Create `docs/mannahatta-counterfactual-methodology.md` — in-product methodology, source, model, and limitation copy.

---

### Task 1: Canonical Counterfactual Contracts, Hashing, and Provenance

**Files:**
- Create: `src/lib/counterfactual/types.ts`
- Create: `src/lib/counterfactual/hashing.ts`
- Create: `src/lib/counterfactual/provenance.ts`
- Test: `src/lib/counterfactual/hashing.test.ts`
- Test: `src/lib/counterfactual/provenance.test.ts`

**Interfaces:**
- Produces: `stableHash(value: unknown): string`.
- Produces: `assertCompleteProvenance(items: DataProvenance[]): void`.
- Produces: `combineProvenance(items: DataProvenance[]): DataProvenance[]`.
- Produces: `CounterfactualSession`, `StormDefinition`, `InterventionFeature`, `SurfaceModifierGrid`, `RealitySurface`, `RealitySimulation`, `RealityScene`, and `DataProvenance`.

- [ ] **Step 1: Write failing canonicalization and lineage tests.**

~~~ts
import { describe, expect, it } from "vitest";
import { stableHash } from "./hashing";
import { assertCompleteProvenance } from "./provenance";

describe("stableHash", () => {
  it("ignores object key order but preserves array order", () => {
    expect(stableHash({ b: 2, a: 1 })).toBe(stableHash({ a: 1, b: 2 }));
    expect(stableHash([1, 2])).not.toBe(stableHash([2, 1]));
  });
});

it("fails closed when required lineage is absent", () => {
  expect(() =>
    assertCompleteProvenance([{
      sourceId: "",
      title: "NYC land cover",
      agency: "NYC",
      url: "",
      accessedAt: "2026-08-09",
      confidence: "high",
      status: "observed",
      caveats: [],
    }])
  ).toThrow(/sourceId|url/);
});
~~~

- [ ] **Step 2: Run the tests and verify RED.**

Run: `npm test -- --run src/lib/counterfactual/hashing.test.ts src/lib/counterfactual/provenance.test.ts`
Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Define the exact model and deterministic hash boundary.**

~~~ts
export type ScientificStatus =
  | "observed"
  | "derived"
  | "modeled"
  | "projected"
  | "speculative";

export interface DataProvenance {
  sourceId: string;
  title: string;
  agency: string;
  url: string;
  observedAt?: string;
  accessedAt: string;
  spatialResolutionM?: number;
  crs?: string;
  license?: string;
  method?: string;
  confidence: "high" | "medium" | "low";
  status: ScientificStatus;
  caveats: string[];
}

export interface StormDefinition {
  id: string;
  rainfallDepthMm: number;
  durationMinutes: number;
  distribution: "uniform";
  resolution: "low" | "medium" | "high";
  includeDrainage: false;
  hash: string;
}

export type InterventionType =
  | "street_trees"
  | "bioswales"
  | "permeable_pavement"
  | "green_roofs"
  | "wetland";

export interface SurfaceModifierCell {
  row: number;
  col: number;
  retentionFractionDelta: number;
  storageDeltaMm: number;
  roughnessDelta: number;
}

export interface SurfaceModifierGrid {
  bbox: { north: number; south: number; east: number; west: number };
  rows: number;
  cols: number;
  cells: SurfaceModifierCell[];
}

export interface EligibilityResult {
  eligible: boolean;
  validGeometry: GeoJSON.Polygon | GeoJSON.MultiPolygon | null;
  invalidGeometry: GeoJSON.Polygon | GeoJSON.MultiPolygon | null;
  validAreaM2: number;
  invalidAreaM2: number;
  reasonCodes: Array<
    | 'NO_ELIGIBILITY_LAYER'
    | 'OUTSIDE_ELIGIBLE_SURFACE'
    | 'PARTIALLY_OUTSIDE_ELIGIBLE_SURFACE'
    | 'EXCLUDED_GEOMETRY'
  >;
  confidence: 'high' | 'medium' | 'low';
  provenance: DataProvenance[];
  caveats: string[];
}

export interface InterventionParameters {
  retentionFractionDelta: number;
  storageDeltaMm: number;
  roughnessDelta: number;
  calibrationProvenance: DataProvenance[];
}

export interface InterventionFeature {
  id: string;
  type: InterventionType;
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  areaM2: number;
  parameters: InterventionParameters;
  eligibility: EligibilityResult;
  provenance: DataProvenance[];
}

export interface RealitySurface {
  id: 'now' | 'possible';
  baselineLayerHash: string;
  interventionHash: string;
  surfaceHash: string;
  interventions: InterventionFeature[];
  modifiers: SurfaceModifierGrid;
  provenance: DataProvenance[];
  warnings: string[];
}

export interface WaterBalance {
  rainfallM3: number;
  infiltratedM3: number;
  storedM3: number;
  runoffM3: number;
  closureErrorM3: number;
}

export interface RealitySimulation {
  stormHash: string;
  surfaceHash: string;
  modelVersion: string;
  flowPaths: FlowPath[];
  riskZones: RiskZone[];
  impactPoints: ImpactPoint[];
  waterBalance: WaterBalance;
  optimizationClaimsAllowed: boolean;
  warnings: string[];
  provenance: DataProvenance[];
}

export type Epoch = '1609' | '2026' | 'future';

export interface MapCameraState {
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
}

export interface SpatialContextSnapshot {
  featureCollection: GeoJSON.FeatureCollection;
  coverage: {
    status: 'complete' | 'partial' | 'unavailable';
    requestedAreaM2: number;
    classifiedAreaM2: number;
  };
  provenance: DataProvenance[];
  warnings: string[];
}

export interface OptimizationRequest {
  objective: 'minimize-risk' | 'maximize-absorption' | 'minimize-runoff';
  target?: number;
  maxBudgetUSD?: number;
  allowedInterventions?: InterventionType[];
  excludedGeometry?: GeoJSON.MultiPolygon;
}

export interface OptimizationResult {
  request: OptimizationRequest;
  feasible: boolean;
  status: 'feasible' | 'closest-feasible' | 'unsupported';
  strategy: { features: InterventionFeature[]; costUSD: number };
  constraintGap: number;
  warnings: string[];
  provenance: DataProvenance[];
}

export interface RealityScene {
  surface: RealitySurface;
  simulation: RealitySimulation;
  playbackProgress: number;
  epoch: Epoch;
}

export interface CounterfactualSession {
  phase:
    | 'boot'
    | 'analyzing'
    | 'storm-now'
    | 'edit-prompt'
    | 'edit'
    | 'storm-possible'
    | 'compare'
    | 'error';
  requestId: string | null;
  analysis: AnalysisRecord | null;
  viewport: MapCameraState;
  spatialContext: SpatialContextSnapshot | null;
  storm: StormDefinition | null;
  epoch: Epoch;
  activeTool: InterventionType | null;
  nowSurface: RealitySurface | null;
  possibleSurface: RealitySurface | null;
  nowSimulation: RealitySimulation | null;
  possibleSimulation: RealitySimulation | null;
  optimization: OptimizationResult | null;
  playback: { playing: boolean; progress: number };
  compareOpen: boolean;
  lastError: string | null;
}
~~~

Import `AnalysisRecord`, `FlowPath`, `RiskZone`, and `ImpactPoint` from the existing application modules; Task 5 later moves the wire contract behind a compatibility re-export without changing these canonical names. `SpatialContextResult` in Task 3 must extend `SpatialContextSnapshot` rather than creating a competing session type. Task 9 must import and extend the canonical `OptimizationResult` with projected/modeled detail rather than redeclaring the shared fields.

Implement `stableHash` with recursively key-sorted canonical JSON and a synchronous FNV-1a 64-bit digest rendered as `fnv1a64:<hex>`. Document that it is a deterministic identity key, not a security checksum. Reject `undefined`, functions, symbols, non-finite numbers, and cyclic objects.

- [ ] **Step 4: Run focused tests and typecheck.**

Run: `npm test -- --run src/lib/counterfactual/hashing.test.ts src/lib/counterfactual/provenance.test.ts`
Expected: PASS.

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit the model boundary.**

~~~text
Make paired realities impossible to confuse

Centralize storm, surface, simulation, and lineage identities so every
counterfactual consumer shares one strict scientific contract.

Constraint: Hashes are deterministic cache identities, not security checksums
Confidence: high
Scope-risk: moderate
Directive: Do not add a second reality or provenance type outside this module
Tested: Focused hashing and provenance tests; TypeScript typecheck
Not-tested: Browser or edge integration
~~~

---

### Task 2: Counterfactual Session Reducer and Reset Invariants

**Files:**
- Create: `src/lib/counterfactual/session.ts`
- Create: `src/hooks/useCounterfactualSession.ts`
- Test: `src/lib/counterfactual/session.test.ts`
- Modify: `src/pages/Analyze.tsx`

**Interfaces:**
- Consumes: Task 1 contracts and `AnalysisRecord` from `src/lib/types.ts`.
- Produces: `createCounterfactualSession(): CounterfactualSession`.
- Produces: `counterfactualReducer(state, action): CounterfactualSession`.
- Produces: `selectCanCompare(state): boolean` and `selectProjectedStatus(state): "estimated" | "modeled"`.
- Produces: `useCounterfactualSession()` returning `{ state, dispatch, canCompare, projectedStatus }`.

- [ ] **Step 1: Lock state-transition behavior with failing tests.**

~~~ts
it("preserves one storm across NOW and POSSIBLE runs", () => {
  const storm = makeStorm({ hash: "storm:fixed" });
  let state = counterfactualReducer(createCounterfactualSession(), {
    type: "ANALYSIS_SUCCEEDED",
    analysis: makeAnalysis("a"),
    baseline: makeBaseline(),
    storm,
  });
  state = counterfactualReducer(state, {
    type: "NOW_SIMULATION_SUCCEEDED",
    result: makeSimulation("storm:fixed", "surface:now"),
  });
  state = counterfactualReducer(state, {
    type: "POSSIBLE_SIMULATION_SUCCEEDED",
    result: makeSimulation("storm:fixed", "surface:possible"),
  });
  expect(state.storm).toBe(storm);
  expect(selectCanCompare(state)).toBe(true);
});

it("clears location-bound edits and results on a new place", () => {
  const next = counterfactualReducer(makeEditedSession(), {
    type: "ANALYSIS_STARTED",
    requestId: "new-place",
  });
  expect(next.possibleSurface.interventions).toEqual([]);
  expect(next.nowSimulation).toBeNull();
  expect(next.possibleSimulation).toBeNull();
  expect(next.compareOpen).toBe(false);
});
~~~

- [ ] **Step 2: Verify RED.**

Run: `npm test -- --run src/lib/counterfactual/session.test.ts`
Expected: FAIL because reducer and selectors do not exist.

- [ ] **Step 3: Implement explicit phases and actions.**

~~~ts
export type AnalyzePhase =
  | "boot"
  | "analyzing"
  | "storm-now"
  | "edit-prompt"
  | "edit"
  | "storm-possible"
  | "compare"
  | "error";

export type CounterfactualAction =
  | { type: "MAP_READY" }
  | { type: "ANALYSIS_STARTED"; requestId: string }
  | { type: "ANALYSIS_SUCCEEDED"; analysis: AnalysisRecord; baseline: RealitySurface; storm: StormDefinition }
  | { type: "ANALYSIS_FAILED"; requestId: string; message: string }
  | { type: "SPATIAL_CONTEXT_SUCCEEDED"; requestId: string; context: SpatialContextSnapshot }
  | { type: "SPATIAL_CONTEXT_FAILED"; requestId: string; message: string }
  | { type: "TOOL_SELECTED"; tool: InterventionType | null }
  | { type: "INTERVENTIONS_CHANGED"; features: InterventionFeature[]; surface: RealitySurface }
  | { type: "NOW_SIMULATION_SUCCEEDED"; result: RealitySimulation }
  | { type: "POSSIBLE_SIMULATION_STARTED" }
  | { type: "POSSIBLE_SIMULATION_SUCCEEDED"; result: RealitySimulation }
  | { type: "STORM_PLAYBACK_CHANGED"; playing: boolean; progress: number }
  | { type: "TEMPORAL_CHANGED"; epoch: Epoch }
  | { type: "COMPARE_OPENED" }
  | { type: "COMPARE_CLOSED" }
  | { type: "RESET" };
~~~

Reducer guards must ignore stale request IDs, reject simulation results whose `stormHash` differs from session storm, keep the last valid analysis on request failure, invalidate POSSIBLE simulation after edits, and prevent compare until both results share storm/model and have different surface hashes.

In `Analyze.tsx`, replace only state that maps directly to the reducer; preserve the current rendered layout during this task so behavior changes remain isolated.

- [ ] **Step 4: Verify reducer and existing Analyze-adjacent regression tests.**

Run: `npm test -- --run src/lib/counterfactual/session.test.ts src/components/SimulationPanel.test.tsx src/components/catalyst/TemporalLens.test.tsx`
Expected: PASS.

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit the session invariant.**

~~~text
Keep every experiment inside one coherent session

Replace scattered location, edit, storm, future, and comparison state with
a reducer that invalidates stale evidence and preserves the immutable storm.

Constraint: Existing Analyze rendering remains unchanged in this slice
Confidence: high
Scope-risk: moderate
Directive: New Analyze state belongs in the reducer unless it is ephemeral DOM state
Tested: Reducer, simulation panel, Temporal Lens tests; TypeScript typecheck
Not-tested: Full map interaction
~~~

---

### Task 3: Official NYC Spatial Context and Provenance Overlay

**Files:**
- Create: `src/lib/spatial-data/types.ts`
- Create: `src/lib/spatial-data/registry.ts`
- Create: `src/lib/spatial-data/registry.test.ts`
- Create: `src/lib/spatial-data/context.ts`
- Create: `src/lib/spatial-data/context.test.ts`
- Create: `supabase/functions/_shared/spatial-context.ts`
- Create: `supabase/functions/_shared/spatial-context.test.ts`
- Create: `supabase/functions/spatial-context/index.ts`
- Create: `scripts/fetch-lower-manhattan-spatial-context.mjs`
- Create: `public/data/lower-manhattan-spatial-context.geojson`
- Create: `public/data/lower-manhattan-spatial-context.manifest.json`
- Create: `src/components/analyze/SpatialLandCoverLayer.tsx`
- Create: `src/components/analyze/SourceInspector.tsx`
- Test: `src/components/analyze/SpatialLandCoverLayer.test.tsx`

**Interfaces:**
- Produces: `SPATIAL_SOURCE_REGISTRY` keyed by stable source IDs.
- Produces: `buildSocrataGeoJsonUrl(source, bbox): URL`.
- Produces: `normalizeSpatialContext(responses, bbox): SpatialContextResult`.
- Produces: `loadSpatialContext(bbox, signal?): Promise<SpatialContextResult>`.
- Produces: edge response `{ type: "FeatureCollection", features, coverage, provenance, warnings }`.
- Produces: `SpatialLandCoverLayer({ map, context, onInspect })`.

~~~ts
export interface SpatialContextResult extends SpatialContextSnapshot {
  loadedSourceIds: string[];
  failedSourceIds: string[];
}
~~~

- [ ] **Step 1: Write failing registry, URL, normalization, and inspection tests.**

~~~ts
it("queries official sources with a bounded within_box predicate", () => {
  const url = buildSocrataGeoJsonUrl(SPATIAL_SOURCE_REGISTRY.buildings, {
    north: 40.72, south: 40.70, east: -73.99, west: -74.02,
  });
  expect(url.hostname).toBe("data.cityofnewyork.us");
  expect(url.pathname).toContain("/resource/");
  expect(url.searchParams.get("$where")).toMatch(/within_box/);
});

it("reports unclassified coverage instead of inferring missing land cover", () => {
  const result = normalizeSpatialContext([buildingResponse], bbox);
  expect(result.coverage.status).toBe("partial");
  expect(result.featureCollection.features.some(
    (f) => f.properties?.surfaceClass === "unclassified"
  )).toBe(true);
  expect(result.warnings).toContainEqual(expect.stringMatching(/partial/i));
});
~~~

Component test: clicking a feature calls `onInspect` with class, source ID, observed date, confidence, geometry status, and caveats; a tree feature remains a `Point`.

- [ ] **Step 2: Verify RED.**

Run: `npm test -- --run src/lib/spatial-data/registry.test.ts src/lib/spatial-data/context.test.ts supabase/functions/_shared/spatial-context.test.ts src/components/analyze/SpatialLandCoverLayer.test.tsx`
Expected: FAIL because the registry and overlay do not exist.

- [ ] **Step 3: Build the server-owned source registry.**

Register these exact official entries:

- `nyc-land-cover-2017-6in` — catalog URL from the approved design, status `observed`, availability `catalog-only` until a real tile template passes validation.
- `nyc-building-footprints` — Socrata resource `nqwf-w8eh`, display class `buildings`.
- `nyc-roadbed` — Socrata resource `xgwd-7vhd`, display class `pavement`.
- `nyc-sidewalk` — Socrata resource `vfx9-tbb6`, display class `pavement`.
- `nyc-hydrography` — Socrata resource `drh3-e2fd`, display class `water`.
- `nyc-tree-inventory` — NYC Parks Socrata resource `uvpi-gqnh`, display class `tree-observation`.
- `usgs-3dep` — lower-resolution elevation fallback outside NYC, not land cover.

Each entry carries agency, official URL, Socrata resource ID when applicable, geometry type, observed/access date, CRS, spatial resolution when published, confidence, status, license, caveats, and `availability: "live" | "catalog-only" | "unavailable"`. Never upgrade `catalog-only` because an environment variable merely looks present; validate an HTTPS tile template before activation.

- [ ] **Step 4: Implement the bounded edge adapter and partial-coverage rules.**

Accept only numeric ordered bbox coordinates, reject areas over 50 km², cap Socrata rows, use `Promise.allSettled` so one source failure is named rather than hidden, and never convert failed layers into empty observed coverage. Normalize all properties to:

~~~ts
export interface SpatialFeatureProperties {
  featureId: string;
  surfaceClass:
    | "buildings"
    | "pavement"
    | "water"
    | "tree-observation"
    | "unclassified";
  sourceId: string;
  confidence: "high" | "medium" | "low";
  observedAt?: string;
  scientificStatus: "observed" | "derived";
}
~~~

`src/lib/spatial-data/context.ts` invokes the edge function with an `AbortSignal`, validates the returned feature collection, and constructs the unclassified feature as the requested bbox minus loaded polygon classes using Turf. It is not an observed source feature: mark it `derived` with low confidence and preserve named source failures. Do not polygonize tree points.

- [ ] **Step 5: Add the reproducible guided example and manifest.**

The Node script uses global `fetch`, `crypto.createHash("sha256")`, and `fs/promises` only. It requests the fixed Lower Manhattan bbox from the same registry resource IDs, sorts features by source and stable source feature ID, writes compact GeoJSON, and writes:

~~~json
{
  "id": "lower-manhattan-guided-example",
  "kind": "guided example",
  "generatedAt": "ISO timestamp",
  "bbox": [-74.02, 40.70, -73.99, 40.72],
  "sha256": "64 lowercase hex characters",
  "sources": ["nyc-building-footprints", "nyc-roadbed", "nyc-sidewalk", "nyc-hydrography", "nyc-tree-inventory"],
  "coverage": "partial",
  "caveats": ["Tree records are points, not canopy polygons.", "Unclassified areas are not inferred land cover."]
}
~~~

If the live fetch cannot run in the implementation environment, do not invent fixture content: make the app fetch the official endpoints at runtime and omit the guided replay until the generated files and manifest exist.

- [ ] **Step 6: Render inspectable spatial evidence.**

`SpatialLandCoverLayer` owns MapLibre source/layer IDs under the prefix `mannahatta-spatial-context`, uses class colors from `LAND_COVER_META` where compatible, uses point circles for trees, and removes only its own layers/sources on cleanup. `SourceInspector` shows the exact observation date rather than `2026`, class, agency, confidence, availability, processing method, official link, and affected metrics.

- [ ] **Step 7: Verify the spatial slice.**

Run: `npm test -- --run src/lib/spatial-data/registry.test.ts src/lib/spatial-data/context.test.ts supabase/functions/_shared/spatial-context.test.ts src/components/analyze/SpatialLandCoverLayer.test.tsx`
Expected: PASS.

Run: `npm run typecheck`
Expected: PASS.

Run: `node scripts/fetch-lower-manhattan-spatial-context.mjs --check`
Expected: manifest checksum matches the fixture, or the command exits with a clear `guided example unavailable` status and no generated files are committed.

- [ ] **Step 8: Commit official spatial context.**

~~~text
Let the map show what the city data actually supports

Add a server-owned NYC source registry, bounded vector adapter, partial
coverage semantics, feature inspection, and reproducible guided evidence.

Constraint: The six-inch raster has no verified browser tile service
Rejected: Infer vegetation polygons from tree points | unsupported geometry
Confidence: high
Scope-risk: broad
Directive: A missing source must remain missing or unclassified, never silently empty
Tested: Registry, adapter, overlay tests; fixture checksum when available; typecheck
Not-tested: Production Socrata rate limits
~~~

---

### Task 4: Geometry-First Editing, Eligibility, and Immediate Projection

**Files:**
- Create: `src/lib/counterfactual/eligibility.ts`
- Create: `src/lib/counterfactual/eligibility.test.ts`
- Create: `src/lib/counterfactual/modifiers.ts`
- Create: `src/lib/counterfactual/modifiers.test.ts`
- Create: `src/lib/counterfactual/projected-metrics.ts`
- Create: `src/lib/counterfactual/projected-metrics.test.ts`
- Rewrite: `src/components/MapEditor.tsx`
- Create: `src/components/MapEditor.test.tsx`
- Create: `src/components/analyze/DirectEditTray.tsx`
- Create: `src/components/analyze/ScenarioProjectionHUD.tsx`
- Modify: `src/components/ScenarioStudio.tsx`

**Interfaces:**
- Consumes: `SpatialContextResult`, Task 1 intervention/surface contracts, existing `INTERVENTIONS`, `normalizeScenario`, and `assessScenario`.
- Produces: `evaluateEligibility(draft, type, context): EligibilityResult`.
- Produces: `deriveScenarioFromFeatures(features, cover, siteAreaM2): Scenario`.
- Produces: `rasterizeSurfaceModifiers(features, bbox, rows, cols): SurfaceModifierGrid`.
- Produces: `projectEditMetrics(input): ProjectedMetrics`.
- Produces: controlled `MapEditorProps` with `features` and `onChange`.

~~~ts
export interface ProjectedMetrics {
  status: "estimated until storm rerun" | "modeled";
  scenarioImpact: ScenarioImpact;
  estimatedRunoffM3: number;
  estimatedRisk: FloodRisk;
  surfaceHash: string;
  warnings: string[];
}
~~~

- [ ] **Step 1: Write failing pure geometry and projection tests.**

~~~ts
it.each([
  ["green_roofs", "buildings"],
  ["permeable_pavement", "pavement"],
])("clips %s to eligible %s geometry", (type, surfaceClass) => {
  const result = evaluateEligibility(overlappingPolygon, type, contextWith(surfaceClass));
  expect(result.validAreaM2).toBeGreaterThan(0);
  expect(result.invalidAreaM2).toBeGreaterThan(0);
  expect(result.reasonCodes).toContain("PARTIALLY_OUTSIDE_ELIGIBLE_SURFACE");
});

it("does not double-count overlapping edits in a modifier cell", () => {
  const grid = rasterizeSurfaceModifiers([bioswaleA, bioswaleB], bbox, 30, 30);
  for (const cell of grid.cells) {
    expect(cell.retentionFractionDelta).toBeLessThanOrEqual(1);
  }
});

it("uses the preserved scenario economics", () => {
  const metrics = projectEditMetrics({ features, cover, siteAreaM2, rainfallMm: 50 });
  expect(metrics.scenarioImpact).toEqual(
    assessScenario(cover, deriveScenarioFromFeatures(features, cover, siteAreaM2), siteAreaM2)
  );
  expect(metrics.status).toBe("estimated until storm rerun");
});
~~~

- [ ] **Step 2: Verify RED.**

Run: `npm test -- --run src/lib/counterfactual/eligibility.test.ts src/lib/counterfactual/modifiers.test.ts src/lib/counterfactual/projected-metrics.test.ts`
Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement explicit eligibility without overclaiming.**

Use Turf intersections/differences against loaded official polygons. Green roofs require building polygons. Permeable pavement requires roadbed or sidewalk polygons. Bioswales and street trees accept non-building polygon area but return medium confidence and a feasibility caveat because right-of-way, utilities, and ownership are not modeled. Wetland remains visible but disabled unless a low-area suitability layer with provenance is present; the disabled explanation is `No defensible wetland suitability layer is loaded for this place.`

`EligibilityResult` includes `eligible`, valid/invalid geometry, valid/invalid area, reason codes, confidence, provenance, and caveats. Invalid regions remain in editor state and render with a hatched red treatment; only valid geometry contributes to scenario or modifiers.

- [ ] **Step 4: Derive modifiers from preserved model values.**

Do not add unsupported physical calibration constants. For the first release:

- `retentionFractionDelta` derives from the existing intervention `targetWeight - sourceWeight` and is clamped to [0, 1].
- `storageDeltaMm` is `0` unless the feature carries a provenance-backed calibrated parameter.
- `roughnessDelta` is `0` unless the feature carries a provenance-backed calibrated parameter.
- Every zeroed uncalibrated parameter adds one deduplicated surface warning.

Rasterize polygon coverage at the requested simulation grid, conserve canonical valid area within a documented one-cell tolerance, clamp overlaps, and hash the sorted valid features plus grid shape.

- [ ] **Step 5: Rewrite MapEditor as a controlled adapter.**

~~~ts
export interface MapEditorProps {
  map: MLMap | null;
  bbox: SimBBox | null;
  context: SpatialContextResult | null;
  activeIntervention: InterventionType | null;
  features: InterventionFeature[];
  onChange: (features: InterventionFeature[]) => void;
  onDraftFeedback: (feedback: EligibilityResult | null) => void;
}
~~~

Initialize Mapbox Draw once per map, synchronize external feature changes into Draw without feedback loops, assign the active intervention on create, reevaluate on update, remove on delete, expose undo/clear through an imperative handle or reducer actions, and remove the current `any` access to land-cover fields.

- [ ] **Step 6: Add immediate HUD behavior and component tests.**

Test create/update/delete, invalid-region explanation, undo, clear, controlled reset, and tool selection. Measure `projectEditMetrics` around a representative 180×180 grid and assert the computation is under 150 ms in the unit benchmark; report the timing without making the test sensitive to rendering.

- [ ] **Step 7: Verify editing regressions and commit.**

Run: `npm test -- --run src/lib/scenario.test.ts src/lib/counterfactual/eligibility.test.ts src/lib/counterfactual/modifiers.test.ts src/lib/counterfactual/projected-metrics.test.ts src/components/MapEditor.test.tsx`
Expected: PASS with existing scenario numeric expectations unchanged.

Run: `npm run typecheck`
Expected: PASS.

~~~text
Make changing the ground a spatial act

Retain intervention geometry, show invalid portions, derive the existing
scenario economics from valid area, and produce immediate labeled estimates.

Constraint: Uncalibrated storage and roughness effects remain zero and visible
Confidence: medium
Scope-risk: broad
Directive: Geometry is canonical; whole-area scenario fractions are derived output
Tested: Eligibility, modifiers, scenario projection, editor tests; typecheck
Not-tested: Survey or engineering feasibility
~~~

---

### Task 5: Deterministic Surface-Aware D8 Hydrology

**Files:**
- Create: `supabase/functions/_shared/hydrology-contract.ts`
- Create: `supabase/functions/_shared/hydrology-core.ts`
- Create: `supabase/functions/_shared/hydrology-core.test.ts`
- Rewrite: `supabase/functions/run-simulation/index.ts`
- Modify: `src/lib/simulation-types.ts`
- Modify: `src/lib/simulation.ts`
- Modify: `src/lib/simulation.test.ts`
- Create: `supabase/migrations/20260809000000_counterfactual_surface_cache.sql`

**Interfaces:**
- Consumes: `StormDefinition` and `SurfaceModifierGrid` serialized without React/browser imports.
- Produces: `SimulationRequestV2`, `SimulationResponseV2`, `validateSimulationRequest`, and `runHydrology(input)`.
- Produces: `runRealitySimulation(request): Promise<RealitySimulation>` and `runPairedRealitySimulation(now, possible)`.

- [ ] **Step 1: Extract regression fixtures for current D8 behavior before changing the handler.**

~~~ts
it("routes a fixed bowl grid deterministically", () => {
  const first = runHydrology(makeInput({ elevation: BOWL_GRID, modifiers: neutralGrid }));
  const second = runHydrology(makeInput({ elevation: BOWL_GRID, modifiers: neutralGrid }));
  expect(second).toEqual(first);
  expect(first.modelVersion).toBe(HYDROLOGY_MODEL_VERSION);
});

it("rejects drainage instead of accepting and ignoring it", () => {
  expect(() => validateSimulationRequest({ ...validRequest, storm: { ...storm, includeDrainage: true } }))
    .toThrow(/drainage is not implemented/i);
});
~~~

- [ ] **Step 2: Verify RED against the unextracted handler.**

Run: `npm test -- --run supabase/functions/_shared/hydrology-core.test.ts`
Expected: FAIL because the pure core does not exist.

- [ ] **Step 3: Define the dependency-free V2 contract.**

~~~ts
export interface SimulationSurfaceInput {
  id: "now" | "possible";
  surfaceHash: string;
  baselineLayerHash: string;
  modifiers: SurfaceModifierGrid;
  provenance: DataProvenance[];
}

export interface SimulationRequestV2 {
  bbox: SimBBox;
  storm: StormDefinition;
  surface: SimulationSurfaceInput;
}

export interface WaterBalance {
  rainfallM3: number;
  infiltratedM3: number;
  storedM3: number;
  runoffM3: number;
  closureErrorM3: number;
}
~~~

Response extends the current flow paths, risk zones, impact points, and metadata with `stormHash`, `surfaceHash`, `modelVersion`, `waterBalance`, `warnings`, and `provenance`. Retain a typed legacy adapter for existing callers during migration; do not let legacy requests claim counterfactual comparability.

- [ ] **Step 4: Implement rainfall excess and D8 accumulation.**

For each cell, compute cell rainfall volume from storm depth and geodesic cell area. Clamp `retentionFractionDelta` to [0, 1], calculate infiltrated volume from that fraction, apply provenance-backed storage to the remaining depth, and route only the remaining excess through the existing D8 receiver graph. Roughness changes relative velocity only when a calibrated nonzero value exists. The terrain grid is identical for paired requests.

Assert:

~~~ts
Math.abs(
  rainfallM3 - infiltratedM3 - storedM3 - runoffM3
) <= Math.max(1e-6, rainfallM3 * 1e-6)
~~~

If fallback elevation is used, append an `illustrative synthetic elevation` warning, downgrade derived simulation provenance, and set `optimizationClaimsAllowed: false`.

- [ ] **Step 5: Add monotonicity, identity, closure, and fallback tests.**

~~~ts
it("cannot increase total generated runoff when retention increases", () => {
  const now = runHydrology(makeInput({ modifiers: neutralGrid }));
  const possible = runHydrology(makeInput({ modifiers: bioswaleGrid }));
  expect(possible.waterBalance.runoffM3).toBeLessThanOrEqual(now.waterBalance.runoffM3);
});

it("changes surface identity but not storm identity", () => {
  const [now, possible] = runPair();
  expect(possible.stormHash).toBe(now.stormHash);
  expect(possible.surfaceHash).not.toBe(now.surfaceHash);
});
~~~

Also test grid dimensions 30, 90, and 180; malformed hashes; out-of-bounds modifiers; area >50 km²; storage greater than rain; local redistribution allowance; and exact water-balance closure.

- [ ] **Step 6: Make the edge handler thin and update cache identity.**

The handler validates/authenticates, loads cached elevation or fetches it, calls `runHydrology`, and caches by `bbox + storm_hash + surface_hash + model_version`. Migration:

~~~sql
alter table public.simulation_cache
  add column if not exists storm_hash text,
  add column if not exists surface_hash text,
  add column if not exists model_version text;

create index if not exists simulation_cache_counterfactual_lookup
  on public.simulation_cache (storm_hash, surface_hash, model_version, expires_at);
~~~

New queries require all three non-null identities, so legacy rows cannot be mistaken for a counterfactual result.

- [ ] **Step 7: Verify hydrology and client compatibility.**

Run: `npm test -- --run supabase/functions/_shared/hydrology-core.test.ts src/lib/simulation.test.ts`
Expected: PASS.

Run: `npm test -- --run`
Expected: all existing and new tests PASS.

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 8: Commit the scientific engine extension.**

~~~text
Make ground edits change modeled water

Extend the existing D8 engine with surface rainfall-excess modifiers, paired
identities, closed water balance, explicit fallback status, and safe caching.

Constraint: Elevation and storm remain identical across realities
Rejected: Alter DEM cells to make interventions look effective | unsupported precision
Confidence: high
Scope-risk: broad
Directive: Never cache or compare a simulation without storm, surface, and model identity
Tested: Determinism, monotonicity, closure, validation, fallback, client tests
Not-tested: Calibrated sewer or sub-cell hydraulic behavior
~~~

---

### Task 6: Wire Real NOW/POSSIBLE Runs and Normalize Map Contracts

**Files:**
- Modify: `src/components/MapView.tsx`
- Modify: `src/pages/Analyze.tsx`
- Modify: `src/components/SimulationPanel.tsx`
- Modify: `src/components/SimulationPanel.test.tsx`
- Create: `src/pages/Analyze.test.tsx`
- Modify: `src/lib/simulation.ts`

**Interfaces:**
- Consumes: session reducer, `runRealitySimulation`, and Task 4 surface builder.
- Produces: `MapViewReadyPayload = { handle: MapViewHandle; map: MLMap }`.
- Produces: `MapCameraState` and controlled `camera/onCameraChange` props.
- Produces: orchestration that always reruns POSSIBLE after edits.

- [ ] **Step 1: Write failing contract and orchestration tests.**

~~~ts
it("requests paired runs with one storm and two surfaces", async () => {
  render(<Analyze />, { wrapper: testRouter });
  await loadAnalysis();
  await finishNowStorm();
  await paintValidBioswale();
  await rerunStorm();
  expect(runRealitySimulation).toHaveBeenNthCalledWith(
    1, expect.objectContaining({ surface: expect.objectContaining({ id: "now" }) })
  );
  expect(runRealitySimulation).toHaveBeenNthCalledWith(
    2, expect.objectContaining({ surface: expect.objectContaining({ id: "possible" }) })
  );
  expect(getStormHash(1)).toBe(getStormHash(2));
  expect(getSurfaceHash(1)).not.toBe(getSurfaceHash(2));
});

it("never duplicates NOW as the POSSIBLE result", async () => {
  await runPossible();
  expect(session.possibleSimulation).not.toBe(session.nowSimulation);
});
~~~

- [ ] **Step 2: Verify RED.**

Run: `npm test -- --run src/pages/Analyze.test.tsx src/components/SimulationPanel.test.tsx`
Expected: FAIL on current callback mismatch, drainage flag, or duplicated future result.

- [ ] **Step 3: Normalize MapView readiness and camera state.**

`onReady` always receives `{ handle, map }`. The imperative handle keeps `flyTo`, `fitBounds`, `getBounds`, `getCenter`, and `getMap`. Add optional controlled camera state without causing move-event feedback loops. Update every caller in one commit slice.

- [ ] **Step 4: Remove fake and shape-incompatible fallbacks.**

Delete the fake `AnalysisRecord`, invalid bbox join, numeric resolution `5`, fake flow GeoJSON, and assignment of NOW simulation as future. A failed live request dispatches `ANALYSIS_FAILED` and preserves the last valid session. The guided sample is used only when explicitly labeled and its verified manifest is present.

Start `loadSpatialContext` beside analysis, dispatch its success/failure with the active request ID, and abort it on a new place. Spatial evidence failure leaves analysis usable but names the unavailable overlay and disables geometry tools that require it.

Set `includeDrainage: false` in `SimulationPanel` and hide or disable any control implying supported drainage.

- [ ] **Step 5: Verify real rerun wiring.**

Run: `npm test -- --run src/pages/Analyze.test.tsx src/components/SimulationPanel.test.tsx src/lib/simulation.test.ts`
Expected: PASS.

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit integration contracts.**

~~~text
Guarantee the future is a real rerun

Normalize the map handle and route every comparison through distinct surface
requests instead of fake payloads or duplicated current results.

Constraint: Guided evidence is explicit and checksum-verified
Confidence: high
Scope-risk: broad
Directive: POSSIBLE may only be populated by a completed possible-surface request
Tested: Analyze orchestration, simulation panel, simulation client; typecheck
Not-tested: Production edge latency
~~~

---

### Task 7: Map-First Product Shell and Fifteen-Second First Run

**Files:**
- Create: `src/components/analyze/AnalyzeScene.tsx`
- Create: `src/components/analyze/MapChrome.tsx`
- Create: `src/components/analyze/AnalyzeScene.test.tsx`
- Modify: `src/pages/Analyze.tsx`
- Rewrite: `src/hooks/useCinematicOnboarding.ts`
- Create: `src/hooks/useCinematicOnboarding.test.ts`
- Modify: `src/components/analyze/DirectEditTray.tsx`
- Modify: `src/components/analyze/ScenarioProjectionHUD.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: the session hook and existing search/export/methodology controls.
- Produces: `AnalyzeSceneProps = { session, mapReady, onAction }`.
- Produces: first-run events `STORM_NOW_PEAK`, `EDIT_PROMPT_SHOWN`, `FIRST_EDIT_COMMITTED`, `POSSIBLE_RUN_COMPLETE`, and `COMPARE_REVEALED`.

- [ ] **Step 1: Write failing structure, accessibility, and onboarding tests.**

~~~ts
it("keeps the map primary and details temporary", () => {
  render(<AnalyzeScene {...props} />);
  expect(screen.getByTestId("primary-map")).toHaveClass("absolute", "inset-0");
  expect(screen.queryByTestId("permanent-sidebar")).not.toBeInTheDocument();
  expect(screen.getByRole("search")).toBeVisible();
  expect(screen.getByRole("toolbar", { name: /interventions/i })).toBeVisible();
});

it("pauses for a real edit instead of fabricating one", () => {
  const state = advanceOnboarding("EDIT_PROMPT_SHOWN", { interacted: false });
  expect(state.phase).toBe("edit-prompt");
  expect(state.autoAdvanceAt).toBeNull();
});
~~~

Test keyboard focus order, 44px minimum touch targets, reduced motion, guided-example label, and responsive DOM at 390px, 768px, and 1440px container widths.

- [ ] **Step 2: Verify RED.**

Run: `npm test -- --run src/components/analyze/AnalyzeScene.test.tsx src/hooks/useCinematicOnboarding.test.ts`
Expected: FAIL because the scene shell and phase machine do not exist.

- [ ] **Step 3: Build the full-viewport scene and floating chrome.**

Compose:

- top center: `LocationSearch` and current place;
- top left: product mark, reset, and session actions;
- top right: sources, export, methodology;
- bottom center: direct edit tray;
- bottom left: Storm Mode dock;
- bottom right: four-metric HUD;
- compact Temporal Lens that expands only while active;
- temporary drawers for source, metric, and methodology detail.

Move existing dashboard panels into drawers or remove duplicated presentation. Keep existing component logic where it remains useful.

- [ ] **Step 4: Implement the exact first-run phase sequence.**

Use one clock and phase machine:

- 0–3 seconds: run or replay the real/current guided NOW storm;
- 3–7 seconds: pause at peak and retain risk illumination;
- 7–11 seconds: expose edit tray and wait indefinitely for user interaction;
- after first valid edit: run POSSIBLE with the same storm;
- on completion: open compare.

The time targets are transition intent, not fabricated network completion. If analysis or simulation is pending, show truthful loading status and advance only after real evidence exists. If reduced motion is active, jump between computed keyframes with the same controls and data.

- [ ] **Step 5: Verify map-first regressions.**

Run: `npm test -- --run src/components/analyze/AnalyzeScene.test.tsx src/hooks/useCinematicOnboarding.test.ts src/pages/Analyze.test.tsx`
Expected: PASS.

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit the new product shell.**

~~~text
Make the experiment understandable from the map

Replace dashboard dominance with full-viewport map chrome and a truthful
storm-edit-rerun sequence that pauses for the user's spatial intervention.

Constraint: Network work controls readiness; the timeline never fakes completion
Confidence: high
Scope-risk: broad
Directive: New primary actions must live on or over the map, not in a permanent rail
Tested: Scene structure, onboarding, accessibility, responsive DOM, Analyze tests
Not-tested: Final pixel-level browser evidence
~~~

---

### Task 8: Cinematic Storm Mode on a Shared Computed Clock

**Files:**
- Create: `src/lib/storm-playback.ts`
- Create: `src/lib/storm-playback.test.ts`
- Create: `src/hooks/useStormPlayback.ts`
- Create: `src/hooks/useStormPlayback.test.ts`
- Modify: `src/components/FlowLayer.tsx`
- Modify: `src/components/RiskHeatmap.tsx`
- Create: `src/components/analyze/StormModeDock.tsx`
- Create: `src/components/analyze/StormModeDock.test.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Produces: `StormPlaybackState = { progress, playing, durationMs, reducedMotion }`.
- Produces: `visibleFlowPaths(result, progress)` and `visibleRiskZones(result, progress)`.
- Produces: `useStormPlayback({ result, sharedClock?, reducedMotion })`.

- [ ] **Step 1: Write failing pure playback and control tests.**

~~~ts
it("never creates a path absent from the simulation", () => {
  const visible = visibleFlowPaths(result, 0.5);
  for (const path of visible) {
    expect(result.flowPaths).toContainEqual(
      expect.objectContaining({ points: path.points })
    );
  }
});

it("uses computed keyframes for reduced motion", () => {
  const state = reducePlayback(initialReducedMotion, { type: "PLAY" });
  expect(state.progress).toBe(1);
  expect(state.playing).toBe(false);
});
~~~

Component tests cover play, pause, seek, replay, immutable storm summary, water-balance counters, fallback badge throughout playback, and disabled playback without a response.

- [ ] **Step 2: Verify RED.**

Run: `npm test -- --run src/lib/storm-playback.test.ts src/hooks/useStormPlayback.test.ts src/components/analyze/StormModeDock.test.tsx`
Expected: FAIL because playback modules do not exist.

- [ ] **Step 3: Implement visualization-only animation.**

Sort flow paths by accumulated volume/arrival order already present in the response; progressively reveal coordinates within those paths. Fade risk zones according to response risk and playback progress. Interpolate water-balance counters from zero to the final computed values. Ambient rain is a decorative CSS layer labeled `visualization` and never contributes geometry or data.

Keep all playback state outside `FlowLayer` and `RiskHeatmap`. Those components receive a response subset and update existing MapLibre sources rather than recreate maps.

- [ ] **Step 4: Verify playback and render performance.**

Run: `npm test -- --run src/lib/storm-playback.test.ts src/hooks/useStormPlayback.test.ts src/components/analyze/StormModeDock.test.tsx`
Expected: PASS.

Run: `npm run build`
Expected: production build succeeds without adding a new chunk-size regression beyond the existing MapLibre warning.

- [ ] **Step 5: Commit Storm Mode.**

~~~text
Let computed runoff unfold across the terrain

Animate only hydrology response geometry on a shared controllable clock, with
water balance, fallback status, and reduced-motion keyframes kept in sync.

Constraint: Animation is a view of results, never a second simulation
Confidence: high
Scope-risk: moderate
Directive: FlowLayer and RiskHeatmap must never synthesize response features
Tested: Playback selectors, hook, controls, reduced motion; production build
Not-tested: Low-end mobile GPU frame rate
~~~

---

### Task 9: Constraint-Driven Spatial Catalyst Optimization

**Files:**
- Create: `src/lib/catalyst-optimization.ts`
- Create: `src/lib/catalyst-optimization.test.ts`
- Modify: `src/lib/catalyst.ts`
- Modify: `src/lib/catalyst.test.ts`
- Modify: `src/integrations/catalyst/localCompiler.ts`
- Modify: `src/integrations/catalyst/localCompiler.test.ts`
- Modify: `src/components/catalyst/CatalystFuturePanel.tsx`
- Create: `src/components/catalyst/CatalystFuturePanel.test.tsx`

**Interfaces:**
- Consumes: spatial eligible geometry, preserved `assessScenario` economics, Task 5 paired runner.
- Produces: `parseOptimizationRequest(text): ParseOptimizationResult`.
- Produces: `buildSpatialCandidates(context, request): InterventionCandidate[]`.
- Produces: `optimizeCounterfactual(request, candidates, evaluate): Promise<CounterfactualOptimizationResult>`.

- [ ] **Step 1: Write failing parser, budget, exclusion, feasibility, and determinism tests.**

~~~ts
it("parses reduce flood risk under $500k without guessing extras", () => {
  expect(parseOptimizationRequest("reduce flood risk under $500k")).toEqual({
    ok: true,
    request: { objective: "minimize-risk", maxBudgetUSD: 500_000 },
    unsupportedClauses: [],
  });
});

it("returns the closest feasible strategy without claiming target success", async () => {
  const result = await optimizeCounterfactual(
    { objective: "minimize-risk", target: 10, maxBudgetUSD: 1_000 },
    candidates,
    deterministicEvaluator
  );
  expect(result.feasible).toBe(false);
  expect(result.status).toBe("closest-feasible");
  expect(result.constraintGap).toBeGreaterThan(0);
  expect(result.strategy.costUSD).toBeLessThanOrEqual(1_000);
});
~~~

Also test allowed intervention filtering, excluded geometry, invalid/ambiguous currency, unsupported clauses, candidate eligibility, stable tie-breaking, no optimization claim under illustrative elevation, and preservation of current `solveForTarget` outputs through its adapter.

- [ ] **Step 2: Verify RED.**

Run: `npm test -- --run src/lib/catalyst-optimization.test.ts src/lib/catalyst.test.ts src/integrations/catalyst/localCompiler.test.ts`
Expected: FAIL because the unified optimizer does not exist.

- [ ] **Step 3: Implement the exact optimization boundary.**

~~~ts
export type ParseOptimizationResult =
  | {
      ok: true;
      request: OptimizationRequest;
      unsupportedClauses: string[];
    }
  | {
      ok: false;
      request: null;
      unsupportedClauses: string[];
      message: string;
    };

export interface InterventionCandidate {
  id: string;
  feature: InterventionFeature;
  costUSD: number;
  projected: ProjectedMetrics;
}

export interface CounterfactualOptimizationResult extends OptimizationResult {
  predicted: ProjectedMetrics;
  modeled?: RealitySimulation;
  assumptions: string[];
}
~~~

The parser recognizes objective phrases, plain/USD currency with k/m suffixes, allowed/excluded intervention names, and numeric targets. It returns unsupported clauses verbatim for correction rather than guessing.

Build candidates only from loaded eligible geometry. Rank bounded combinations deterministically using existing cost/score estimates, then run the strongest bounded candidates through real POSSIBLE hydrology. Respect the budget before evaluation. If terrain is illustrative, return projected estimates but disable modeled flood-risk-reduction claims.

- [ ] **Step 4: Consolidate both existing solver paths.**

Make `solveForTarget` and `LocalCatalystProvider` thin compatibility adapters over the new deterministic service. Preserve current public return fields and numeric regression tests. `CatalystFuturePanel` accepts natural-language constraints, shows the parsed request before execution, lets the user apply strategy geometry, and shows feasible/closest/unsupported status.

- [ ] **Step 5: Verify Catalyst compatibility and commit.**

Run: `npm test -- --run src/lib/catalyst-optimization.test.ts src/lib/catalyst.test.ts src/integrations/catalyst/localCompiler.test.ts src/components/catalyst/CatalystFuturePanel.test.tsx`
Expected: PASS.

Run: `npm run typecheck`
Expected: PASS.

~~~text
Let Catalyst optimize evidence instead of sliders

Unify Catalyst behind a typed constraint parser and spatial strategy service
that respects budgets, eligibility, exclusions, and infeasible outcomes.

Constraint: Illustrative terrain cannot support modeled risk-reduction claims
Confidence: medium
Scope-risk: broad
Directive: Natural language must compile to a visible typed request before optimization
Tested: Parser, feasibility, filters, deterministic ranking, legacy Catalyst adapters
Not-tested: Large combinatorial candidate sets beyond the bounded viewport
~~~

---

### Task 10: Data-Gated Temporal Lens and Active Source Inspector

**Files:**
- Create: `src/lib/temporal-layers.ts`
- Create: `src/lib/temporal-layers.test.ts`
- Modify: `src/hooks/useTemporalLens.ts`
- Modify: `src/components/catalyst/TemporalLens.tsx`
- Modify: `src/components/catalyst/EpochVeil.tsx`
- Modify: `src/components/analyze/SourceInspector.tsx`
- Modify: `src/components/catalyst/TemporalLens.test.tsx`

**Interfaces:**
- Produces: `selectTemporalEvidence(epoch, availableLayers): TemporalEvidenceState`.
- Produces: `TemporalEvidenceState = { epoch, layers, spatialAvailable, explanation, provenance }`.

~~~ts
export interface TemporalEvidenceState {
  epoch: Epoch;
  layers: Array<{
    sourceId: string;
    opacity: number;
    scientificStatus: ScientificStatus;
  }>;
  spatialAvailable: boolean;
  explanation: string;
  provenance: DataProvenance[];
}
~~~

- [ ] **Step 1: Write failing evidence-gate tests.**

~~~ts
it("does not render 1609 geometry without an approved spatial source", () => {
  const evidence = selectTemporalEvidence("1609", presentOnlyLayers);
  expect(evidence.spatialAvailable).toBe(false);
  expect(evidence.layers).toEqual([]);
  expect(evidence.explanation).toMatch(/spatial reconstruction is unavailable/i);
});

it("describes present as a composite with actual observation dates", () => {
  const evidence = selectTemporalEvidence("2026", mixedVintageLayers);
  expect(evidence.provenance.map((p) => p.observedAt)).toEqual(
    expect.arrayContaining(["2017", "2024"])
  );
});
~~~

- [ ] **Step 2: Verify RED.**

Run: `npm test -- --run src/lib/temporal-layers.test.ts src/components/catalyst/TemporalLens.test.tsx`
Expected: FAIL on the current unsourced historical treatment.

- [ ] **Step 3: Replace decorative veils with evidence stacks.**

1609 returns no spatial layer unless a registry entry has `availability: "live"`, an approved license, supported zoom, provenance, and real geometry. Present composes loaded spatial evidence while showing each observation date. Future composes the POSSIBLE surface and modeled result. Opacity/color transitions operate only on layers that exist; they do not morph unrelated geometry.

Remove the current `"past"`/`"1609"` mismatch and the unsourced National Geographic raster reference. Keep the 1609 benchmark only as clearly nonspatial context.

- [ ] **Step 4: Add keyboard and source-panel coverage.**

Arrow keys move through 1609/present/future, Home/End jump endpoints, Escape collapses, and focus remains on the scrubber. The source inspector updates per epoch and announces unavailable spatial evidence.

- [ ] **Step 5: Verify and commit.**

Run: `npm test -- --run src/lib/temporal-layers.test.ts src/components/catalyst/TemporalLens.test.tsx`
Expected: PASS.

Run: `npm run typecheck`
Expected: PASS.

~~~text
Make time reveal evidence instead of atmosphere

Gate each epoch by available sourced layers, preserve actual observation
dates, and explain absent historical geometry without changing the map.

Constraint: No approved licensed 1609 spatial asset is currently available
Confidence: high
Scope-risk: moderate
Directive: A visual historical transformation requires a live registry source
Tested: Temporal selectors, data gate, keyboard behavior, source updates
Not-tested: Licensed historical asset integration
~~~

---

### Task 11: Full-Screen Synchronized Compare Realities

**Files:**
- Rewrite: `src/components/catalyst/CompareRealities.tsx`
- Create: `src/components/catalyst/CompareRealities.test.tsx`
- Modify: `src/components/MapView.tsx`
- Modify: `src/components/FlowLayer.tsx`
- Modify: `src/components/RiskHeatmap.tsx`
- Modify: `src/pages/Analyze.tsx`

**Interfaces:**
- Consumes: two complete `RealityScene` values, `MapCameraState`, and one `StormPlaybackState`.
- Produces: `CompareRealitiesProps = { open, now, possible, camera, playback, onCameraChange, onClose }`.

- [ ] **Step 1: Write failing split, identity, synchronization, and accessibility tests.**

~~~ts
it("requires two real results for the same storm", () => {
  render(<CompareRealities {...propsWithDifferentStorms} />);
  expect(screen.getByText(/rerun the identical storm/i)).toBeVisible();
  expect(screen.queryByRole("slider")).not.toBeInTheDocument();
});

it("shares one playback progress across distinct surfaces", () => {
  render(<CompareRealities {...validProps} />);
  expect(screen.getByTestId("now-scene")).toHaveAttribute("data-storm-hash", "storm:fixed");
  expect(screen.getByTestId("possible-scene")).toHaveAttribute("data-storm-hash", "storm:fixed");
  expect(screen.getByTestId("now-scene")).not.toHaveAttribute(
    "data-surface-hash",
    validProps.possible.surface.surfaceHash
  );
});
~~~

Test divider pointer drag, ArrowLeft/ArrowRight, camera propagation without loops, pause/replay, Escape close, initial focus, focus restoration, missing POSSIBLE rerun state, and reduced motion.

- [ ] **Step 2: Verify RED.**

Run: `npm test -- --run src/components/catalyst/CompareRealities.test.tsx`
Expected: FAIL because the current component has a ready-callback mismatch and incomplete scene contract.

- [ ] **Step 3: Render two synchronized MapLibre scenes.**

Use two `MapView` instances with one controlled camera state. Clip the POSSIBLE scene with the divider, not with translated nested viewports. Each scene renders its own spatial surface, flow, risk, metrics, provenance, and scientific status. Both consume the same playback progress and storm hash.

Guard bidirectional camera updates with an origin token or equality check so a change applied to one map does not echo indefinitely. On mobile/reduced GPU mode, lower visual detail rather than replace either real result.

- [ ] **Step 4: Gate playback on complete comparable evidence.**

If POSSIBLE is missing or stale, display `Rerun identical storm` and dispatch the real request. If storm hash/model version differ, reject comparison. If surface hashes match, explain that no valid ground change exists.

- [ ] **Step 5: Verify compare and commit.**

Run: `npm test -- --run src/components/catalyst/CompareRealities.test.tsx src/pages/Analyze.test.tsx`
Expected: PASS.

Run: `npm run typecheck`
Expected: PASS.

Run: `npm run build`
Expected: PASS with no runtime callback type error.

~~~text
Put the two cities under one storm

Replace the partial veil with full-screen synchronized MapLibre realities,
one camera, one clock, distinct surfaces, and evidence-gated playback.

Constraint: Both real simulation responses must exist before playback
Confidence: high
Scope-risk: broad
Directive: Never substitute the NOW result for a missing POSSIBLE result
Tested: Divider, camera, playback, identity gates, keyboard, Analyze integration, build
Not-tested: Extended low-memory mobile session
~~~

---

### Task 12: Counterfactual Exports, Methodology, Visual QA, and Release Gate

**Files:**
- Create: `src/lib/counterfactual/export.ts`
- Create: `src/lib/counterfactual/export.test.ts`
- Modify: `src/lib/pdf-export.ts`
- Modify: `src/lib/pdf-export.test.ts`
- Modify: `src/lib/geo.ts`
- Modify: `src/lib/geo.test.ts`
- Create: `docs/mannahatta-counterfactual-methodology.md`
- Modify: `README.md`
- Modify: all files with lint errors introduced or touched by this plan

**Interfaces:**
- Produces: `buildCounterfactualExport(session): CounterfactualExport`.
- Produces: `toCounterfactualGeoJSON(exportData): FeatureCollection`.
- Preserves: all legacy PDF/CSV/GeoJSON function signatures and output readability.

- [ ] **Step 1: Write failing export-lineage and legacy-compatibility tests.**

~~~ts
it("includes paired identities, geometry, water balance, Catalyst, and provenance", () => {
  const result = buildCounterfactualExport(completeSession);
  expect(result.storm.hash).toBe(completeSession.storm?.hash);
  expect(result.realities.now.surfaceHash).toBeDefined();
  expect(result.realities.possible.surfaceHash).toBeDefined();
  expect(result.interventions[0].geometry.type).toMatch(/Polygon/);
  expect(result.provenance.length).toBeGreaterThan(0);
});

it("fails closed when counterfactual lineage is incomplete", () => {
  expect(() => buildCounterfactualExport(sessionWithoutSourceUrl))
    .toThrow(/provenance/i);
});

it("keeps the legacy present-state PDF path readable", () => {
  expect(() => generateLegacyPdf(existingFixture)).not.toThrow();
});
~~~

- [ ] **Step 2: Verify RED.**

Run: `npm test -- --run src/lib/counterfactual/export.test.ts src/lib/pdf-export.test.ts src/lib/geo.test.ts`
Expected: FAIL because paired export does not exist.

- [ ] **Step 3: Build fail-closed paired exports.**

The paired payload includes NOW/POSSIBLE surface hashes, storm definition/hash, model version, valid and invalid intervention geometry, eligibility, paired water balances, risk delta, Catalyst request/result/gap, source matrix, confidence, warnings, and caveats. GeoJSON properties carry source IDs and scientific status. PDF map captions name epoch and evidence status. CSV uses stable column names and one provenance row per source.

~~~ts
export interface CounterfactualExport {
  schemaVersion: "mannahatta-counterfactual/v1";
  generatedAt: string;
  storm: StormDefinition;
  realities: {
    now: {
      surfaceHash: string;
      simulation: RealitySimulation;
    };
    possible: {
      surfaceHash: string;
      simulation: RealitySimulation;
    };
  };
  interventions: InterventionFeature[];
  optimization: OptimizationResult | null;
  provenance: DataProvenance[];
  warnings: string[];
}
~~~

Legacy single-state exporters remain unchanged at their public boundary. Counterfactual export is unavailable with an actionable message when required lineage is incomplete.

- [ ] **Step 4: Document the model in product language.**

`docs/mannahatta-counterfactual-methodology.md` must explain:

- observed versus derived versus modeled versus projected;
- official NYC vector partial coverage and the catalog-only 2017 raster;
- D8 terrain routing and surface rainfall-excess changes;
- immutable storm and paired hashes;
- no sewer capacity or terrain modification;
- zero uncalibrated storage/roughness effects;
- synthetic elevation downgrade;
- Catalyst feasibility and closest-result semantics;
- 1609 data gate;
- reproduction fields in exports.

README links to this methodology without overstating the application.

- [ ] **Step 5: Run the full static and test gate; fix every failure before continuing.**

Run sequentially:

~~~text
npm run lint
npm run typecheck
npm test -- --run
npm run build
npm audit --omit=dev
git status --short
~~~

Expected: lint zero errors; typecheck PASS; all tests PASS; build PASS; audit reports no newly introduced high/critical production vulnerability; only intentional plan/implementation files appear in status.

- [ ] **Step 6: Run the required visual iteration gate.**

Start `npm run dev -- --host 127.0.0.1` and exercise:

1. 1440×900 desktop first-run storm → pause → edit → rerun → compare.
2. 768×1024 tablet edit tray, drawers, and compare.
3. 390×844 mobile touch controls and reduced-detail compare.
4. Keyboard-only search, intervention selection, playback, Temporal Lens, divider, Escape.
5. Reduced-motion storm and first-run flow.
6. Source failure, analysis failure, illustrative elevation, missing 1609, stale edit reset, and infeasible Catalyst constraint.

After each screenshot, run `visual-verdict`, store the verdict in `.omx/state/mannahatta/ralph-progress.json`, fix material hierarchy/spacing/contrast/overflow defects, and repeat until the verdict is PASS. Capture final screenshots under `docs/verification/mannahatta/` with a short evidence index.

- [ ] **Step 7: Run final scientific consistency checks.**

Verify in the rendered UI and exported artifacts:

- NOW/POSSIBLE storm hashes match;
- surface hashes differ after a valid edit;
- model versions match;
- POSSIBLE water balance closes;
- current/future metrics distinguish estimated from modeled;
- source dates are actual vintages;
- 1609 geometry is absent without a live approved source;
- the same edit is cleared on selecting a new place;
- no fake fallback object or unsourced URL remains.

- [ ] **Step 8: Commit release evidence and documentation.**

~~~text
Make counterfactual claims reproducible

Carry paired identities, geometry, water balances, optimization status, and
source lineage through exports, methodology, and final visual verification.

Constraint: Counterfactual export fails closed when required lineage is absent
Confidence: high
Scope-risk: moderate
Directive: Keep legacy exports readable while paired evidence evolves
Tested: Lint, typecheck, full Vitest suite, production build, audit, visual QA
Not-tested: Survey-grade calibration, sewer hydraulics, licensed 1609 geometry
~~~

---

## Plan Self-Review Checklist

- [x] Every approved product requirement maps to a task: map-first shell (7), spatial evidence (3), direct editing and instant metrics (4), physical hydrology response (5–8), Catalyst constraints (9), Temporal Lens (10), synchronized compare (11), provenance/exports (1, 3, 12), and the fifteen-second sequence (7).
- [x] The official six-inch raster is not silently replaced: its catalog status is visible, while the shipped official vector composite is marked partial with an unclassified remainder.
- [x] NOW and POSSIBLE identities are defined once and used consistently by reducer, client, edge cache, playback, compare, and export.
- [x] Existing scenario math remains the cost/score source of truth; geometry only derives its inputs.
- [x] Unsupported storage, roughness, drainage, wetland suitability, sewer behavior, and 1609 geometry remain zero, disabled, or unavailable with visible explanations.
- [x] Every task has a RED command, concrete implementation boundary, GREEN command, and Lore-format commit record.
- [x] No step contains an undefined function or type that is not produced by the same or an earlier task.
- [x] Final completion requires lint, typecheck, full tests, build, audit, clean artifact review, scientific checks, and screenshot evidence.
