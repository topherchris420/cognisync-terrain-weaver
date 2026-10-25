# Architecture rules

- Keep live terrain classification and score computation in analyze-terrain; use the shared recommendation adapter for Claude advice with the existing AI provider as fallback, so provider failures do not discard valid classifications.
- Return recommendation provider provenance with the scan response; store advice in the existing analysis contract so the existing PDF report uses the same recommendations.