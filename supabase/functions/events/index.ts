import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function isValidLat(v: unknown): v is number {
  return typeof v === "number" && v >= -90 && v <= 90;
}
function isValidLon(v: unknown): v is number {
  return typeof v === "number" && v >= -180 && v <= 180;
}
function sanitizeCity(input: string): string {
  return input.trim().slice(0, 100).replace(/[^\p{L}\p{N}\s\-,.']/gu, "");
}
function isValidCountryCode(v: unknown): v is string {
  return typeof v === "string" && /^[A-Za-z]{2}$/.test(v);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { city, countryCode, lat, lon } = body;

    if (!city || typeof city !== "string") {
      return new Response(JSON.stringify({ error: "city is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sanitizedCity = sanitizeCity(city);
    if (sanitizedCity.length < 1) {
      return new Response(JSON.stringify({ error: "Invalid city name" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate optional coordinates
    if (lat != null && lon != null) {
      if (!isValidLat(lat) || !isValidLon(lon)) {
        return new Response(JSON.stringify({ error: "Invalid coordinates. Lat: -90 to 90, Lon: -180 to 180" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Validate optional country code
    const validCountryCode = countryCode && isValidCountryCode(countryCode) ? countryCode.toUpperCase() : null;

    const normalizedCity = sanitizedCity.toLowerCase();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check cache (24 hour TTL)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
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

    const apiKey = Deno.env.get("TICKETMASTER_API_KEY");
    if (!apiKey) {
      console.error("[events] TICKETMASTER_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Events service unavailable", data: [] }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = new Date();
    const startDate = now.toISOString().split(".")[0] + "Z";
    const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split(".")[0] + "Z";

    let locationParam: string;
    if (lat != null && lon != null && isValidLat(lat) && isValidLon(lon)) {
      locationParam = `latlong=${lat},${lon}&radius=50&unit=km`;
      console.log("[events] Using lat/lon:", lat, lon);
    } else {
      locationParam = `keyword=${encodeURIComponent(sanitizedCity)}`;
      if (validCountryCode) {
        locationParam += `&countryCode=${encodeURIComponent(validCountryCode)}`;
      }
      console.log("[events] Using city keyword:", sanitizedCity, "countryCode:", validCountryCode || "none");
    }

    const tmUrl = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${apiKey}&${locationParam}&startDateTime=${startDate}&endDateTime=${endDate}&size=50&sort=date,asc`;
    console.log("[events] Request URL:", tmUrl.replace(apiKey, "***"));
    
    const tmRes = await fetch(tmUrl);
    console.log("[events] Response status:", tmRes.status);

    if (!tmRes.ok) {
      const errText = await tmRes.text();
      console.error("[events] Ticketmaster API error:", errText);
      return new Response(
        JSON.stringify({ error: "Events API failed", data: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tmData = await tmRes.json();
    const events = tmData._embedded?.events || [];
    
    console.log("[events] Found", events.length, "events for city:", sanitizedCity);
    if (events.length === 0) {
      return new Response(JSON.stringify({ source: "api", data: [], message: `No events found for ${sanitizedCity} in the next 30 days` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
        city: normalizedCity,
        event_date: evt.dates?.start?.localDate || now.toISOString().split("T")[0],
        name: evt.name,
        category,
        estimated_attendance: attendance,
      };
    });

    if (rows.length > 0) {
      await supabase
        .from("event_cache")
        .delete()
        .eq("city", normalizedCity)
        .lt("fetched_at", twentyFourHoursAgo);

      const { error: insertErr } = await supabase.from("event_cache").insert(rows);
      if (insertErr) console.error("[events] Cache insert error:", insertErr);
    }

    return new Response(JSON.stringify({ source: "api", data: rows }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[events] Function error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", data: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
