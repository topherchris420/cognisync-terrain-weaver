import feed from "../../experiments/data/scan-feed.json";
import { withCurrentScore } from "./score-integrity";
import type { AnalysisRecord } from "./types";

type Snapshot = { rows: AnalysisRecord[]; retrievedAt: string };

export interface DashboardFeed {
  rows: AnalysisRecord[];
  snapshot?: Pick<Snapshot, "retrievedAt">;
}

// The public fixture travels with the Dashboard route so an open page can
// still show it when the browser loses its connection.
export async function loadDashboardSnapshot(): Promise<Snapshot> {
  const rows = feed.data.map((row): AnalysisRecord =>
    withCurrentScore({
      ...row,
      name: "",
      image_data_url: null,
      recommendations: [],
      ai_notes: null,
    }),
  );
  rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return { rows, retrievedAt: feed.provenance.retrievedAt };
}

export async function fetchDashboardFeed(
  signal: AbortSignal,
  loadLive: (signal: AbortSignal) => Promise<AnalysisRecord[]>,
  loadSnapshot = loadDashboardSnapshot,
): Promise<DashboardFeed> {
  try {
    const rows = await loadLive(signal);
    signal.throwIfAborted();
    return { rows };
  } catch (liveError) {
    // A cancelled request is not an outage. Re-check after preparing the snapshot.
    signal.throwIfAborted();
    let snapshot: Snapshot;
    try {
      snapshot = await loadSnapshot();
    } catch {
      signal.throwIfAborted();
      throw liveError;
    }
    signal.throwIfAborted();
    return { rows: snapshot.rows, snapshot: { retrievedAt: snapshot.retrievedAt } };
  }
}
