import { z } from "zod";
import type { CatalystFieldNote } from "./types";

const FIELD_NOTES_KEY = "mannahatta:catalyst-field-notes";
const COUNTERFACTUAL_SEQUENCE_KEY = "mannahatta:catalyst-counterfactual-seq";

const fieldNoteSchema = z.object({
  id: z.string().regex(/^MNH-CF-\d{4,}$/),
  timestamp: z.string().min(1),
  hypothesis: z.string().min(1),
  terrainContext: z.object({
    presentScore: z.number().finite(),
    historicalScore: z.number().finite(),
    provenance: z.enum([
      "measured",
      "derived",
      "simulated",
      "estimated",
      "reconstructed",
      "inferred",
      "unavailable",
    ]),
  }),
  intervention: z.string().min(1),
  outcome: z.enum([
    "SUPPORTED UNDER THIS SIMULATION",
    "NOT SUPPORTED UNDER THIS SIMULATION",
    "FALSIFIED UNDER TESTED CONDITIONS",
    "INCONCLUSIVE",
  ]),
  assumptions: z.array(z.string()),
  limitations: z.array(z.string()),
});

export function createCounterfactualId(sequence: number): string {
  const safe = Math.max(0, Math.floor(sequence));
  return `MNH-CF-${String(safe).padStart(4, "0")}`;
}

function storageAvailable(): boolean {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

export function nextCounterfactualId(): string {
  if (!storageAvailable()) return createCounterfactualId(1);
  const current = Number(localStorage.getItem(COUNTERFACTUAL_SEQUENCE_KEY) ?? "0");
  const next = Number.isFinite(current) ? current + 1 : 1;
  localStorage.setItem(COUNTERFACTUAL_SEQUENCE_KEY, String(next));
  return createCounterfactualId(next);
}

export function loadFieldNotes(): CatalystFieldNote[] {
  if (!storageAvailable()) return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(FIELD_NOTES_KEY) ?? "[]");
    return z.array(fieldNoteSchema).parse(parsed);
  } catch {
    return [];
  }
}

export function saveFieldNote(note: CatalystFieldNote): void {
  if (!storageAvailable()) return;
  const safeNote = fieldNoteSchema.parse(note);
  const notes = loadFieldNotes().filter((existing) => existing.id !== safeNote.id);
  localStorage.setItem(FIELD_NOTES_KEY, JSON.stringify([safeNote, ...notes].slice(0, 30)));
}
