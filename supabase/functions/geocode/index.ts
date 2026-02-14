const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function sanitizeString(input: string, maxLength: number): string {
  return input.trim().slice(0, maxLength).replace(/[^\p{L}\p{N}\s\-,.']/gu, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();
    if (!query || typeof query !== "string") {
      return new Response(JSON.stringify({ error: "query must be a non-empty string", suggestions: [] }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sanitized = sanitizeString(query, 200);
    if (sanitized.length < 2) {
      return new Response(JSON.stringify({ suggestions: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("OPENWEATHER_API_KEY");
    if (!apiKey) {
      console.error("[geocode] OPENWEATHER_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Geocoding service unavailable", suggestions: [] }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(sanitized)}&limit=5&appid=${apiKey}`;
    console.log("[geocode] Request URL:", geoUrl.replace(apiKey, "***"));
    
    const geoRes = await fetch(geoUrl);
    console.log("[geocode] Response status:", geoRes.status);

    if (!geoRes.ok) {
      const errText = await geoRes.text();
      console.error("[geocode] API error:", errText);
      return new Response(
        JSON.stringify({ error: "Geocoding failed", suggestions: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const geoData = await geoRes.json();
    console.log("[geocode] Results count:", geoData.length);
    
    const suggestions = geoData.map((item: any) => ({
      name: item.name,
      country: item.country,
      state: item.state || null,
      lat: item.lat,
      lon: item.lon,
      label: item.state
        ? `${item.name}, ${item.state}, ${item.country}`
        : `${item.name}, ${item.country}`,
    }));

    return new Response(JSON.stringify({ suggestions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[geocode] Function error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", suggestions: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
