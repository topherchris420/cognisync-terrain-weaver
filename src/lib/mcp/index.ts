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
    "Tools for the Urban Resilience Intelligence platform. Terrain scans classify satellite imagery into pavement, buildings, vegetation, water and soil, then derive an Urban Absorption Score (0-100) and a flood-risk band. Read: `list_scans`, `find_scans_near`, `get_scan`, `score_land_cover`. Write (acts as the signed-in user): `create_analysis` stores a new scan, `update_analysis` and `delete_analysis` manage scans you own, and `list_my_scans` lists them.",
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