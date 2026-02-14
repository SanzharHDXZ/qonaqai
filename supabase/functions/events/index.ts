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
    const body = await req.json();
    const { city, lat, lon } = body;

    // Prefer lat/lon over city name for accuracy
    if (!city && !lat) {
      return new Response(JSON.stringify({ error: "city or lat/lon is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedCity = (city || "").trim().toLowerCase();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check cache (24 hour TTL)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    if (normalizedCity) {
      const { data: cached } = await supabase
        .from("event_cache")
        .select("*")
        .eq("city", normalizedCity)
        .gte("fetched_at", twentyFourHoursAgo);

      if (cached && cached.length > 0) {
        console.log("[events] Cache hit for:", normalizedCity, "rows:", cached.length);
        return new Response(JSON.stringify({ source: "cache", data: cached }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Fetch from Ticketmaster Discovery API
    const apiKey = Deno.env.get("TICKETMASTER_API_KEY");
    if (!apiKey) {
      console.error("[events] TICKETMASTER_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "TICKETMASTER_API_KEY not configured", data: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = new Date();
    const startDate = now.toISOString().split(".")[0] + "Z";
    const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split(".")[0] + "Z";

    // Build URL: use latlong if available, otherwise fall back to city
    let tmUrl: string;
    if (lat && lon) {
      // Use geoPoint with a 50km radius for much better results
      tmUrl = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${apiKey}&latlong=${lat},${lon}&radius=50&unit=km&startDateTime=${startDate}&endDateTime=${endDate}&size=50&sort=date,asc`;
      console.log("[events] Using lat/lon:", lat, lon);
    } else {
      tmUrl = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${apiKey}&city=${encodeURIComponent(city.trim())}&startDateTime=${startDate}&endDateTime=${endDate}&size=50&sort=date,asc`;
      console.log("[events] Using city name (fallback):", city.trim());
    }
    
    console.log("[events] Request URL:", tmUrl.replace(apiKey, "***"));
    
    const tmRes = await fetch(tmUrl);
    console.log("[events] Response status:", tmRes.status);

    if (!tmRes.ok) {
      const errText = await tmRes.text();
      console.error("[events] Ticketmaster API error:", errText);
      return new Response(
        JSON.stringify({ error: "Events API failed", details: errText, data: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tmData = await tmRes.json();
    const events = tmData._embedded?.events || [];
    
    console.log("[events] Found", events.length, "events");
    if (events.length === 0) {
      console.warn("[events] No events returned by API for selected range.", 
        "City:", city?.trim(), "Lat:", lat, "Lon:", lon,
        "Date range:", startDate, "to", endDate);
      // Log the full response page info for debugging
      console.log("[events] Response page info:", JSON.stringify(tmData.page || {}));
    }

    // Map Ticketmaster classifications to our categories
    const classificationMap: Record<string, string> = {
      Music: "concert",
      Sports: "sports",
      "Arts & Theatre": "concert",
      Film: "other",
      Miscellaneous: "other",
    };

    const rows = events.map((evt: any) => {
      const segment = evt.classifications?.[0]?.segment?.name || "Miscellaneous";
      const category = classificationMap[segment] || "other";

      let attendance = 1000;
      const venues = evt._embedded?.venues;
      if (venues?.[0]) {
        const cap = venues[0].generalInfo?.generalRule
          ? 5000
          : venues[0].upcomingEvents?._total || 2000;
        attendance = Math.min(cap * 0.8, 50000);
      }
      if (evt.priceRanges?.[0]?.max > 200) attendance = Math.max(attendance, 8000);

      return {
        city: normalizedCity || `${lat},${lon}`,
        event_date: evt.dates?.start?.localDate || now.toISOString().split("T")[0],
        name: evt.name,
        category,
        estimated_attendance: attendance,
      };
    });

    // Clear old cache for this city and insert new
    const cacheCity = normalizedCity || `${lat},${lon}`;
    if (rows.length > 0) {
      await supabase
        .from("event_cache")
        .delete()
        .eq("city", cacheCity)
        .lt("fetched_at", twentyFourHoursAgo);

      const { error: insertErr } = await supabase.from("event_cache").insert(rows);
      if (insertErr) console.error("[events] Cache insert error:", insertErr);
    }

    return new Response(JSON.stringify({ source: "api", data: rows, count: rows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[events] Function error:", err);
    return new Response(
      JSON.stringify({ error: err.message, data: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
