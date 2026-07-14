---
name: verify
description: Build, serve, and drive this app in a headless browser to verify changes at the GUI surface.
---

# Verifying cognisync-terrain-weaver

SPA: React + Vite, routes `/` (landing), `/analyze` (MapLibre map + scan panel),
`/dashboard` (public feed), `*` (404).

## Build & serve

```bash
npm install
npm run build
npm run preview -- --port 4173 --host 127.0.0.1   # MUST pass --host: container has no IPv6, default "::" fails EAFNOSUPPORT
```

## Drive

Use Playwright with the preinstalled Chromium (do NOT `playwright install`):

```js
chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] })
```

Flows worth driving:
- Landing → nav to `/analyze`: maplibre vendor chunk should only load on nav (code splitting).
- `/analyze`: preset chips fly the map; after `moveend` the URL syncs to `?lat=&lng=&zoom=` (flyTo animation takes ~5s — wait for it). Deep links restore the view; garbage params fall back to Manhattan default.
- Copy-link button needs `permissions: ["clipboard-read", "clipboard-write"]` on the context.
- `/dashboard`: skeletons → cards, or error+Retry state.

## Environment gotchas

- The headless browser has no external egress here (tile hosts and the
  Supabase host get ERR_CONNECTION_RESET; hung requests are also possible):
  MapView tries Esri for 10s, fails over to EOX Sentinel-2 for 10s, then
  shows "Satellite imagery is unreachable" with a Reconnect button. The
  Analyze button stays disabled until real imagery arrives. The dashboard
  reaches its error state only after ~48s (15s abort timeout × 3 attempts).
  None of this reproduces on a real network.
- To verify actual tile rendering in this sandbox, intercept tile requests
  with `page.route` and fulfill them from Node `fetch` (Node ≥22 with
  `NODE_USE_ENV_PROXY=1` goes through the working proxy).
- Run analysis end-to-end (edge function → Gemini) is NOT verifiable here;
  verify around it.
