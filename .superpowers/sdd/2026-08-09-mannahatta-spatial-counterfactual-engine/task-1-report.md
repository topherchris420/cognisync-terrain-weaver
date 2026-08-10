# Task 1 Report: Canonical Counterfactual Contracts, Hashing, and Provenance

## Implementation Details

- Created `src/lib/counterfactual/types.ts` as the single canonical module for:
  - `CounterfactualSession`
  - `StormDefinition`
  - `InterventionFeature`
  - `SurfaceModifierGrid`
  - `RealitySurface`
  - `RealitySimulation`
  - `RealityScene`
  - `DataProvenance`
- Reused the existing application types instead of creating competing copies:
  - `AnalysisRecord` from `src/lib/types.ts`
  - `FlowPath`, `RiskZone`, and `ImpactPoint` from `src/lib/simulation-types.ts`
- Created `src/lib/counterfactual/hashing.ts` with `stableHash(value: unknown): string`:
  - recursively key-sorted canonical JSON
  - array order preserved
  - synchronous FNV-1a 64-bit digest
  - rendered as `fnv1a64:<hex>`
  - rejects `undefined`, functions, symbols, bigints, non-finite numbers, sparse arrays, and cyclic objects
  - documented as a deterministic identity key, not a security checksum
- Created `src/lib/counterfactual/provenance.ts` with:
  - `assertCompleteProvenance(items: DataProvenance[]): void`
  - `combineProvenance(items: DataProvenance[]): DataProvenance[]`
- `assertCompleteProvenance` fails closed when `sourceId` or `url` is blank.
- `combineProvenance` validates first, then deduplicates repeated provenance records while preserving first-seen order using `stableHash`.

## Files Changed

- `src/lib/counterfactual/types.ts`
- `src/lib/counterfactual/hashing.ts`
- `src/lib/counterfactual/provenance.ts`
- `src/lib/counterfactual/hashing.test.ts`
- `src/lib/counterfactual/provenance.test.ts`

## Self-Review

- The public Task 1 boundary is centralized in one canonical module tree under `src/lib/counterfactual/`.
- No new dependencies were added.
- Existing repo behavior was preserved; the full suite stayed green.
- The implementation is intentionally small and does not try to anticipate later tasks beyond the exact Task 1 contract.
- `combineProvenance` behavior was inferred as stable first-seen deduplication because the brief names the function but does not define merge semantics more narrowly.

## RED / GREEN Evidence

### RED

Command:

```bash
npm test -- --run src/lib/counterfactual/hashing.test.ts src/lib/counterfactual/provenance.test.ts
```

Output:

```text
> vite_react_shadcn_ts@0.3.0 test
> vitest run --run src/lib/counterfactual/hashing.test.ts src/lib/counterfactual/provenance.test.ts

 RUN  v4.1.10 C:/Users/chris/cognisync-terrain-weaver/.worktrees/mannahatta-counterfactual-engine

 ❯ src/lib/counterfactual/hashing.test.ts (0 test)
 ❯ src/lib/counterfactual/provenance.test.ts (0 test)

 Test Files  2 failed (2)
      Tests  no tests

 FAIL  src/lib/counterfactual/hashing.test.ts [ src/lib/counterfactual/hashing.test.ts ]
Error: Failed to resolve import "./hashing" from "src/lib/counterfactual/hashing.test.ts". Does the file exist?

 FAIL  src/lib/counterfactual/provenance.test.ts [ src/lib/counterfactual/provenance.test.ts ]
Error: Failed to resolve import "./provenance" from "src/lib/counterfactual/provenance.test.ts". Does the file exist?
```

Why this is valid RED:

- The tests failed for the expected reason: the canonical hashing and provenance modules did not exist yet.
- There were no typo-driven assertion failures to fix before implementation.

### GREEN

Command:

```bash
npm test -- --run src/lib/counterfactual/hashing.test.ts src/lib/counterfactual/provenance.test.ts
```

Output:

```text
> vite_react_shadcn_ts@0.3.0 test
> vitest run --run src/lib/counterfactual/hashing.test.ts src/lib/counterfactual/provenance.test.ts

 RUN  v4.1.10 C:/Users/chris/cognisync-terrain-weaver/.worktrees/mannahatta-counterfactual-engine

 Test Files  2 passed (2)
      Tests  5 passed (5)
   Start at  21:17:31
   Duration  1.95s (transform 236ms, setup 922ms, import 69ms, tests 15ms, environment 2.39s)
```

Focused behaviors covered:

- `stableHash` ignores object key order but preserves array order
- `stableHash` returns `fnv1a64:<16 hex chars>`
- `stableHash` rejects unsupported values and cyclic structures
- `assertCompleteProvenance` fails closed on missing `sourceId` / `url`
- `combineProvenance` deduplicates repeated lineage while preserving first-seen order

## Typecheck

Command:

```bash
npm run typecheck
```

Output:

```text
> vite_react_shadcn_ts@0.3.0 typecheck
> tsc --noEmit
```

Result: PASS

## Full Suite

Command:

```bash
npm test
```

Output:

```text
> vite_react_shadcn_ts@0.3.0 test
> vitest run

 RUN  v4.1.10 C:/Users/chris/cognisync-terrain-weaver/.worktrees/mannahatta-counterfactual-engine

 Test Files  25 passed (25)
      Tests  171 passed (171)
   Start at  21:17:42
   Duration  12.09s (transform 2.09s, setup 13.89s, import 5.60s, tests 3.88s, environment 43.88s)
```

Result: PASS

## Additional Verification

Command:

```bash
npm run lint
```

Result: FAIL, unrelated pre-existing issues outside Task 1 scope.

Relevant output:

```text
src/components/MapEditor.tsx
  72:109  error  Unexpected any

src/pages/Analyze.tsx
  372:37  error  Unexpected any
  467:27  error  Unexpected any
```

There were also existing fast-refresh and hook dependency warnings in UI files and `src/pages/Analyze.tsx`.

## Concerns

- `combineProvenance` dedupe semantics were inferred as “validate, then preserve first-seen unique records” because the brief did not define conflict resolution or sort order beyond naming the function.
- The repo currently has unrelated pre-existing lint failures outside `src/lib/counterfactual/`.
- There is an unrelated in-progress modification in `supabase/functions/mcp/index.ts`; it was not touched.
