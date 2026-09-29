# Do the bulk budget and the routing engine agree on the same inputs?

`hydrology/H1-cross-model-consistency` · Internal consistency: do the instrument's own parts agree? Says nothing about nature.

## Question

For identical land cover, extent and rainfall, do the lumped land budget and the D8 routing engine retain the same water, and credit the same drawn intervention with the same avoided runoff?

## Hypothesis

Without interventions, routed retained volume equals bulk retained volume (both apply the registered retention weights to the same land area), and a drawn intervention avoids the same runoff in both models within 5%.

## Result

**SUPPORTED.** Routed and bulk retention agree exactly on the same land, and both credit a drawn intervention within 5%.

- Retention gap without open water: 0 pp; with open water in the frame: 0 pp of frame rainfall.
- A 1,500 m² bioswale: routed avoided runoff 57.8 m³ vs bulk 58.4 m³. Street trees: 50.9 vs 50.9 m³.
- Rasterization at 36/72/120 cells credits a 1,500 m² square with 100% / 100% / 100% of its drawn area (before the area-weighted revision: 174% / 87% / 94%; experiments/revisions/before-findings.json).

**Retained volume at 50 mm on the example extent (m³)**

| composition | water % | bulk retained | routed retained | gap (pp of rainfall) |
|---|---|---|---|---|
| example (illustrative) | 12 | 10030 | 10030 | 0 |
| 1609 benchmark (reconstructed) | 2 | 32688 | 32688 | 0 |
| nyc | 0 | 7086 | 7086 | 0 |
| Manhattan, NY | 30 | 5905 | 5905 | 0 |
| Jakarta, ID | 2 | 11008 | 11008 | 0 |
| Copenhagen, DK | 8 | 12063 | 12063 | 0 |
| Lagos, NG | 15 | 8014 | 8014 | 0 |
| Phoenix, AZ | 0 | 14003 | 14003 | 0 |
| Central Park, NYC | 10 | 15564 | 15564 | 0 |
| Tiergarten, Berlin | 3 | 20798 | 20798 | 0 |
| Bois de Boulogne, Paris | 7 | 29313 | 29313 | 0 |
| Bishan Park, Singapore | 1 | 17251 | 17251 | 0 |
| Ørestad, Copenhagen | 1 | 20161 | 20161 | 0 |
| Portland, OR | 0 | 20376 | 20376 | 0 |
| Kreuzberg, Berlin | 3 | 13750 | 13750 | 0 |
| Eixample, Barcelona | 0 | 5989 | 5989 | 0 |
| Amsterdam Zuid, NL | 5 | 12948 | 12948 | 0 |
| Midtown Manhattan, NY | 0 | 5905 | 5905 | 0 |
| Shinjuku, Tokyo | 1 | 10038 | 10038 | 0 |
| Central, Hong Kong | 25 | 12147 | 12147 | 0 |
| Dharavi, Mumbai | 0 | 14509 | 14509 | 0 |
| Jakarta Pusat, ID | 0 | 14551 | 14551 | 0 |
| Gilbert, AZ | 2 | 18179 | 18179 | 0 |
| Katy, TX | 1 | 21637 | 21637 | 0 |
| Sky Harbor, Phoenix | 0 | 8039 | 8039 | 0 |
| Port of Rotterdam, NL | 45.5 | 8861 | 8861 | 0 |
| (untitled scan) | 25 | 6158 | 6158 | 0 |
| (untitled scan) | 20 | 7887 | 7887 | 0 |
| (untitled scan) | 30 | 5947 | 5947 | 0 |
| (untitled scan) | 30 | 7381 | 7381 | 0 |
| (untitled scan) | 20 | 7596 | 7596 | 0 |
| (untitled scan) | 45 | 5272 | 5272 | 0 |
| (untitled scan) | 33.3 | 4701 | 4701 | 0 |
| (untitled scan) | 0 | 14846 | 14846 | 0 |
| (untitled scan) | 20 | 7845 | 7845 | 0 |
| (untitled scan) | 35 | 5694 | 5694 | 0 |
| (untitled scan) | 25 | 6200 | 6200 | 0 |
| (untitled scan) | 15 | 9574 | 9574 | 0 |
| (untitled scan) | 9 | 8815 | 8815 | 0 |
| (untitled scan) | 20 | 7723 | 7723 | 0 |
| (untitled scan) | 30 | 7301 | 7301 | 0 |
| (untitled scan) | 0 | 10207 | 10207 | 0 |
| (untitled scan) | 0 | 11472 | 11472 | 0 |
| (untitled scan) | 10 | 11261 | 11261 | 0 |
| (untitled scan) | 12 | 7718 | 7718 | 0 |
| Manhattan, NY | 10 | 6833 | 6833 | 0 |
| Washington, District of Columbia, United States | 12.5 | 13391 | 13391 | 0 |
| Arlington County, Virginia, United States | 0 | 16027 | 16027 | 0 |

**Same 1,500 m² drawing in both models (50 mm)**

| intervention | drawn m² | rasterized m² | routed avoided m³ | bulk avoided m³ | routed ÷ bulk |
|---|---|---|---|---|---|
| street_trees | 1497 | 1497 | 50.9 | 50.9 | 1 |
| bioswales | 1497 | 1497 | 57.8 | 58.4 | 0.99 |

## Headline findings (machine-readable)

| finding | value |
|---|---|
| compositions | 48 |
| maxRetentionGapPP | 0 |
| meanRetentionGapPP | 0 |
| meanGapNoWaterPP | 0 |
| meanGapWithWaterPP | 0 |
| treesRoutedOverBulk | 1 |
| bioswalesRoutedOverBulk | 0.99 |
| rasterAreaRatio36 | 1 |
| rasterAreaRatio72 | 1 |
| rasterAreaRatio120 | 1 |
| maxRasterAreaError | 0 |
| routingVegetationC | 0.2 |
| registeredVegetationC | 0.2 |

## Calibration / validation boundary

None: a consistency check across the model's own components.

## Conditions

- rainfallMm: 50
- extent: lower-manhattan-example
- resolution: medium (72×72)
- interventionAreaM2: 1500

## Limitations

- Agreement between two parts of the instrument says nothing about agreement with nature.
- Uses real classifier compositions from the feed as inputs only; their accuracy is tested elsewhere (classification/C1, C2).

## Reproduce

```bash
npm run experiment -- hydrology/H1-cross-model-consistency
```

Inputs are frozen fixtures; no network access is needed. Result hash `fnv1a64:b6ac94c75dbdb28d`. CI re-runs this experiment and fails if the committed result no longer matches the code.

| input | evidence | source | retrieved | content hash |
|---|---|---|---|---|
| dem/lower-manhattan-example.json | measured | Mapzen Terrarium tiles (AWS Terrain Tiles) and USGS 3DEP Bare Earth dynamic ImageServer | 2026-09-29 | `fnv1a64:d08e7b3ff8c9a0b8` |
| scan-feed.json | inferred | Mannahatta public scan feed (Supabase `analyses`, public read policy) | 2026-09-29 | `fnv1a64:e75d28ee477bca6c` |

| model component | version |
|---|---|
| score | `urban-absorption:fnv1a64:489acc5fd4bfe2ea` |
| bulkBudget | `land-budget-v1` |
| routing | `mannahatta-d8-local-v2` |
| assumptions | `2026-09-29.1` |

Run at 2026-09-29T11:56:55.152Z from commit `6b9473e` with uncommitted changes (the commit that adds this report contains them) on Node v22.22.2.
