import { useEffect, useState } from "react";
import {
  lookupWelikia1609,
  type Welikia1609Lookup,
} from "@/lib/historical/welikia1609";
import type { BBox } from "@/lib/geo";

export interface Welikia1609State {
  loading: boolean;
  /** Set when the index itself could not be fetched — distinct from "no data here". */
  error: string | null;
  lookup: Welikia1609Lookup | null;
}

/**
 * Look up the real 1609 cover for a site bounding box.
 *
 * Passing `null` clears the result, so the panel disappears with the analysis
 * rather than showing a stale century.
 */
export function useWelikia1609(bbox: BBox | null): Welikia1609State {
  const [state, setState] = useState<Welikia1609State>({
    loading: false,
    error: null,
    lookup: null,
  });

  const key = bbox ? JSON.stringify(bbox) : null;

  useEffect(() => {
    if (!key) {
      setState({ loading: false, error: null, lookup: null });
      return;
    }
    const [[west, south], [east, north]] = JSON.parse(key) as BBox;
    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    lookupWelikia1609({ west, south, east, north })
      .then((lookup) => {
        if (!cancelled) setState({ loading: false, error: null, lookup });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : "The 1609 record could not be loaded.",
          lookup: null,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [key]);

  return state;
}
