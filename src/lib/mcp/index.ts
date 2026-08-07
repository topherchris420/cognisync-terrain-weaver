import { defineMcp } from "@lovable.dev/mcp-js";
import listScans from "./tools/list-scans";
import getScan from "./tools/get-scan";
import findScansNear from "./tools/find-scans-near";
import scoreLandCover from "./tools/score-land-cover";

export default defineMcp({
  name: "cognisync-terrain-weaver",
  title: "cognisync-terrain-weaver",
  version: "0.1.0",
  instructions:
    "Tools for the Urban Resilience Intelligence platform. Terrain scans classify satellite imagery into pavement, buildings, vegetation, water and soil, then derive an Urban Absorption Score (0-100) and a flood-risk band. Use `list_scans` to browse recent scans, `find_scans_near` to search by coordinates, `get_scan` for full detail including climate-adaptation recommendations, and `score_land_cover` to score a hypothetical land-cover mix.",
  tools: [listScans, getScan, findScansNear, scoreLandCover],
});