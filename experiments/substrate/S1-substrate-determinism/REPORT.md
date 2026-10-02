# Does the substrate compiler reproduce the same spatial state from the same frozen inputs?

`substrate/S1-substrate-determinism` · Repeated measurement: how stable is an output under repetition or resampling?

## Question

Does the urban substrate compiler produce the same experiment-relevant spatial state from the same frozen inputs?

## Hypothesis

Compiling the frozen Lower Manhattan sources twice (with different non-authoritative timestamps and commits) and a third time with every source's records in a seeded random order yields identical tile ids, identical tile bytes and geometry, identical tile hashes and an identical manifest hash; validation reports zero errors; a study export routed with that substrate replays; and moving one footprint vertex by 1e-7° in one tile makes the same replay fail on that tile.

## Result

**SUPPORTED.** Three compiles of the frozen sources (two clocks, one seeded record permutation) produced the same 29 tiles byte for byte and the same manifest sha256:c37b1a1ff534; validation found 0 errors and 16 source-data warnings. A study export replayed against the frozen substrate; moving one vertex by 1e-7° in nyc/512/41/47 made replay fail on that tile.

- Sources: 9 frozen public datasets; content hashes are of record sets, so provider order cannot change identity.
- Timestamps and commits differed between runs (2026-10-02T00:00:00.000Z vs 2031-01-01T12:00:00.000Z) and are recorded in the manifest, but excluded from every hash by design.
- Validation warnings are facts about the sources, kept visible: Rings whose edges touch only after rounding to 1e-7° (source edges within ~1 cm; flagged, not repaired) (1); Elevation cells far below sea level (source artefacts, kept) (15).
- The replay fixture recorded 17 tiles for the example extent (local tiles within the buffer, their closure, and context tiles) and reproduced every routed volume.
- Tampered replay failed as required, on the check "Substrate tiles reconstruct"; the mismatch names nyc/512/41/47.

**Compiled tiles (identical in all three compiles)**

| tile | level | coverage | features | bytes | sha256 |
|---|---|---|---|---|---|
| nyc/512/39/45 | local | complete | 29 | 25089 | sha256:0413221b5221d05870135c9192172335649281c3755e238dce8c99b89054e82d |
| nyc/512/40/45 | local | complete | 202 | 104185 | sha256:4f84c907b7f925f9ff60cb1e78b2da7216af43957044f25b5860fd4c6c37e221 |
| nyc/512/41/45 | local | complete | 59 | 35286 | sha256:cf0e0c9680b2808face43add4427fb8a8199c49201df95090566a7dc914f8121 |
| nyc/512/42/45 | local | complete | 43 | 35471 | sha256:ce2e710d5ad4134cc52f7040ed9f452766791f52714566007510ae237d16274b |
| nyc/512/43/45 | local | complete | 829 | 362444 | sha256:d763f6c85e44e9416ee5b58cf3dcd91635cfa33c77c9f4c164b378017aafd040 |
| nyc/512/39/46 | local | complete | 64 | 29182 | sha256:2eec84147c035e863b2f9ad8404266833f10f5df606cff1899a177977d43eac2 |
| nyc/512/40/46 | local | complete | 857 | 341659 | sha256:5399023965f6417c9ef54d1ebea8248287883d1993f78e53080583dda07630a4 |
| nyc/512/41/46 | local | complete | 788 | 295621 | sha256:0e33578b17a8f332a46561f870237ba6ce7452b2a92234f40df9b70f5dd8283a |
| nyc/512/42/46 | local | complete | 240 | 105304 | sha256:932e55de40132e3df6814418f514d889b2fa98df4df5530d75099a71dd2262ca |
| nyc/512/43/46 | local | complete | 207 | 98984 | sha256:3c2a38ac50ec0c27238e81f19889b13554209706d8e34e0585135c0b4036874d |
| nyc/512/39/47 | local | complete | 83 | 30743 | sha256:6a97a52765d315bf08953386786639f85cbb3cd352ea5aa7bffa68c240ad3564 |
| nyc/512/40/47 | local | complete | 1001 | 340224 | sha256:35574c552205f770ce06b56e4860b1cc26fa699e7b685df3eea33aad0a3bd089 |
| nyc/512/41/47 | local | complete | 550 | 284102 | sha256:3192c3ae9ecccb6bb7c1f9d6d9545376b09885df32478ab4c977ff23bf7e0ba7 |
| nyc/512/42/47 | local | complete | 1043 | 422301 | sha256:54e94b552665801a4b16060f34c30df992c0b2063a4e0bf35fef452f700eb083 |
| nyc/512/43/47 | local | complete | 522 | 196468 | sha256:d682486012b44b053bcd46b21df1f6d9b24f6541cc5ef3446ba4e467d02a8a9e |
| nyc/512/39/48 | local | complete | 48 | 33707 | sha256:0e180a3b300774c7c0631edfe347549bf08057428311c84664b0c62fa9bfa121 |
| nyc/512/40/48 | local | complete | 533 | 168342 | sha256:0b4d6bfe6dc0f7666a783eecc755f78275350f0d541768a4668fc6be39352a58 |
| nyc/512/41/48 | local | complete | 575 | 281487 | sha256:27a272a239633e0cebc69c6ff063de34c009da11739ec1f7c7a0ddc618683850 |
| nyc/512/42/48 | local | complete | 618 | 254197 | sha256:78b61ced188bd7a80a5723dfdd9761e070b9d06dd1cf8b969f1174ef5281316c |
| nyc/512/43/48 | local | complete | 1197 | 638905 | sha256:7641a1df6018979cd678747de157eadd62b0b9d595acb671b5c6f30d1247b268 |
| nyc/512/39/49 | local | complete | 0 | 5139 | sha256:9b0fb5dd84db184809afd3cd4eadaa4a2e026bf579e636a741245bc3525fe0b5 |
| nyc/512/40/49 | local | complete | 608 | 175011 | sha256:b1ee204f9ea4af349ae859686422af5beb5d8e31d3b1c7e4a6bd4c0b88817404 |
| nyc/512/41/49 | local | complete | 846 | 391114 | sha256:6e0fbbb04209cb6b3a985968a1d31f407e2b4cda6c9d6ecd007f5a23066fae26 |
| nyc/512/42/49 | local | complete | 744 | 378512 | sha256:2ebf9e1a99e22f522f7d08bb18c2c48ab06f31ebd08cadacc0fbff3ad35759b8 |
| nyc/512/43/49 | local | complete | 860 | 521143 | sha256:135c2df503ee5128fa44b9e1be568ee64c955126f905458abdd19fa922b540f2 |
| nyc/2048/9/11 | context | partial | 79 | 11501 | sha256:7513240c23944808fd63154ae79e558b32ac2fdd4c0b517825289e6e9bc35926 |
| nyc/2048/10/11 | context | partial | 3213 | 429683 | sha256:73b872dacbb0b6a2dc2d9270577dd70ba48c4da1cef6c5a08c2612e4cd47c57a |
| nyc/2048/9/12 | context | partial | 2 | 6729 | sha256:a530a60f701a6501d23b696f9d2aa9a873d1e8f332918f9e1971a446ba5391ef |
| nyc/2048/10/12 | context | partial | 3863 | 615076 | sha256:f4f27f8773b72f89947a5105734f70f726854fa0172af2e0ccf0cc473aec3122 |

**Validation checks**

| check | severity | passed | failures | detail |
|---|---|---|---|---|
| Tile ids, levels, bounds, CRS and schema are consistent | error | yes | 0 | 29 tiles |
| Every tile's content matches its recorded hash | error | yes | 0 | 29 tile hashes reproduced |
| All coordinates finite and within WGS84 range; bounds ordered | error | yes | 0 | all finite |
| Rings closed, ≥ 4 positions, areas non-negative | error | yes | 0 | all rings valid |
| Each feature lies in the tile that owns it | error | yes | 0 | every feature inside its owner tile |
| Each feature is owned by exactly one tile | error | yes | 0 | no feature owned twice |
| Every reference names an existing tile that owns the feature | error | yes | 0 | all references resolve |
| Every layer, attribute and feature names a complete source record | error | yes | 0 | 9 complete source records |
| Elevation grids cover each covered tile at the declared resolution | error | yes | 0 | covered tiles fully gridded |
| Open water is receiving water and never counted as pervious land | error | yes | 0 | water receives; never retention |
| Context features are simplifications of compiled local features | error | yes | 0 | context derived from local features |
| Source geometry problems (flagged, not repaired) | warning | yes | 0 | none |
| Rings whose edges touch only after rounding to 1e-7° (source edges within ~1 cm; flagged, not repaired) | warning | no | 1 | 1 failure(s), e.g. park:B431: self-intersection-after-rounding |
| Elevation cells far below sea level (source artefacts, kept) | warning | no | 15 | 15 failure(s), e.g. nyc/512/39/45: 15 cells; nyc/512/41/45: 13 cells; nyc/512/42/45: 1 cells |
| Buildings or trees located on open-water cells of the shoreline mask | warning | yes | 0 | none |

**Frozen sources**

| source | provider | dataset | records | retrieved | sha256 (record set) |
|---|---|---|---|---|---|
| mapzen-terrarium | Mapzen / Linux Foundation Terrain Tiles on AWS (blend of USGS 3DEP and other sources) | — | 25600 | 2026-10-02 | sha256:6525d36ee1ad61b79ba4ebf24d05221be0f38433d25f532468d40dd2eebd51ed |
| nyc-borough-boundaries-shoreline | NYC Department of City Planning | gthc-hcne | 2 | 2026-10-02 | sha256:f590d052ec6810a3ac216d844c304258dbb094ab8e79e637dc0ac7c67c2b88f1 |
| nyc-building-footprints | NYC Office of Technology and Innovation | 5zhs-2jue | 2780 | 2026-10-02 | sha256:57f9776c7905621dc27d2920d06242f7867270111cff26875228e4299df40f08 |
| nyc-mappluto | NYC Department of City Planning | 64uk-42ks | 2444 | 2026-10-02 | sha256:82167a6c1a85dfa99dcbfdae8e33e7f1b82e885e11d29b3225ca94d010e5ab04 |
| nyc-parks-properties | NYC Department of Parks & Recreation | enfh-gkve | 42 | 2026-10-02 | sha256:4000664d142c1a8c541cdb885c1c02a86c7a4570916bceee0fb1a18f644a8c2e |
| nyc-planimetric-hydrography | NYC Office of Technology and Innovation (planimetrics) | pjs3-c3z5 | 8 | 2026-10-02 | sha256:1d9999962c27dc8aae948e523bfd98c8c049861d43ea5b3f35daddf4dd80c58f |
| nyc-street-centerline | NYC Office of Technology and Innovation (CSCL) | inkn-q76z | 1776 | 2026-10-02 | sha256:3fa8d558ae74eb93418ddc741c03e08cc2f98bf35da606366284c0b2f5cc121a |
| nyc-street-tree-census-2015 | NYC Department of Parks & Recreation | uvpi-gqnh | 2857 | 2026-10-02 | sha256:6601d46b80d52fe21abac71daf3c01673337733ac8853f3986376abe155d9503 |
| usgs-nlcd-2021 | U.S. Geological Survey / Multi-Resolution Land Characteristics Consortium | NLCD_2021_Land_Cover_L48; NLCD_2021_Impervious_L48 | 10506 | 2026-10-02 | sha256:dacb2d4df7708ce547cc7aaec1df7237f48fc2d750d3ddda1305a75137a24dff |

## Headline findings (machine-readable)

| finding | value |
|---|---|
| tiles | 29 |
| localTiles | 25 |
| contextTiles | 4 |
| manifestHash | sha256:c37b1a1ff534862fb5e441ffcac9bade0477f78a0af46d2608adf8b9f6e40c62 |
| tileIdMismatches | 0 |
| tileContentMismatches | 0 |
| geometryMismatches | 0 |
| tileHashMismatches | 0 |
| manifestEqualAcrossClocks | true |
| permutationInvariant | true |
| validationErrors | 0 |
| validationWarnings | 16 |
| buildings | 2725 |
| streetSegments | 1717 |
| streetGraphNodes | 1118 |
| streetGraphEdges | 1540 |
| trees | 2857 |
| replayTiles | 17 |
| replayReproduced | true |
| tamperDetected | true |

## Calibration / validation boundary

None: a determinism and integrity test on frozen inputs. Pass criteria were written with the hypothesis, before the first run.

## Conditions

- region: nyc-lower-manhattan-2026-10
- compiler: mannahatta-urban-substrate-compiler@1.0.0
- schema: mannahatta-substrate/1
- localTileM: 512
- contextTileM: 2048
- permutationSeed: 1609
- runA: 2026-10-02T00:00:00.000Z / s1-run-a
- runB: 2031-01-01T12:00:00.000Z / s1-run-b
- replayExtent: lower-manhattan-example
- tamper: one footprint vertex in nyc/512/41/47 moved by 1e-7°

## Limitations

- Determinism is not correctness: two identical compiles can be identically wrong. Source accuracy is not judged here; validation warnings report what is known.
- Runs in one JavaScript engine (Node/V8). Cross-engine identity is argued from construction (only correctly rounded IEEE-754 operations in authoritative paths, no Math.pow, trigonometry or locale-dependent sorting) but not tested.
- One frozen snapshot (retrieved 2026-10-02) of one 2.56 km square; other places and later releases are untested.
- The replay fixture uses illustrative example land cover and a synthetic square intervention; it tests identity, not hydrology.
- Content hashes detect change; they are not signatures and do not authenticate who compiled a substrate.

## Reproduce

```bash
npm run experiment -- substrate/S1-substrate-determinism
```

Inputs are frozen fixtures; no network access is needed. Result hash `fnv1a64:d9a301996977123e`. CI re-runs this experiment and fails if the committed result no longer matches the code.

| input | evidence | source | retrieved | content hash |
|---|---|---|---|---|
| dem/lower-manhattan-example.json | measured | Mapzen Terrarium tiles (AWS Terrain Tiles) and USGS 3DEP Bare Earth dynamic ImageServer | 2026-09-29 | `fnv1a64:d08e7b3ff8c9a0b8` |
| substrate/ (9 files) | measured | BUILDING | 2026-10-02 | `fnv1a64:e0252ab4b04d6833` |

| model component | version |
|---|---|
| score | `urban-absorption:fnv1a64:489acc5fd4bfe2ea` |
| bulkBudget | `land-budget-v1` |
| routing | `mannahatta-d8-local-v2` |
| assumptions | `2026-10-02.1` |
| substrateCompiler | `mannahatta-urban-substrate-compiler@1.0.0 (mannahatta-substrate/1)` |

Run at 2026-10-02T21:50:26.385Z from commit `405e0b1` with uncommitted changes (the commit that adds this report contains them) on Node v22.22.0.
