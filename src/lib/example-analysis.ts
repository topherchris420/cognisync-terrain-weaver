import { classifyFloodRisk, computeAbsorptionScore } from "./absorption";
import type { AnalysisRecord, LandCover } from "./types";

const cover: LandCover = { buildings: 38, pavement: 29, vegetation: 18, water: 12, soil: 3 };
const score = computeAbsorptionScore(cover);

/** A teaching fixture, never a sensor reading or a saved community scan. */
export const EXAMPLE_ANALYSIS: AnalysisRecord = {
  id: "example-lower-manhattan",
  name: "Lower Manhattan — illustrative example",
  location_label: "Lower Manhattan, NY",
  center_lat: 40.7075,
  center_lng: -74.009,
  zoom: 15,
  bbox: [[-74.014, 40.703], [-74.004, 40.712]],
  image_data_url: null,
  land_cover: cover,
  absorption_score: score,
  flood_risk: classifyFloodRisk(score),
  recommendations: [
    { title: "Give rainfall a place to land", description: "Explore converting paved corners to rain gardens. Start with small areas and compare the change in absorption and planning cost.", priority: "high", category: "green" },
    { title: "Make room for street trees", description: "Model connected tree pits along paved streets to increase permeable surface and shade.", priority: "high", category: "green" },
    { title: "Put rooftops to work", description: "Test vegetated roofs as a way to retain rainfall where ground-level space is limited.", priority: "medium", category: "green" },
  ],
  ai_notes: "Illustrative data for exploring the interface, not observed land cover or a site assessment. Scores use the same published weights as live scans. Costs and retention are planning estimates.",
  status: "example",
  created_at: "2026-09-10T00:00:00.000Z",
};
