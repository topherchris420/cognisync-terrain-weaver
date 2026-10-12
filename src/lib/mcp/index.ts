import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listScans from "./tools/list-scans";
import getScan from "./tools/get-scan";
import findScansNear from "./tools/find-scans-near";
import scoreLandCover from "./tools/score-land-cover";
import createAnalysis from "./tools/create-analysis";
import updateAnalysis from "./tools/update-analysis";
import deleteAnalysis from "./tools/delete-analysis";
import listMyScans from "./tools/list-my-scans";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "cognisync-terrain-weaver",
  title: "cognisync-terrain-weaver",
  version: "0.2.0",
  instructions:
    "Tools for Mannahatta, a counterfactual urban resilience instrument. Terrain scans classify satellite imagery into pavement, buildings, vegetation, water and soil, then derive an Urban Absorption Score (0-100) and a score band (`flood_risk`: low, moderate or high runoff share; a screening category, not a validated flood hazard). Scores are computed from land cover by code, never read from storage or accepted from a model. Read: `list_scans`, `find_scans_near`, `get_scan`, `score_land_cover`. Write (acts as the signed-in user): `create_analysis` stores a new scan, `update_analysis` and `delete_analysis` manage scans you own, and `list_my_scans` lists them.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listScans,
    getScan,
    findScansNear,
    scoreLandCover,
    listMyScans,
    createAnalysis,
    updateAnalysis,
    deleteAnalysis,
  ],
});