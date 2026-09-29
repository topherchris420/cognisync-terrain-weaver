# D8 routing on terrains with known answers

`routing/R1-synthetic-terrains` · Synthetic verification: does the code reproduce known analytic answers?

## Question

On synthetic terrains whose drainage is known analytically, does D8 route water in the right direction, conserve it, and deliver it to the right outlets?

## Hypothesis

On every case, D8 directions lie within 45° of the analytic downslope direction, and at least 99% of water reaches the analytically expected outlets.

## Result

**NOT SUPPORTED.** The shipped routing (fill-and-spill) fails 1 of 7 analytic cases (isolated-peak); the original D8 failed 3 (isolated-peak, flat, slope-with-pit). Fill-and-spill fixed the pit and flat cases; the remaining failure is boundary behaviour.

- Conservation holds exactly for every case and variant (minimum 1): all water ends at a sink or in depression storage.
- Preregistered adoption rule (pit and flat ≥ 99%, no other case degraded): plain filling fails — it degrades bowl; fill-and-spill passes when "degraded" means a case falling below the 99% pass mark.
- The rule did not define "degraded". Under the strictest reading (any decrease at all) fill-and-spill fails: bowl fell by 0.6 pp, which is rain landing exactly on the spill-level divide cells, where the analytic answer is itself indeterminate. It was adopted under the threshold reading; this ambiguity is recorded rather than resolved silently.
- Bowl: original D8 100%, plain fill 0% (it spills the whole bowl to the boundary), fill-and-spill 99.4% (only rain on the four pour points leaves).
- Flat: original D8 delivers 15.4% because 84.6% of cells are sinks; fill-and-spill 100%.
- Ridge: 52% of water goes west against an analytic 50%; D8 breaks the ridge-line tie deterministically toward the west.
- D8 represents every flow direction as one of eight, so deviations up to about 27° on radially symmetric surfaces are inherent to the method.
- Boundary behaviour (unfixed): a boundary cell cannot drain outward because the model knows nothing outside the extent. Where terrain slopes out of the extent, boundary cells pass water sideways along the edge (up to 90° from the true direction) and concentrate it at corners. Accumulation near the study boundary is unreliable.

**Share of water ending in the analytically expected place**

| case | expectation | original D8 (v1) | plain fill (rejected) | fill-and-spill (v2, shipped) | v2 max angle ° |
|---|---|---|---|---|---|
| uniform-slope | every cell drains due west to the western edge | 1 | 1 | 1 | 0 |
| bowl | all water converges on the central depression and stays there | 1 | 0 | 0.994 | 26.6 |
| ridge | two catchments of equal size, split along the ridge line | 1 | 1 | 1 | 0 |
| converging-valley | side slopes feed a central channel that exits at the southern edge | 1 | 1 | 1 | 11.3 |
| isolated-peak | water sheds radially away from the peak to every edge | 1 | 1 | 1 | 90 |
| flat | no preferred direction; physically, water ponds evenly or leaves by the edges | 0.154 | 1 | 1 | — |
| slope-with-pit | a one-cell depression holds its 5 units, overflows, and the rest reaches the western edge | 0.933 | 1 | 0.994 | 0 |

## Headline findings (machine-readable)

| finding | value |
|---|---|
| cases | 7 |
| failedCases | 1 |
| failedCaseIds | isolated-peak |
| failedCasesUnconditioned | 3 |
| failedCasesFilled | 2 |
| adoptionRuleFillAndSpill | true |
| adoptionRulePlainFill | false |
| plainFillDegradedCases | bowl |
| fillAndSpillStrictlyDecreasedCases | bowl |
| minConservation | 1 |
| flatDelivered | 1 |
| pitDelivered | 0.994 |
| bowlDeliveredPlainFill | 0 |
| ridgeWestShare | 0.52 |
| maxDirectionErrorDeg | 90 |

## Calibration / validation boundary

None: analytic verification.

## Conditions

- grid: 25×25
- generation: 1 unit per cell, cell area 1
- variants: original D8 (v1); plain fill (rejected); fill-and-spill (v2, shipped)

## Limitations

- Synthetic surfaces verify the algorithm, not its fidelity to any real street network.

## Reproduce

```bash
npm run experiment -- routing/R1-synthetic-terrains
```

Inputs are frozen fixtures; no network access is needed. Result hash `fnv1a64:ff5ad6eaaf2f8441`. CI re-runs this experiment and fails if the committed result no longer matches the code.

| input | evidence | source | retrieved | content hash |
|---|---|---|---|---|
| (none: analytic or built-in inputs) | | | | |

| model component | version |
|---|---|
| score | `urban-absorption:fnv1a64:489acc5fd4bfe2ea` |
| bulkBudget | `land-budget-v1` |
| routing | `mannahatta-d8-local-v2` |
| assumptions | `2026-09-29.1` |

Run at 2026-09-29T11:56:55.152Z from commit `6b9473e` with uncommitted changes (the commit that adds this report contains them) on Node v22.22.2.
