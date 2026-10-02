# Revisions driven by measurement

Each change below was made because an experiment measured a defect, and each
was re-measured afterwards. Pre-revision findings are frozen in
[`revisions/before-findings.json`](revisions/before-findings.json); the
current ones are in [INDEX](INDEX.md). Negative results that no change
fixed are listed at the end and stay in the record.

## 1. One source for runoff coefficients (routing)

- **Observation.** [H1](hydrology/H1-cross-model-consistency/REPORT.md): on identical inputs the routing engine retained up to 24.8 pp more of the frame's rainfall than the bulk budget (mean 8.9 pp where the frame contains water; 0.25 pp without).
- **Diagnosis.** `RUNOFF_COEFFICIENT` claimed to be the complement of the score weights but was not (vegetation C 0.10 vs 0.20; roofs 0.95 vs 0.90), and it credited open water as a 50% sponge — the defect the July calibration removed from the score but never from routing.
- **Change.** Routing coefficients are now derived from the registered retention weights; rain on open water is not retained. `src/lib/simulation.ts`.
- **Validation.** H1 re-run; registry drift test (`src/lib/assumptions/registry.test.ts`) now enforces the relationship.
- **Result.** Retention gap 0.00 pp on all 48 compositions. The two water models now differ only by the area they cover, which is explicit.

## 2. Area-weighted intervention rasterization

- **Observation.** H1: a 1,500 m² drawing was credited with 174% / 87% / 94% of its area at 36 / 72 / 120 cells.
- **Diagnosis.** A cell was modified in full whenever its centre fell inside the polygon.
- **Change.** Each cell's modifier is weighted by exact coverage (polygon ∩ cell) where one drawing touches it, and a 16 × 16 lattice where drawings overlap; fully covered cells take a proven fast path. `src/lib/counterfactual/modifiers.ts`.
- **Validation.** H1 re-run; regression test in `modifiers.test.ts`; existing 150 ms interaction budget kept.
- **Result.** 100% / 100% / 100%. Routed and bulk models now credit the same drawing with the same avoided runoff (ratio 1.00 for trees, 0.99 for bioswales, where retention caps at 100%).

## 3. Scores are computed, never trusted from storage

- **Observation.** [C3](classification/C3-stored-score-integrity/REPORT.md): 24 of 61 live stored scores disagree with the current scorer, by up to 15 points; 9 fall in another band.
- **Diagnosis.** The 2026-07-14 backfill migration never reached those rows in the live database.
- **Change.** Every record entering the app or MCP is rescored from its land cover; a disagreeing stored value is kept alongside as `stored_absorption_score`. `src/lib/score-integrity.ts`.
- **Validation.** Unit tests on real stale rows (Bois de Boulogne 89.7 → 74.7).
- **Result.** Displays and MCP answers now match the published method. Applying the migration to the database remains an operator step.

## 4. Routing v2: fill-and-spill with a receiving-water boundary

- **Observation.** [R1](routing/R1-synthetic-terrains/REPORT.md): unconditioned D8 failed the flat (15% delivered) and pit (93%) analytic cases. [R2](routing/R2-resolution-sensitivity/REPORT.md): a median 81% of routed water ended in interior pits on real terrain. Data check ([R3](routing/R3-dem-source-sensitivity/REPORT.md)): Terrarium cells down to −14,017 m along shorelines.
- **Diagnosis.** No depression handling; flats and single-cell noise pits stop water. Terrarium bathymetry and artefacts act as bottomless sinks.
- **Change.** Plain filling was tried first and **rejected** by the preregistered rule: it spills a real bowl to the boundary. Adopted: static fill-and-spill (depressions store their volume, excess spills), with cells at or below 0 m treated as receiving water. `src/lib/hydrology/conditioning.ts`; model version `mannahatta-d8-local-v2`.
- **Validation.** R1 under both readings of the adoption rule (recorded in its report); unit tests for conservation, pits, bowls, spikes and determinism; R2–R5 re-run.
- **Result.** Analytic failures 3 → 1 (the remaining one is boundary behaviour, unfixed). Water stranded in pits: 81% → a median 11% held in real depressions. **It did not make routed hotspots predictive**: see below.

## 5. Urban substrate identity joins the controlled-variable contract

- **Observation.** Experiments could not say which city state (buildings, streets, shoreline, reference land cover) a study was made with, so two runs could silently differ in it. Not a measured defect: a gap in what evidence records.
- **Change.** A compiled, versioned urban substrate (`src/lib/urban-substrate/`, [docs](../docs/urban-substrate.md)). Every routed run now records `substrate_hash`, and `controlledComparison` requires it to be identical in NOW and POSSIBLE; runs made without a substrate record `substrate:none`. Experiment export v3 carries the substrate identity; replay reconstructs every recorded tile or fails.
- **Effect on committed results.** [I1](interventions/I1-bioswale-1500m2/REPORT.md) lists the controlled variables in one observation, so its result hash changed from `fnv1a64:8b373f2eb03982d9` to `fnv1a64:68c186166ffaf0b0`. Verdict, findings and tables are identical; the only difference is that sentence, which now reads "10 fixed variables … urban substrate (version, manifest and tiles)" instead of "9 fixed variables …". Both I1 runs routed without a substrate (`substrate:none`). No other committed result changed.
- **Validation.** [S1](substrate/S1-substrate-determinism/REPORT.md) (new): three compiles of frozen sources are byte-identical, validation reports zero errors, and a one-centimetre tamper fails replay on the named tile.
- **Not changed.** D8 routing reads no substrate geometry; no hydrology number moved.

## What measurement did not fix

- **Routed zones do not locate reported flooding.** On the preregistered holdout ([R5](routing/R5-311-association-holdout/REPORT.md)) routed accumulation scored AUC 0.50 against 0.62 for simply ranking low ground. The tripwire `routing.hotspots_indicate_flooding` is tripped. Response: the result is attached to every routed run's warnings and shown in the app's evidence ledger. The zones were not re-tuned on the holdout; any future routing change must be tested on a new event.
- **Routing is fragile to its inputs.** Changing elevation source keeps only 36% of flow directions (R3); changing resolution gives rank correlations near 0.45 (R2).
- **The classifier is unstable and coarse.** One frame classified 24 times spanned 29 pp of pervious share and 0–45 pp of water; 82% of values are multiples of 5 ([C2](classification/C2-repeat-stability/REPORT.md)). Against NLCD, pervious share differs by 6.7 pp on average ([C1](classification/C1-nlcd-agreement/REPORT.md)). Response: the default sensitivity range moved from 5 to 7 pp and is now labelled benchmark-derived.
- **Soil and roof coefficients trip their wires** ([H2](hydrology/H2-curve-number-benchmark/REPORT.md), [TRIPWIRES](TRIPWIRES.md)). Not changed: no single fixed value can match a reference whose runoff fraction changes with storm depth; the defect is structural (no depth dependence), and replacing it is a model change that should be tested against observed runoff, which this repository does not hold.
- **A 1,500 m² bioswale does not cut routed runoff by 8%** ([I1](interventions/I1-bioswale-1500m2/REPORT.md)): 0.18%. Kept as a negative result.
- **Plans sized exactly to a target do not survive measured classification error** ([I3](interventions/I3-classification-uncertainty/REPORT.md)): all four tested combinations become inconclusive.
