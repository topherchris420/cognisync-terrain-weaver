## 2025-05-18 - Direct Property Access vs Array Operations for Fixed Schema Metrics
**Learning:** In high-frequency domain calculations like `computeAbsorptionScore()`, using `Object.entries()` and `.reduce()` introduces significant function call and array allocation overhead (~20x overhead vs scalar access) when operating on fixed schema objects.
**Action:** Prefer direct property access over generic key iteration (`Object.entries`/`reduce`) when computing weighted scores for fixed-shape domain models.
