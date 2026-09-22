# Resilience decision workflow

Build on current main's local D8 routing, spatial editor and explicit example. Preserve routes, coefficients, backend contracts and dependencies.

## Delivery plan

1. Lock waterfront area, unrounded retention and editor hydration behavior with regression tests. Correct physical areas without changing the land-normalized score.
2. Add a same-forcing rainfall sensitivity workbench. Keep its bulk planning estimates distinct from spatially routed D8 results; expose water budgets and accessible chart data.
3. Guard analysis and paired storms against late responses, duplicate launches and changed edits. Publish completed storm pairs atomically.
4. Repair the split comparison: reveal the existing baseline map, size the future map to its actual container, preserve camera alignment, show readable metrics and support keyboard/touch interaction.
5. Verify numerical invariants, full tests, lint, app/node typechecks and production build. Inspect desktop and mobile in a browser, review the diff, and push a normal fast-forward commit to main.

Scientific boundary: modeled runoff is a screening estimate. Synthetic elevation remains explicitly illustrative. No flood forecast, surveyed surface eligibility or calibrated drainage model is claimed.

## Acceptance evidence

- Browser: example study, observed-terrain 50 mm storm, completed street-tree polygon, updated costs and retention, same-storm rerun, full-viewport comparison, Home/End/arrows/Escape, mobile resize, CSV download. No page errors.
- The exercised example reduced routed runoff from 29,714 to 29,448 cubic metres. This is a reproducible interaction check on illustrative land cover, not a measured site outcome.
- Geometry tests cover fully outside and partially clipped drawings, real-control untagged polygons, and controlled feature hydration on map replacement.
- Regression tests cover waterfront sizing, unrounded retention, budget constraints, competing surfaces, stale async responses, rainfall budgets and comparison controls.
- Live AI classification was not invoked during acceptance testing. Its unavailable-service and cancellation paths remain covered by component tests.

Final local checks: 342 tests in 57 files passed; app and node TypeScript checks passed; ESLint returned zero errors and 11 existing Fast Refresh warnings; production build passed with the existing large-chunk advisory.
