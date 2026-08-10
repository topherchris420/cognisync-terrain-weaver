import { fetchOfficialSpatialContext } from "../_shared/spatial-context.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await request.json();
    const result = await fetchOfficialSpatialContext(
      body?.bbox,
      request.signal
    );
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/geo+json" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Spatial context failed";
    const clientError = /bbox|numeric|ordered|50 km/i.test(message);
    return new Response(JSON.stringify({ error: message }), {
      status: clientError ? 400 : 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
