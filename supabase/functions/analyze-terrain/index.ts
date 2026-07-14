// Edge function: analyze-terrain
// - Accepts a satellite JPEG (data URL) + map viewport metadata
// - Uses Lovable AI (Gemini 2.5 Flash) to classify land cover
// - Computes an Urban Absorption Score and generates adaptation recommendations
// - Persists the result to the public.analyses table
// - Returns the newly inserted row
//
// Configured with verify_jwt = false so anonymous visitors can submit scans.
// See security memory: this is an intentional public-demo posture.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const AI_MODEL = "google/gemini-2.5-flash";
const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

interface Body {
  name?: string;
  location_label?: string | null;
  center_lat: number;
  center_lng: number;
  zoom: number;
  bbox?: unknown;
  image_data_url: string;
}

type LandCover = {
  pavement: number;
  buildings: number;
  vegetation: number;
  water: number;
  soil: number;
};

// KEEP IN SYNC with src/lib/absorption.ts. This runs on Deno and cannot import
// from src/, so the model is duplicated by necessity. A test in
// src/lib/absorption.test.ts parses THIS FILE and fails if the two drift.
//
// Weights are `1 - C`, where C is the Rational Method runoff coefficient used in
// real drainage design (ASCE; Chow, Maidment & Mays). Water carries no weight and
// is excluded from the denominator: open water is the body that RECEIVES runoff,
// not absorption capacity. See the long note in src/lib/absorption.ts.
type AbsorbingKey = "vegetation" | "soil" | "buildings" | "pavement";

const WEIGHTS: Record<AbsorbingKey, number> = {
  vegetation: 0.8,
  soil: 0.7,
  buildings: 0.1,
  pavement: 0.12,
};

const ABSORBING: AbsorbingKey[] = ["vegetation", "soil", "buildings", "pavement"];

function computeAbsorption(c: LandCover): number {
  const land = ABSORBING.reduce((s, k) => s + (Number(c[k]) || 0), 0);
  if (land <= 0) return 0;
  const absorbed = ABSORBING.reduce(
    (s, k) => s + (Number(c[k]) || 0) * WEIGHTS[k],
    0,
  );
  return Math.round((absorbed / land) * 100 * 10) / 10;
}

// Calibrated against 18 real scans spanning Bois de Boulogne (74.7) to Midtown
// Manhattan (14.0). See docs/absorption-calibration.md.
const RISK_BANDS = { moderate: 35, low: 55 };

function classifyFloodRisk(score: number): "low" | "moderate" | "high" {
  if (score >= RISK_BANDS.low) return "low";
  if (score >= RISK_BANDS.moderate) return "moderate";
  return "high";
}

function jsonError(status: number, message: string, extra?: unknown) {
  return new Response(
    JSON.stringify({ error: message, details: extra ?? null }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

async function callAI(payload: unknown, apiKey: string) {
  const res = await fetch(AI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`AI gateway ${res.status}:`, text);
    throw new Response(
      JSON.stringify({
        error:
          res.status === 429
            ? "Rate limit exceeded. Try again shortly."
            : res.status === 402
            ? "AI credits exhausted. Add credits to your workspace."
            : "AI request failed.",
        status: res.status,
        details: text,
      }),
      {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const data = await res.json();
  const content: string | undefined = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Response(
      JSON.stringify({ error: "AI returned no content.", raw: data }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  return content;
}

function safeParseJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    // Try to salvage a JSON object out of a code fence
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function normalizeCover(raw: Partial<LandCover>): LandCover {
  const keys: (keyof LandCover)[] = [
    "pavement",
    "buildings",
    "vegetation",
    "water",
    "soil",
  ];
  const clean: LandCover = {
    pavement: 0,
    buildings: 0,
    vegetation: 0,
    water: 0,
    soil: 0,
  };
  for (const k of keys) {
    const v = Number(raw[k] ?? 0);
    clean[k] = Number.isFinite(v) && v > 0 ? v : 0;
  }
  const sum = Object.values(clean).reduce((a, b) => a + b, 0);
  if (sum <= 0) return clean;
  // Rescale to 100
  const factor = 100 / sum;
  for (const k of keys) clean[k] = Math.round(clean[k] * factor * 10) / 10;
  // Fix rounding drift on the largest class
  const drift = 100 - Object.values(clean).reduce((a, b) => a + b, 0);
  if (Math.abs(drift) > 0.01) {
    const largest = keys.reduce((a, b) => (clean[a] >= clean[b] ? a : b));
    clean[largest] = Math.round((clean[largest] + drift) * 10) / 10;
  }
  return clean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonError(405, "Method not allowed");

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return jsonError(500, "LOVABLE_API_KEY is not configured.");

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseServiceKey)
    return jsonError(500, "Supabase server credentials are missing.");

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return jsonError(400, "Invalid JSON body.");
  }

  if (!body?.image_data_url || !body.image_data_url.startsWith("data:image/")) {
    return jsonError(400, "Missing or invalid image_data_url.");
  }
  if (
    typeof body.center_lat !== "number" ||
    typeof body.center_lng !== "number" ||
    typeof body.zoom !== "number"
  ) {
    return jsonError(400, "Missing center_lat, center_lng, or zoom.");
  }

  try {
    // ----- 1. Land cover classification -----
    const classificationPrompt = `You are an urban land-cover classifier analyzing an aerial/satellite view.

Estimate the percentage of the image covered by each class. Percentages MUST be integers or one-decimal numbers and MUST sum to 100.

Classes:
- pavement: roads, parking lots, plazas, driveways (impervious)
- buildings: rooftops of any structure (impervious)
- vegetation: trees, grass, parks, crops, shrubs (permeable)
- water: rivers, lakes, ponds, canals, pools
- soil: bare earth, dirt, sand, unpaved lots (permeable)

Return STRICT JSON only, no prose, no code fence:
{"pavement":number,"buildings":number,"vegetation":number,"water":number,"soil":number,"notes":"one short sentence describing what you saw"}`;

    const classifyRaw = await callAI(
      {
        model: AI_MODEL,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: classificationPrompt },
              {
                type: "image_url",
                image_url: { url: body.image_data_url },
              },
            ],
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      },
      apiKey,
    );

    const parsed = safeParseJson<Partial<LandCover> & { notes?: string }>(
      classifyRaw,
    );
    if (!parsed) {
      return jsonError(502, "AI returned unparseable classification.", classifyRaw);
    }

    const cover = normalizeCover(parsed);
    const aiNotes = typeof parsed.notes === "string" ? parsed.notes : null;
    const score = computeAbsorption(cover);
    const risk = classifyFloodRisk(score);

    // ----- 2. Adaptation recommendations -----
    const recPrompt = `You are an urban climate-adaptation advisor.

Given this site:
- Location: ${body.location_label ?? `${body.center_lat.toFixed(4)}, ${body.center_lng.toFixed(4)}`}
- Land cover: pavement ${cover.pavement}%, buildings ${cover.buildings}%, vegetation ${cover.vegetation}%, water ${cover.water}%, soil ${cover.soil}%
- Urban Absorption Score: ${score}/100
- Flood risk band: ${risk}

Recommend 4 climate-adaptation interventions that would meaningfully improve permeability, reduce runoff, and mitigate flooding for THIS site profile.

Return STRICT JSON only:
{"recommendations":[
  {"title":"short title","description":"1-2 sentence rationale specific to the site","priority":"high|medium|low","category":"green|blue|gray"}
]}

Use category "green" for vegetation/bioswales, "blue" for water storage/drainage, "gray" for engineered concrete solutions.`;

    const recRaw = await callAI(
      {
        model: AI_MODEL,
        messages: [{ role: "user", content: recPrompt }],
        response_format: { type: "json_object" },
        temperature: 0.5,
      },
      apiKey,
    );

    const recParsed = safeParseJson<{ recommendations?: unknown }>(recRaw);
    const recommendations = Array.isArray(recParsed?.recommendations)
      ? recParsed.recommendations
      : [];

    // ----- 3. Persist -----
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: inserted, error: dbError } = await supabase
      .from("analyses")
      .insert({
        name: (body.name || "Untitled site").slice(0, 120),
        location_label: body.location_label?.slice(0, 200) ?? null,
        center_lat: body.center_lat,
        center_lng: body.center_lng,
        zoom: body.zoom,
        bbox: body.bbox ?? null,
        // We do NOT persist the full data URL to keep row size sane.
        image_data_url: null,
        land_cover: cover,
        absorption_score: score,
        flood_risk: risk,
        recommendations,
        ai_notes: aiNotes,
        status: "complete",
      })
      .select("*")
      .single();

    if (dbError) {
      console.error("DB insert failed:", dbError);
      return jsonError(500, "Failed to persist analysis.", dbError.message);
    }

    return new Response(JSON.stringify({ analysis: inserted }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (thrown) {
    if (thrown instanceof Response) return thrown;
    console.error("analyze-terrain unexpected error:", thrown);
    return jsonError(500, "Unexpected server error.", String(thrown));
  }
});
