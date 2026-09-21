# Catalyst Temporal Lens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a hidden Vers3Dynamics Catalyst dimension inside Mannahatta's Analyze map: 1609, 2026, possible future, simulation evidence.

**Architecture:** Attach discovery to the existing `BaselineComparison` on Analyze, then reveal a Temporal Lens that reuses existing score, scenario, bbox, PDF, and hydrology helpers. Keep Catalyst provider logic typed and schema-validated under `src/integrations/catalyst`, with a local deterministic provider first and optional remote provider behind env config.

**Tech Stack:** React 18, TypeScript, Vite, MapLibre, existing shadcn/Radix UI, Zod, Vitest/RTL, existing Scenario Studio and simulation helpers.

---

### Task 1: Core Catalyst Contracts

**Files:**
- Create: `src/integrations/catalyst/types.ts`
- Create: `src/integrations/catalyst/schema.ts`
- Create: `src/integrations/catalyst/localCompiler.ts`
- Test: `src/integrations/catalyst/localCompiler.test.ts`
- Test: `src/integrations/catalyst/schema.test.ts`

- [ ] Write failing tests for action bounds, scientific status validation, deterministic minimum-intervention compilation, impossible target handling, and "proven" language avoidance.
- [ ] Implement strongly typed Catalyst context, action, experiment, result, and provider contracts.
- [ ] Implement Zod validators for external/remote responses and URL-restored state.
- [ ] Implement `LocalCatalystProvider` using existing `assessScenario` / `projectScore`, with no duplicated score formulas.

### Task 2: Site Context and Persistence

**Files:**
- Create: `src/integrations/catalyst/context.ts`
- Create: `src/integrations/catalyst/fieldNotes.ts`
- Test: `src/integrations/catalyst/context.test.ts`
- Test: `src/integrations/catalyst/fieldNotes.test.ts`

- [ ] Write failing tests for safely mapping `AnalysisRecord`, bbox, active scenario, rainfall, simulation result, missing values, and provenance.
- [ ] Build `CatalystSiteContext` from the active Analyze state without inventing missing numbers.
- [ ] Generate human-readable IDs like `MNH-CF-0042` and persist field notes locally.

### Task 3: Hidden Unlock and Temporal Lens

**Files:**
- Create: `src/hooks/useCatalystUnlock.ts`
- Create: `src/hooks/useTemporalLens.ts`
- Create: `src/components/catalyst/CatalystGlyph.tsx`
- Create: `src/components/catalyst/CatalystUnlock.tsx`
- Create: `src/components/catalyst/TemporalLens.tsx`
- Modify: `src/components/BaselineComparison.tsx`
- Test: `src/components/catalyst/CatalystUnlock.test.tsx`
- Test: `src/components/catalyst/TemporalLens.test.tsx`

- [ ] Write failing tests for hold start, early release, complete hold, keyboard hold, localStorage restore, reduced-motion safety, lens switching, historical unavailable behavior, and future restoration.
- [ ] Replace passive 79.1 text with a semantic hold button that visually separates the digits and persists discovery under `mannahatta:catalyst-unlocked`.
- [ ] Reveal the timeline extension only after unlock: `1609 -> 2026 -> +`.
- [ ] Keep Catalyst absent from primary navigation.

### Task 4: Map-Native Catalyst Experience

**Files:**
- Create: `src/components/catalyst/GhostLandscape.tsx`
- Create: `src/components/catalyst/FutureEditor.tsx`
- Create: `src/components/catalyst/CounterfactualCompare.tsx`
- Create: `src/components/catalyst/HypothesisCompiler.tsx`
- Create: `src/components/catalyst/ExperimentPlan.tsx`
- Create: `src/components/catalyst/ExperimentOutcome.tsx`
- Create: `src/components/catalyst/FieldNotes.tsx`
- Modify: `src/pages/Analyze.tsx`
- Test: focused unit/component tests where practical.

- [ ] Render a provenance-labeled ghost landscape overlay using only available or clearly approximated footprint data.
- [ ] Provide future editing controls that call existing scenario math and produce map/metric changes.
- [ ] Compile deterministic hypotheses and present assumptions, limitations, falsification criteria, and execution status.
- [ ] Add shareable scenario IDs to the Analyze URL without storing large payloads.

### Task 5: Reports, Route, Backend Bridge, Docs

**Files:**
- Modify: `src/lib/pdf-export.ts`
- Modify: `src/lib/geo.ts`
- Modify: `src/App.tsx`
- Create: `src/pages/CatalystFieldLab.tsx`
- Modify: `backend/app/main.py`
- Modify: `backend/app/models/schemas.py`
- Create: `docs/catalyst-temporal-lens.md`

- [ ] Add optional Counterfactual Field Report section to PDF exports.
- [ ] Add `/field-lab` as a lazy route without nav exposure and graceful no-context state.
- [ ] Add optional FastAPI health/compile/evaluate endpoints that report local mode unless `vers3dynamics_catalyst` exists.
- [ ] Document unlock, provenance, local/remote providers, security, persistence, reports, and scientific-status rules without public README spoilers.

### Task 6: Verification

**Files:**
- All touched files.

- [ ] Run focused tests after each red/green loop.
- [ ] Run `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`.
- [ ] Run backend tests or at least Python import/schema checks if backend changed.
- [ ] Security review: env exposure, remote validation, user text rendering, no `eval`, GeoJSON/URL validation, secrets scan without printing secret values.
