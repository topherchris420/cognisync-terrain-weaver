import { useCallback, useMemo, useState } from "react";
import type { CatalystTemporalMode } from "@/integrations/catalyst";

export function parseTemporalMode(value: string | null): CatalystTemporalMode {
  return value === "historical" || value === "future" ? value : "present";
}

export function useTemporalLens(initial?: string | null) {
  const [mode, setModeState] = useState<CatalystTemporalMode>(() =>
    parseTemporalMode(initial ?? null)
  );

  const setMode = useCallback((next: CatalystTemporalMode) => {
    setModeState(next);
  }, []);

  return useMemo(() => ({ mode, setMode }), [mode, setMode]);
}
