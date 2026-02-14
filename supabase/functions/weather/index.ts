import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { city } = await req.json();
    if (!city) {
      return new Response(JSON.stringify({ error: "city is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedCity = city.trim().toLowerCase();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check cache (6 hour TTL)
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const { data: cached } = await supabase
      .from("weather_cache")
      .select("*")
      .eq("city", normalizedCity)
      .gte("fetched_at", sixHoursAgo)
      .order("date", { ascending: true });

    if (cached && cached.length > 0) {
      console.log("[weather] Cache hit for:", normalizedCity, "rows:", cached.length);
      return new Response(JSON.stringify({ source: "cache", data: cached }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch from OpenWeather 5-day forecast
    const apiKey = Deno.env.get("OPENWEATHER_API_KEY");
    if (!apiKey) {
      console.error("[weather] OPENWEATHER_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "OPENWEATHER_API_KEY not configured", data: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const weatherUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city.trim())}&units=metric&appid=${apiKey}`;
    console.log("[weather] Request URL:", weatherUrl.replace(apiKey, "***"));
    
    const weatherRes = await fetch(weatherUrl);
    console.log("[weather] Response status:", weatherRes.status);

    if (!weatherRes.ok) {
      const errText = await weatherRes.text();
      console.error("[weather] API error:", errText);
      return new Response(
        JSON.stringify({ error: "Weather API failed", details: errText, data: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const weatherData = await weatherRes.json();

    // Aggregate 3-hour intervals into daily forecasts
    const dailyMap = new Map<string, { temps: number[]; rainProbs: number[]; conditions: string[] }>();

    for (const item of weatherData.list) {
      const date = item.dt_txt.split(" ")[0];
      if (!dailyMap.has(date)) {
        dailyMap.set(date, { temps: [], rainProbs: [], conditions: [] });
      }
      const entry = dailyMap.get(date)!;
      entry.temps.push(item.main.temp);
      entry.rainProbs.push(item.pop || 0);
      entry.conditions.push(item.weather?.[0]?.main || "Clear");
    }

    const rows = [];
    for (const [date, agg] of dailyMap) {
      const avgTemp = Math.round((agg.temps.reduce((a, b) => a + b, 0) / agg.temps.length) * 10) / 10;
      const avgRain = Math.round((agg.rainProbs.reduce((a, b) => a + b, 0) / agg.rainProbs.length) * 100) / 100;
      const condCount = new Map<string, number>();
      for (const c of agg.conditions) condCount.set(c, (condCount.get(c) || 0) + 1);
      const condition = [...condCount.entries()].sort((a, b) => b[1] - a[1])[0][0];

      rows.push({
        city: normalizedCity,
        date,
        temperature: avgTemp,
        rain_probability: avgRain,
        condition,
      });
    }

    console.log("[weather] Fetched", rows.length, "daily forecasts for", normalizedCity);

    // Upsert into cache
    if (rows.length > 0) {
      const { error: upsertErr } = await supabase
        .from("weather_cache")
        .upsert(rows, { onConflict: "city,date" });
      if (upsertErr) console.error("[weather] Cache upsert error:", upsertErr);
    }

    return new Response(JSON.stringify({ source: "api", data: rows }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[weather] Function error:", err);
    return new Response(
      JSON.stringify({ error: err.message, data: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});