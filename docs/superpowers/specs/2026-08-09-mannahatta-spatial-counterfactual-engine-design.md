# Mannahatta spatial counterfactual engine

**Date:** 2026-08-09
**Status:** Approved design
**Scope:** Manhattan-first spatial counterfactual workflow

## Purpose

Mannahatta will become a map-first spatial counterfactual engine rather than an urban resilience dashboard. Its defining experience is a controlled experiment:

> Run a storm on the current city, change the ground, rerun the identical storm, and watch the future respond.

The product journey is:

`Find a place -> understand it -> simulate a storm -> redesign the ground -> rerun the storm -> let Catalyst optimize -> compare realities.`

The first defensible release is Manhattan/NYC-first. Other locations may use a clearly labeled lower-confidence fallback, but no fallback may imply historical, land-cover, elevation, or hydrological precision that its source data cannot support.

## Goals

- Make the map the primary interface and hide dashboard detail until requested.
- Replace whole-tile-only land-cover summaries with inspectable spatial layers.
- Attach provenance, confidence, vintage, and scientific status to every spatial layer and result.
- Animate runoff and risk from the existing D8 hydrology engine.
- Let users paint interventions directly onto eligible map geometry.
- Update estimated cost, absorption, runoff, and risk immediately after every edit.
- Run current and possible surfaces through the same hydrology engine with the same immutable storm.
- Let Catalyst solve spatial intervention strategies under budget and outcome constraints.
- Turn 1609, present, and future into a data-gated Temporal Lens.
- Provide a full-screen draggable NOW / POSSIBLE comparison with synchronized storms.
- Preserve existing scoring, scenario economics, exports, Catalyst behavior, tests, and scientific caveats.

## Non-goals

- Survey-grade engineering, drainage design, or regulatory flood certification.
- Fabricated 1609 shorelines, habitats, streams, or parcel-scale historical geometry.
- Claiming that a 2017 observation is a 2026 measurement.
- Silently substituting synthetic terrain or demo data when a real-location request fails.
- Replacing the current React, MapLibre, Supabase, scenario, export, or hydrology foundations.
- Modeling sewer capacity until an authoritative drainage dataset and calibrated model are available.

## Product principles

1. **The map is the interface.** Search, tools, metrics, time, provenance, and comparison float over one spatial canvas.
2. **The same storm means the same storm.** NOW and POSSIBLE share one immutable storm definition and clock.
3. **Fast estimates are labeled estimates.** Painting updates client-side projections immediately; the rerun produces the modeled hydrology result.
4. **Every claim has lineage.** A user can inspect where a visible pixel, geometry, score, or flow came from.
5. **Absence is more honest than invention.** Unsupported historical geometry stays unavailable.
6. **Demo data is explicit.** The guided sample is a versioned replay derived from declared sources, never a silent production fallback.

## First-run experience

The root experience opens on a full-viewport Manhattan map. A lightweight loading shell protects route-level map code splitting, but there is no separate dashboard-style landing page.

### Fifteen-second sequence

1. **0-3 seconds: storm the current city.** Lower Manhattan loads and a fixed storm begins. Rainfall, accumulating runoff, flow paths, and risk zones animate together.
2. **3-7 seconds: reveal the consequence.** Playback pauses at peak impact. At-risk corridors remain illuminated while a compact intervention tray rises from the bottom edge.
3. **7-11 seconds: redesign the ground.** The user paints a bioswale, tree canopy, permeable pavement, green roof, or wetland on eligible geometry. Cost, absorption, estimated runoff, and estimated risk update beside the pointer and in the HUD.
4. **11-15 seconds: replay the identical storm.** The same storm reruns against the changed surface. Retained water and reduced or truncated flow paths become visible. The sequence ends by opening the draggable NOW / POSSIBLE split.

If a first-time user does not interact, the interface pauses at the edit prompt rather than fabricating an edit. An optional clearly labeled guided replay may demonstrate a precomputed intervention.

### Persistent map chrome

- Top center: place search and current location label.
- Top left: product mark and compact session actions.
- Top right: source/provenance control, export, and methodology.
- Bottom center: intervention palette and brush controls.
- Bottom left: Storm Mode playback and immutable storm summary.
- Bottom right: four-metric HUD for cost, absorption, runoff, and risk.
- Temporal Lens: compact map-native scrubber that expands only while in use.
- Detail surfaces: temporary drawers anchored to the selected map feature or metric.

Permanent sidebar columns are removed from the primary workflow. Keyboard navigation, visible focus, reduced-motion behavior, and touch-sized controls remain required.

## Canonical domain model

### Provenance

```ts
type ScientificStatus =
  | "observed"
  | "derived"
  | "modeled"
  | "projected"
  | "speculative";

interface DataProvenance {
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
```

Provenance attaches to layers and derived results. It must survive sharing and PDF, CSV, and GeoJSON export.

### Spatial reality

```ts
interface StormDefinition {
  id: string;
  rainfallDepthMm: number;
  durationMinutes: number;
  distribution: "uniform";
  resolution: "low" | "medium" | "high";
  includeDrainage: false;
  hash: string;
}

interface InterventionFeature {
  id: string;
  type: InterventionType;
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  areaM2: number;
  parameters: InterventionParameters;
  eligibility: EligibilityResult;
  provenance: DataProvenance[];
}

interface RealitySurface {
  id: "now" | "possible";
  baselineLayerHash: string;
  interventionHash: string;
  interventions: InterventionFeature[];
  modifiers: SurfaceModifierGrid;
  provenance: DataProvenance[];
}

interface RealitySimulation {
  stormHash: string;
  surfaceHash: string;
  modelVersion: string;
  flowPaths: FlowPath[];
  riskZones: RiskZone[];
  waterBalance: {
    rainfallM3: number;
    infiltratedM3: number;
    storedM3: number;
    runoffM3: number;
  };
  warnings: string[];
  provenance: DataProvenance[];
}
```

`CounterfactualSession` owns the selected place, viewport, baseline layers, current edits, one immutable storm, NOW result, POSSIBLE result, Catalyst proposal, epoch, comparison state, and export lineage. Resetting or selecting a new place clears all location-bound state.

## Data architecture

### Manhattan source registry

The first release uses a server-owned registry rather than embedding source assumptions in components.

| Layer | Initial source | Product treatment |
| --- | --- | --- |
| Land cover | NYC 2017 six-inch, eight-class LiDAR-derived raster | Observed 2017; tiled for display and resampled for simulation |
| Elevation | NYC 2017 one-foot topo-bathymetric LiDAR DEM | Observed 2017; datum and collection window retained |
| Buildings | NYC Open Data building footprints | Source vintage shown independently from land cover |
| Trees | NYC Parks tree inventory/census where applicable | Point observation only; never converted into unsupported canopy polygons |
| Flood context | NYC DEP stormwater flood maps | Validation/context overlay, not generated-model ground truth |
| National elevation fallback | USGS 3DEP | Explicit lower-resolution fallback outside NYC |
| 1609 | Approved, licensed historical source when available | Spatial display is data-gated; otherwise benchmark/context only |

Initial source references:

- https://catalog.data.gov/dataset/land-cover-raster-data-2017-6in-resolution
- https://elevation.its.ny.gov/arcgis/rest/services/Dem_Indexes/FeatureServer/0
- https://data.cityofnewyork.us/d/jh45-qr5r
- https://www.nyc.gov/site/dep/environment/climate-resiliency.page
- https://www.usgs.gov/3d-elevation-program

The source registry records checksums, access dates, projection, source resolution, processing steps, and licenses. Preprocessed Manhattan fixtures and tiles must be reproducible from registry entries.

### Spatial land-cover layers

The map displays classed land-cover pixels or generalized polygons at appropriate zoom levels. Selecting a location reports class, source vintage, confidence, resolution, and processing lineage. Whole-area percentages remain available as a summary derived from the visible spatial data; they are no longer the only representation.

The original six-inch raster is not shipped wholesale to the browser. Server-side preprocessing produces a display tile pyramid and simulation-ready grids. Simulation resolution follows the existing low/medium/high contract and never implies the source raster's full precision survived resampling.

## Direct map editing

The editor stores real GeoJSON geometry per intervention instead of converting all drawings immediately into whole-area fractions.

Eligibility rules are spatial:

- Green roofs intersect building footprints and cannot exceed eligible roof area.
- Permeable pavement intersects road, paved, plaza, or other eligible impervious classes.
- Bioswales intersect eligible public-realm or open-space surfaces and use storage/infiltration parameters.
- Trees intersect non-building eligible surfaces and remain distinct from observed tree inventory points.
- Wetlands intersect suitable non-building low areas; the tool does not assert ecological restoration feasibility.

Invalid regions remain visible with an explanation. Geometry operations produce canonical area totals, then existing scenario math calculates costs, retention, score, and payback. The client provides immediate projected metrics, labeled `estimated until storm rerun`.

## Hydrology changes

The existing D8 flow-direction and accumulation engine remains the terrain-routing foundation. The counterfactual extension changes runoff generation and velocity rather than inventing new terrain elevations.

For every simulation cell:

1. Read elevation and derive the existing D8 receiver.
2. Read baseline land cover.
3. Apply intervention-derived infiltration, depression-storage, and roughness modifiers.
4. Convert the immutable storm into rainfall excess after infiltration and storage.
5. Route excess water through the existing accumulation graph.
6. Derive flow volume, relative velocity, risk zones, and water balance.

NOW uses the baseline surface. POSSIBLE uses the same elevation and storm but a different surface hash and modifier grid. Bioswales and wetlands may retain or truncate flows; permeable cover and vegetation reduce rainfall excess; roughness affects velocity. The first release does not claim that interventions change surveyed topography or sewer capacity.

The simulation request rejects unsupported parameters. `includeDrainage` remains disabled until drainage is implemented rather than being accepted and ignored. Results include storm hash, surface hash, model version, assumptions, fallback warnings, and provenance.

## Storm Mode

Storm Mode renders hydrology outputs against a shared animation clock:

- rainfall front and ambient precipitation;
- progressive flow-path draw using volume and velocity;
- risk-zone accumulation rather than an instant static heatmap;
- water-balance counters synchronized to playback;
- pause, scrub, replay, and reduced-motion modes.

Animation is a visualization of computed results, not a separate simulation. It must not invent paths absent from the response. If the response is illustrative because synthetic or fallback terrain was used, Storm Mode displays that status throughout playback.

## Catalyst optimization

The two existing Catalyst solver paths are consolidated behind one typed optimization service.

```ts
interface OptimizationRequest {
  objective: "minimize-risk" | "maximize-absorption" | "minimize-runoff";
  target?: number;
  maxBudgetUSD?: number;
  allowedInterventions?: InterventionType[];
  excludedGeometry?: GeoJSON.MultiPolygon;
}
```

Natural-language constraints map into this explicit request. For example, `reduce flood risk under $500k` becomes a minimize-risk request with a `$500,000` budget. Unsupported or ambiguous clauses are surfaced for correction rather than guessed.

Catalyst generates eligible spatial candidates from the source layers, evaluates them using the preserved scenario economics, and runs the strongest bounded candidates through counterfactual hydrology. It returns the best feasible strategy, its geometry, predicted metrics, assumptions, evidence, and remaining constraint gap. If no strategy satisfies the request, Catalyst returns the closest feasible result instead of claiming success.

## Temporal Lens

The Temporal Lens keeps one camera and changes the active evidence stack:

- **1609:** only approved historical spatial assets at supported scales. Without them, the map remains unchanged and the lens explains that spatial reconstruction is unavailable; the existing benchmark may still appear as nonspatial context.
- **Present:** the best available composite, with each layer's actual observation date visible. `2026` describes the current product reality, not a claim that every source was collected in 2026.
- **Future:** the user or Catalyst intervention surface plus modeled results and projections.

Transitions interpolate opacity, class colors, and derived surfaces without implying geometric continuity between unrelated datasets. A provenance drawer updates with the active epoch.

## Compare Realities

Compare Realities is a full-screen pair of synchronized MapLibre scenes:

- one camera state controls both maps;
- a draggable divider clips NOW and POSSIBLE;
- both scenes share the same storm clock and storm hash;
- each side has its own surface hash, overlays, metrics, and provenance;
- playback starts only when both real simulation results exist;
- a missing future result triggers a real rerun, never duplication of the NOW response.

The existing `MapView` ready callback is normalized to expose its imperative handle or map instance consistently. Compare and the main analysis scene consume the same typed `RealityScene` contract.

## Failure and fallback behavior

- A failed real analysis shows an actionable error and preserves the last valid session.
- A real request never falls back to a fake `AnalysisRecord` or shape-incompatible simulation payload.
- The guided Lower Manhattan sample is an explicit, versioned `guided example` with declared sources and model version.
- Synthetic elevation marks the full result `illustrative` and disables claims of optimized flood-risk reduction.
- Missing historical data disables spatial transformation for that epoch.
- Source or tile failures identify the missing layer and the metrics affected.
- Exceeding the existing simulation-area cap asks the user to zoom in and shows the supported extent.
- Stale edits cannot cross into a new scan or location.
- Counterfactual export and sharing fail closed if required lineage is absent; legacy present-state exports remain backward compatible.

## Exports and sharing

Existing PDF, CSV, GeoJSON, and scenario exports remain backward compatible. Counterfactual sessions add:

- NOW and POSSIBLE surface hashes;
- immutable storm definition and hash;
- intervention geometries and eligibility results;
- paired water balances and risk deltas;
- Catalyst request, feasibility status, and strategy;
- provenance matrix and confidence;
- model version, warnings, and scientific caveats.

Map images in reports label their epoch and evidentiary status. Derived metrics retain enough lineage to reproduce the comparison.

## Verification strategy

### Regression protection

- Preserve all existing absorption, baseline, scenario, Catalyst, GIS, PDF, and simulation tests.
- Add regression tests before refactoring behavior that lacks coverage.
- Keep old exports readable and existing scenario calculations numerically stable.

### Unit and property tests

- Rasterization and overlap handling for every intervention.
- Eligibility rules and area conservation.
- Provenance propagation through derived layers and exports.
- Storm and surface hashing.
- Deterministic hydrology replay.
- Identical storm plus identical surface yields identical results.
- Increased infiltration cannot increase total generated runoff, while local redistribution remains allowed.
- Water balance closes within a documented tolerance.
- Catalyst respects budgets, eligibility, exclusions, and infeasible targets.

### Integration tests

- Paint -> geometry -> modifiers -> future request -> changed surface hash -> distinct hydrology result.
- NOW and POSSIBLE share the storm hash and model version.
- New place/reset removes edits, future results, and comparison state.
- Fallback elevation visibly downgrades confidence.
- Exports include counterfactual evidence and provenance.

### Component and end-to-end tests

- MapEditor drawing, invalid regions, undo, clear, and controlled state.
- Storm Mode playback, pause, replay, and reduced motion.
- Temporal Lens data gating and source display.
- Catalyst constraint entry and infeasible-result behavior.
- Compare divider, synchronized camera, and synchronized storms.
- First-run current storm -> user edit -> same-storm rerun -> split reveal.
- Desktop, tablet, mobile, keyboard, and screen-reader smoke paths.

### Completion gate

The implementation is complete only when:

- lint, typecheck, all tests, and production build pass;
- server-side hydrology tests pass;
- the working tree contains no unexplained artifacts;
- the defining first-run sequence has visual evidence;
- no known runtime contract errors remain;
- scientific caveats and provenance are visible in-product and exported.

## Acceptance criteria

1. The map owns the viewport and no permanent dashboard sidebar competes with it.
2. A user can inspect spatial land-cover classes and their provenance.
3. Painting an intervention retains its geometry and updates estimated cost, absorption, runoff, and risk within 150 ms under the supported viewport cap.
4. Rerunning uses exactly the same storm hash against a distinct surface hash.
5. The modeled POSSIBLE result differs because the hydrology engine consumed surface modifiers, not because animation fabricated a difference.
6. Catalyst can produce or reject a budget-constrained spatial strategy such as `reduce flood risk under $500k`.
7. The Temporal Lens never renders unsupported historical geometry.
8. Compare Realities runs synchronized NOW and POSSIBLE Storm Mode results in a draggable full-screen split.
9. Existing scoring, scenario math, exports, Catalyst contracts, and scientific caveats remain protected.
10. A first-time visitor reaches the storm -> edit -> rerun -> compare insight in roughly fifteen seconds without documentation.

## Principal risks

- A licensed, implementation-ready 1609 spatial source may not be available. The data gate is intentional.
- High-resolution NYC rasters require preprocessing and cannot be fetched wholesale in the browser.
- The current edge-function hydrology has no direct automated coverage and must be locked down before extension.
- Local changes may reduce total runoff while shifting risk between cells; UI copy must distinguish total improvement from local redistribution.
- MapLibre dual-scene rendering and animation can be GPU-intensive; reduced detail and mobile limits may be required.
- Current TypeScript strictness allows contract drift. New counterfactual boundaries should be strict even if repository-wide strict mode remains a later migration.

## Architectural decision

Implement a canonical spatial-reality and counterfactual-session layer inside the existing stack. Do not continue adding cinematic behavior directly to `Analyze.tsx`, do not fake future hydrology, and do not replace the scientific core with a visual-only simulation. Extract session and scene boundaries first, then connect editing, hydrology, Catalyst, time, compare, and exports to those contracts.
