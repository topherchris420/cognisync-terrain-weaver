# Historical imagery: sources, failures and verification

The era timeline (`src/lib/historical/eras.ts`) draws one published layer per
year. This note records why the aerial years stopped rendering, what replaced
them, and how each era was verified. Re-check the live services at any time
with `npm run eras:check` (opt-in, needs network; never run in CI).

## What broke

| Symptom | Root cause | Resolution |
|---|---|---|
| 1924, 1951, 1996, 2006, 2016, 2018 drew grey "Map Tile Service has moved" tiles, or nothing | `maps.nyc.gov/xyz/1.0.0/photo/{year}/…` was retired. It answers **every** request, for every year, with HTTP 200 and the same 10,519-byte placeholder PNG, so MapLibre drew it without any error. A single 1924 tile at z16 was still cached, so 1924 looked partly alive. | Each year now reads NYC OTI's own cached orthoimagery service for that year on ArcGIS Online (table below). |
| A retired or placeholder service went unnoticed | No check that tiles were real imagery. MapLibre only reports non-404 HTTP failures; 404s and placeholders are silent. | Before drawing, `probeEraImagery` fetches two tiles at different places. Both must be real images by magic number, and they must differ. Pointed at the old endpoint, it reports all six years as unavailable. |
| Empty scene after switching year, worst in 3D | Era layers waited for `map.isStyleLoaded()`, which stays false while **any** tile is in flight: exactly the moment after a switch, and constantly while terrain DEM tiles stream. Installation slipped to the next full `idle`. | `styleReady()` checks that the style document is parsed, which is all `addSource` needs. |
| Historical photo covered the flood model, flow paths and labels | Era rasters were added to the top of the layer stack. | Era rasters sit directly above the base imagery, below hillshade, labels and analysis overlays. The 1609 blocks and floodplain polygons sit above the era raster. |
| Today's imagery visible under a historical label | Outside a survey's footprint, the full-colour base map showed through. | In a view of the past the base imagery is greyed and faded (`setBaseImageryRole`) from the moment the year is chosen: orientation only, never mistakable for that year. |
| Modern towers standing in 1924 | The 3D view extruded present-day OpenStreetMap buildings for every era. | `presentDayBuildings` is false for every past era; MapView hides the extrusions and the 3D caption says the photograph is draped over today's terrain. |
| Land-cover analysis could classify historical imagery as today | `captureImage()` captured era overlays. | The capture hides every era layer and restores the base imagery's colour, then puts both back. |
| Stale or racing layers | Probe and data responses were not tied to the request that asked for them. | Each layer effect ignores answers after cleanup; 1609 blocks and floodplains discard out-of-order responses. Cleanup removes the source, layer, listeners and timers. |
| 2050s, 2080s and 2100 floodplains showed nothing at block scale, or only a strip | The request box snapped each edge to the nearest 0.05° grid line, so a view narrower than a cell collapsed to a line (the default Lower Manhattan view at z15 became a zero-height strip at 40.70°), and one capped request of 800 rows dropped most of the 2050s polygons in a zoomed-out view. | `requestBoxFor` snaps the box outward so it always contains the view, and `loadFloodplain` pages through the result in a fixed order until a short page arrives. |
| Comparison panes leaked listeners and were always flat | Camera-sync listeners were never removed; panes ignored 3D and buildings. | Listeners belong to an effect with cleanup; panes follow the main view's 3D (flat on screens under 640 px, to spare GPU memory) and each pane's era decides buildings. |

## Sources

All aerial services are Web Mercator (EPSG:3857), 256 px, cached levels 0–20
(level 21 answers 404), and answer 404 outside the city. `bounds` is the
service extent clipped to New York City, so MapLibre never requests a tile
that cannot exist.

| Era | Service | Publisher (as stated by the service) | Captured |
|---|---|---|---|
| 1609 | Welikia `1609Sat/tiles_60k_new` (z ≤ 16) | Welikia Project, WCS — **reconstruction** | — |
| 1924 | `Ortho_1924_Mosaic` | NYC OTI, from the Department of City Planning | 1924 |
| 1951 | `NYC_Orthos_1951` | NYC OTI, from the Municipal Archives | 1951 |
| 1996 | `Ortho_1996_Mosaic` | City of New York (OTI) | April 1996; Manhattan June 1996 |
| 2001–02 | `NYC_Orthos_2001_2` | NYC OTI (the service credits "NYP DOS") | Manhattan and Staten Island 2001; Bronx, Brooklyn and Queens 4 Apr 2002 |
| 2004 | `NYC_Ortho_2004` | NYC OTI (DoITT) | 19 Apr – 4 May 2004 |
| 2006 | `NYC_Orthos_2006` | NYS Orthoimagery Program, via NYC OTI | Spring 2006 |
| 2008 | `NYC_Orthos_2008` | NYS Orthoimagery Program, via NYC OTI | 10 Mar – 14 May 2008; Manhattan June 2008 |
| 2010 | `NYC_Orthos_2010` | NYS Orthoimagery Program, via NYC OTI | 1 – 10 Apr 2010; Manhattan 15 Jun 2010 |
| 2012 | `NYC_Orthos_2012` | NYS Orthoimagery Program, via NYC OTI | 30 Mar – 6 Apr 2012; Manhattan 15–20 Jun 2012 |
| 2014 | `NYC_Orthos_2014` | NYS Orthoimagery Program, via NYC OTI | 1 – 3 Apr 2014; Manhattan 1 Jun 2014 |
| 2016 | `NYC_Orthos_2016` | NYS Orthoimagery Program, via NYC OTI | 26 Mar – 5 Apr 2016 |
| 2018 | `NYC_Orthos_2018` | NYS Orthoimagery Program, via NYC OTI | 14 Apr – 2 May 2018 |
| 2020 | `NYC_Orthos_-_2020` | NYS Orthoimagery Program (service description), via NYC OTI | 21 Mar – 11 Apr 2020 |
| 2022 | `NYC_Orthos_2022` | NYC OTI | 16 – 30 Mar 2022 |
| 2024 | `NYC_Orthos_2024` | NYC OTI | 14 – 24 Mar 2024 |
| Today | Esri World Imagery (EOX Sentinel-2 fallback) | Esri, Maxar | varies by tile |
| 2050s / 2080s / 2100 | NYC Open Data `27ya-gqtm`, `ek8y-fsqz`, `rf9r-c4pz` | Mayor's Office of Climate & Environmental Justice — **projection** | — |
| +3 ft | NOAA `dc_slr/slr_3ft` (z ≤ 16) | NOAA Office for Coastal Management — **projection** | — |

Services are under `https://tiles.arcgis.com/tiles/yG5s3afENB5iO9fj/arcgis/rest/services/`.
Capture dates for 2001–2014 and 2020–2024 are from the City's
[aerial imagery metadata](https://github.com/CityOfNewYork/nyc-geo-metadata/blob/main/Metadata/Metadata_AerialImagery.md).
2001–02 is two flights: Manhattan and Staten Island in 2001 (the Manhattan
orthos were flown on 3 and 21 July, so the World Trade Center stands), the
Bronx, Brooklyn and Queens in 2002. Its Staten Island tiles stop at level 19,
the map's own deepest zoom (`maxZoom` in `MapView.tsx`), so level 20 is never
requested there; if it were, MapLibre treats a 404 as a missing tile and
enlarges the level-19 one.
For 2008–2012 the metadata and the service descriptions disagree on which
buildings outside Manhattan were corrected for lean (over five stories, or
over six), so the app says only "taller buildings".

No year is unavailable today. If a publisher retires a service again, the
probe marks that year **Unavailable** with the reason, draws nothing for it,
and keeps the base imagery greyed; nothing is substituted.

## Limits the app states with each layer

- 1924 and 1951 are scanned prints georeferenced by hand to later imagery.
  Edges can sit several metres off, and 1924 shows straight seams between prints.
- Every past era is a flat image draped over **today's** elevation model.
  Shorelines, landfill and grading have changed, and no historical 3D building
  model exists, so the 3D view of the past shows no buildings at all.
- 1609 is a scholarly reconstruction rendered as a landscape, not a photograph.
- Projections are drawn over today's city and are not imagery of the future.

## Loading states

`Loading → Ready / Empty / Unavailable / Error` (`src/lib/historical/era-imagery.ts`).

- **Unavailable**: 4xx, HTML, or the placeholder. Cached for the session, never retried.
- **Error**: network failure, 5xx or timeout. The probe retries twice with
  backoff (0.5 s, 1 s). Repeated tile failures reload the source once. After
  that, the timeline offers Retry.
- **Empty**: the layer loaded but nothing was published for the view.
- Probe verdicts are cached per era **and** tile template, so one year's
  answer cannot stand in for another's.

## Verification (2026-10-19)

- `npm run eras:check`: every tiled era passed the probe. Each aerial year
  served its deepest level, answered 404 one level deeper, and answered 404
  outside the city.
- In headless Chromium with real tiles (Midtown z15 and Red Hook z13), all
  12 timeline entries reached Ready and drew their own service's tiles. 1924,
  1951, 2018 and 1609 in 3D showed draped imagery with no extrusions; Today and
  2050s kept them. Rapid switching across five years ended on the last year
  chosen. The three-pane comparison synced cameras and labelled each pane.
  Viewed from Denver, 1951 explained that it covers the city only and
  requested no tiles beyond the two-tile probe.
- 2026-10-20: the repair above had been discarded by a merge and was
  re-applied. Headless Chromium reached Ready for all 12 entries at the
  default Lower Manhattan view (z15) and for the three floodplains at a
  coastal view (z14) once the request-box fix landed;
  `src/lib/historical/futureFloodplains.test.ts` covers the box and paging.
- Tests: `src/lib/historical/eras.test.ts`, `era-imagery.test.ts`,
  `src/components/historical/*.test.tsx`, and "MapView historical integrity"
  in `MapView.test.tsx`.
