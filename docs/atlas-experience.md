# Resilience atlas experience

Make the entry screen explain the map, leave the study area visible, and offer a useful path before a live scan. Keep the existing React, MapLibre, and hydrology stack.

Scope: docked introduction and search, green cartographic styling, explicit example data and local rainfall estimates, accurate viewport information, responsive controls. Preserve live analysis, exports, scenario drawing, and tactical tools.

Verification: regression suite; fixture integrity, example entry, rainfall interaction and provenance tests; production build, app TypeScript compilation, lint; desktop/mobile browser checks for search, example, reset, rainfall and export. No new dependencies.

The example is not measured data. Its name and notes carry that distinction into exports. It is never saved to the feed. The local storm calculator estimates bulk runoff only and never fabricates flow paths or flood zones.
