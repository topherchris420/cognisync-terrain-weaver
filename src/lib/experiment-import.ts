import { validateLandCover } from "../../supabase/functions/_shared/land-cover";
import { classifyFloodRisk, computeAbsorptionScore } from "./absorption";
import type { InterventionFeature } from "./counterfactual/types";
import { EXPERIMENT_SCHEMA, READABLE_EXPERIMENT_SCHEMAS } from "./experiment-export";
import { replayExperiment, type ReplayableExport, type ReplayReport } from "./experiment-replay";
import { parseBBox } from "./geo";
import type { ElevationGrid, LocalStormResult, SimExtent } from "./hydrology/types";
import { EMPTY_SCENARIO, INTERVENTION_ORDER, type Scenario } from "./scenario";
import type { SimulationResponse } from "./simulation-types";
import { verifyStormSeal, type StormSeal } from "./storm-identity";
import type { AnalysisRecord, LandCover } from "./types";
import type { SubstrateEvidence, SubstrateIdentity } from "./urban-substrate/identity";
import { httpStore, loadSubstrateIndex } from "./urban-substrate/loader";
import type { SubstrateReader } from "./urban-substrate/replay";

/**
 * EVIDENCE THAT RETURNS.
 *
 * An experiment export leaves the instrument as a file. This module brings it
 * back: the file is parsed, every identity in it is verified, the substrate
 * it names is fetched tile by tile and checked against the recorded hashes,
 * NOW and POSSIBLE are routed again by this build, and only then is a study
 * assembled for the workstation.
 *
 * Nothing shown afterwards is read from the file as a result. The score is
 * recomputed from the file's land cover; the routed outputs are this build's
 * own; the file's recorded outputs are kept only to be compared with. A file
 * that fails a check still opens, with the failure named, so the person
 * holding it can see exactly what no longer holds.
 */
export class ExperimentImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExperimentImportError";
  }
}

export { READABLE_EXPERIMENT_SCHEMAS };

/** The parts of an export the import reads. Everything else travels through to replay untouched. */
export interface ExperimentFile extends ReplayableExport {
  question?: string;
  study: {
    id?: unknown;
    name?: unknown;
    location?: unknown;
    bbox: unknown;
    analyzedAt?: unknown;
    dataStatus?: unknown;
    landCover: LandCover;
  };
  models?: { codeCommit?: unknown; routing?: unknown; rasterizer?: string } | null;
  scenario?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Parse an export and refuse, with a reason, anything that is not one. */
export function parseExperimentFile(text: string): ExperimentFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ExperimentImportError("This file is not JSON.");
  }
  if (!isRecord(parsed) || typeof parsed.schema !== "string") {
    throw new ExperimentImportError("This file is not a Mannahatta experiment export: it names no schema.");
  }
  if (!READABLE_EXPERIMENT_SCHEMAS.includes(parsed.schema)) {
    throw new ExperimentImportError(`This build reads ${READABLE_EXPERIMENT_SCHEMAS.join(", ")}; the file is ${parsed.schema}.`);
  }
  if (typeof parsed.evidenceHash !== "string") throw new ExperimentImportError("The file carries no evidence hash, so nothing in it can be verified.");
  if (!isRecord(parsed.study) || !isRecord(parsed.study.landCover)) throw new ExperimentImportError("The file has no study land cover.");
  if (!parseBBox(parsed.study.bbox)) throw new ExperimentImportError("The file has no valid study extent.");
  if (!Array.isArray(parsed.interventions)) throw new ExperimentImportError("The file's interventions are not a list.");
  if (!isRecord(parsed.results)) throw new ExperimentImportError("The file has no results section.");
  return parsed as unknown as ExperimentFile;
}

/**
 * Fetch the published substrate an experiment names into a synchronous
 * reader, so replay can check every recorded tile. Anything that cannot be
 * fetched is simply absent from the reader and fails its check; current data
 * is never substituted for the substrate the experiment recorded.
 */
export async function fetchSubstrateReader(identity: SubstrateIdentity, baseUrl: string, fetchImpl: typeof fetch): Promise<SubstrateReader | null> {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  let path: string | null = null;
  try {
    const index = await loadSubstrateIndex(base, fetchImpl);
    const entry =
      index.substrates.find((s) => s.manifestHash === identity.manifestHash) ??
      index.substrates.find((s) => s.label === identity.substrateVersion) ??
      null;
    path = entry?.path ?? null;
  } catch {
    return null;
  }
  if (!path) return null;
  const store = httpStore(`${base}${path}`, fetchImpl);
  const manifestText = await store.manifest().catch(() => null);
  const tiles = new Map<string, string>();
  await Promise.all(
    identity.tileIds.map(async (id) => {
      try {
        tiles.set(id, await store.tile(id));
      } catch {
        // Missing on the server: replay names the tile.
      }
    }),
  );
  return { location: store.location, manifest: () => manifestText, tile: (id) => tiles.get(id) ?? null };
}

export interface ImportedStudy {
  schema: string;
  evidenceHash: string;
  question: string;
  /** The build that wrote the file, as it recorded itself. */
  codeCommit: string | null;
  /** Rebuilt from the file's land cover; the score is computed here, never read. */
  analysis: AnalysisRecord;
  scenario: Scenario;
  interventions: InterventionFeature[];
  /** Carried only when its seal verifies. */
  storm: StormSeal | null;
  extent: SimExtent | null;
  elevation: ElevationGrid | null;
  substrate: SubstrateEvidence | null;
  /** This build's routing of the file's inputs, per-cell grids included; null when the file cannot be replayed. */
  now: LocalStormResult | null;
  possible: LocalStormResult | null;
  /** What the file itself recorded, kept for comparison, never shown as a result. */
  recorded: { now: SimulationResponse | null; possible: SimulationResponse | null };
  report: ReplayReport;
}

function text(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function scenarioFrom(value: unknown): Scenario {
  const scenario = { ...EMPTY_SCENARIO };
  if (!isRecord(value)) return scenario;
  for (const key of INTERVENTION_ORDER) {
    const fraction = value[key];
    if (typeof fraction === "number" && Number.isFinite(fraction)) scenario[key] = Math.min(1, Math.max(0, fraction));
  }
  return scenario;
}

/** An AnalysisRecord from the file's study, scored by this build. */
export function analysisFromExperiment(file: ExperimentFile): AnalysisRecord {
  let landCover: LandCover;
  try {
    landCover = validateLandCover(file.study.landCover);
  } catch (error) {
    throw new ExperimentImportError(`The file's land cover is not a valid composition: ${error instanceof Error ? error.message : String(error)}`);
  }
  const bbox = parseBBox(file.study.bbox);
  if (!bbox) throw new ExperimentImportError("The file has no valid study extent.");
  const [[west, south], [east, north]] = bbox;
  const score = computeAbsorptionScore(landCover);
  const analyzedAt = text(file.study.analyzedAt, "");
  return {
    id: text(file.study.id, `imported:${file.evidenceHash}`),
    name: text(file.study.name, "Reopened experiment"),
    location_label: typeof file.study.location === "string" ? file.study.location : null,
    center_lat: (south + north) / 2,
    center_lng: (west + east) / 2,
    zoom: 15,
    bbox,
    image_data_url: null,
    land_cover: landCover,
    absorption_score: score,
    flood_risk: classifyFloodRisk(score),
    recommendations: [],
    ai_notes: `Reopened from experiment evidence ${file.evidenceHash}. The score was recomputed from the file's land cover and any routed result was recomputed by this build; nothing was read from the file as a result.`,
    status: text(file.study.dataStatus, "imported"),
    created_at: Number.isNaN(Date.parse(analyzedAt)) ? new Date(0).toISOString() : analyzedAt,
  };
}

export interface ImportOptions {
  /** Used to fetch the substrate the file names; omit to skip and let that check fail honestly. */
  fetch?: typeof fetch | null;
  /** URL prefix of the published substrates (see publishedSubstrateBaseUrl). */
  substrateBaseUrl?: string;
}

/**
 * Verify, replay and rebuild a study from an export. Throws only when the
 * text is not an experiment file at all; a file that fails verification
 * returns, with every failed check in `report`.
 */
export async function importExperiment(source: string, options: ImportOptions = {}): Promise<ImportedStudy> {
  const file = parseExperimentFile(source);
  const described = file.substrate ?? null;
  const reader =
    described?.state.status === "loaded" && options.fetch && options.substrateBaseUrl
      ? await fetchSubstrateReader(described.state, options.substrateBaseUrl, options.fetch)
      : null;
  const report = replayExperiment(file, { substrate: reader });

  const analysis = analysisFromExperiment(file);
  const stormValid = Boolean(file.storm && verifyStormSeal(file.storm));
  const extent = file.inputs?.extent ?? null;
  const grid = file.inputs?.elevation ?? null;
  const elevation: ElevationGrid | null =
    grid && Array.isArray(grid.values) && Number.isInteger(grid.rows) && Number.isInteger(grid.cols)
      ? { values: grid.values, rows: grid.rows, cols: grid.cols, status: grid.status, hash: grid.hash, sourceId: grid.sourceId, warnings: Array.isArray(grid.warnings) ? grid.warnings : [] }
      : null;
  // A forcing whose seal does not verify is not a forcing this instrument will show results for.
  const rerun = stormValid ? report.rerun : null;
  const codeCommit = file.models && typeof file.models.codeCommit === "string" ? file.models.codeCommit : null;

  return {
    schema: file.schema,
    evidenceHash: file.evidenceHash,
    question: text(file.question, "What happens when this storm meets this surface?"),
    codeCommit,
    analysis,
    scenario: scenarioFrom(file.scenario),
    interventions: file.interventions,
    storm: stormValid ? file.storm : null,
    extent: stormValid ? extent : null,
    elevation: stormValid ? elevation : null,
    substrate: described,
    now: rerun?.now ?? null,
    possible: rerun?.possible ?? null,
    recorded: { now: file.results.now ?? null, possible: file.results.possible ?? null },
    report,
  };
}

/** Read a chosen file as text where Blob.text exists and where only FileReader does. */
export function readFileText(file: Blob): Promise<string> {
  if (typeof (file as Blob & { text?: () => Promise<string> }).text === "function") return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("The file could not be read."));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsText(file);
  });
}

export const CURRENT_EXPERIMENT_SCHEMA = EXPERIMENT_SCHEMA;
