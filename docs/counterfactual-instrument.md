# Counterfactual instrument: implementation evidence

## Hypotheses and changes

- **Allocation correctness:** whole-option greedy allocation consumes pavement with trees and can miss reachable targets. The replacement builds a per-source concave cost/retention envelope with incremental replacement segments. A paved 1,000 m² fixture reaches score 85 using half trees / half bioswales for $55,000; score 90 requires all bioswales ($65,000). Tests compare budget solutions against an exhaustive feasible grid and verify waterfront sizing, zero budgets and source capacity.
- **Inspectable uncertainty:** paired vegetation/pavement transfers reveal input sensitivity without manufacturing a confidence interval. The experiment preserves composition and water area, uses the existing bulk engine, caps unavailable transfers and leaves study state unchanged.
- **Evidence survives export:** CSV/GeoJSON carry status independent of filenames; PDFs repeat evidence class; JSON bundles inputs, assumptions, drawings and routed outputs with an evidence hash. No claim of a source-complete replay archive.
- **No fabricated emergency evidence:** retired the public Tactical operational surface and removed navigation promotion. Existing URLs explain why coordinates alone cannot imply hazards.
- **Provenance language:** reconstructed history is labeled reconstructed; accumulation/cell-area readouts are explicitly not flood depth; source classification is validated before accepting model percentages. The same validator is used by classifier and MCP boundaries.

## Architecture preserved

Existing local hydrology, spatial clipping/eligibility, comparison camera synchronization, same-storm sealing, stale-request guards and shared coefficients remain. The main page gets small domain panels and an export helper rather than a broad state rewrite. Aggregate solver output does not bypass canonical geometry. npm matches CI; the two unused alternative lockfiles were removed.

## Verification

Baseline: 355/356 tests passed; one storm experience test depended on real elevation fetch completion. The test now explicitly invokes the real engine with unavailable elevation, exercising deterministic fallback instead of a network race.

Final automated verification: 371 tests passed across 63 files; application and Node TypeScript checks passed; ESLint reported zero errors and 11 existing Fast Refresh warnings; production build passed with the existing large-chunk advisory.

The dev server starts at 127.0.0.1:43147. Browser acceptance is blocked in this environment: agent-browser's daemon fails to start, its Chrome installer rejects the download certificate, and the installed Playwright runtime receives an invalid browser archive. No desktop/mobile screenshot, live-classification run, polygon-drawing session or downloaded-export browser check is claimed. Component tests and build output do not substitute for those acceptance checks.

## Remaining product work

A spatial DIFFERENCE layer, complete deterministic replay/import, a general AI planning tool protocol, benchmark action logging, lifecycle cost sourcing and independent event validation remain unimplemented. The historical source enum retains its legacy `observed` value internally for compatibility, while the user-facing panel correctly says reconstructed. Some older dashboard and report band labels still use risk language; interpret them as score categories, not measured hazard probabilities.

The README figure is a calculated synthetic fixture diagram, not a geographic map or current UI screenshot. Replacing it with captured, provenance-labeled desktop/mobile demonstrations remains part of browser acceptance.
