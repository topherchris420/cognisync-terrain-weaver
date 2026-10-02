import { useCallback, useEffect, useRef, useState } from "react";
import { SUBSTRATE_PUBLIC_DIR } from "@/lib/urban-substrate/config";
import { unavailable, type SubstrateIdentity, type SubstrateState, type SubstrateUnavailable } from "@/lib/urban-substrate/identity";
import { httpStore, loadSubstrateIndex, loadSubstrateView, selectSubstrate, SubstrateIntegrityError, type SubstrateView } from "@/lib/urban-substrate/loader";
import type { BBox } from "@/lib/geo";

export type UrbanSubstrateStatus =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "ready"; view: SubstrateView; state: SubstrateIdentity }
  | { phase: "unavailable"; state: SubstrateUnavailable };

export interface ResolvedSubstrate {
  state: SubstrateState;
  view: SubstrateView | null;
}

function substrateBaseUrl(): string {
  const base = (import.meta.env?.BASE_URL as string | undefined) ?? "/";
  return `${base.endsWith("/") ? base : `${base}/`}${SUBSTRATE_PUBLIC_DIR}/`;
}

async function resolveSubstrate(extent: { west: number; south: number; east: number; north: number }, fetchImpl: typeof fetch): Promise<ResolvedSubstrate> {
  const base = substrateBaseUrl();
  try {
    const index = await loadSubstrateIndex(base, fetchImpl);
    const entry = selectSubstrate(index, extent);
    if (!entry) return { state: unavailable("outside-coverage", "No compiled substrate covers this study extent."), view: null };
    const view = await loadSubstrateView(httpStore(`${base}${entry.path}`, fetchImpl), extent);
    return { state: view.identity, view };
  } catch (error) {
    if (error instanceof SubstrateIntegrityError) {
      return { state: unavailable("integrity-failed", `${error.message}${error.tileId ? ` (${error.tileId})` : ""}`), view: null };
    }
    return { state: unavailable("load-failed", error instanceof Error ? error.message : "The substrate could not be loaded."), view: null };
  }
}

/**
 * The urban substrate for a study extent. Loading never blocks the study:
 * when no substrate covers the place, or it cannot be loaded or verified,
 * the state says so, and every run records that state instead.
 */
export function useUrbanSubstrate(bbox: BBox | null, fetchImpl?: typeof fetch) {
  const [status, setStatus] = useState<UrbanSubstrateStatus>({ phase: "idle" });
  const pending = useRef<Promise<ResolvedSubstrate> | null>(null);
  const fetchRef = useRef(fetchImpl);
  fetchRef.current = fetchImpl;
  const key = bbox ? [bbox[0][0], bbox[0][1], bbox[1][0], bbox[1][1]].join(",") : null;

  useEffect(() => {
    if (!key) {
      pending.current = null;
      setStatus({ phase: "idle" });
      return;
    }
    const [west, south, east, north] = key.split(",").map(Number);
    const fetcher = fetchRef.current ?? (typeof fetch === "function" ? fetch.bind(globalThis) : null);
    let current = true;
    setStatus({ phase: "loading" });
    const promise: Promise<ResolvedSubstrate> = fetcher
      ? resolveSubstrate({ west, south, east, north }, fetcher)
      : Promise.resolve({ state: unavailable("load-failed", "No fetch implementation is available."), view: null });
    pending.current = promise;
    void promise.then((resolved) => {
      if (!current) return;
      setStatus(
        resolved.state.status === "loaded" && resolved.view
          ? { phase: "ready", view: resolved.view, state: resolved.state }
          : { phase: "unavailable", state: resolved.state as SubstrateUnavailable },
      );
    });
    return () => {
      current = false;
    };
  }, [key]);

  /** The settled substrate for the current extent; storm runs await it so NOW and POSSIBLE record the same identity. */
  const resolve = useCallback(async (): Promise<ResolvedSubstrate> => {
    if (!pending.current) return { state: unavailable("no-substrate-published", "No study extent is set."), view: null };
    return pending.current;
  }, []);

  return { status, resolve };
}
