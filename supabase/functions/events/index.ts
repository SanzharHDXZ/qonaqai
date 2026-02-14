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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check cache (24 hour TTL)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: cached } = await supabase
      .from("event_cache")
      .select("*")
      .eq("city", city.toLowerCase())
      .gte("fetched_at", twentyFourHoursAgo);

    if (cached && cached.length > 0) {
      return new Response(JSON.stringify({ source: "cache", data: cached }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch from Ticketmaster Discovery API
    const apiKey = Deno.env.get("TICKETMASTER_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "TICKETMASTER_API_KEY not configured", data: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = new Date();
    const startDate = now.toISOString().split(".")[0] + "Z";
    const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split(".")[0] + "Z";

    const tmUrl = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${apiKey}&city=${encodeURIComponent(city)}&startDateTime=${startDate}&endDateTime=${endDate}&size=50&sort=date,asc`;
    const tmRes = await fetch(tmUrl);

    if (!tmRes.ok) {
      const errText = await tmRes.text();
      console.error("Ticketmaster API error:", errText);
      return new Response(
        JSON.stringify({ error: "Events API failed", details: errText, data: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tmData = await tmRes.json();
    const events = tmData._embedded?.events || [];

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

      // Estimate attendance from venue capacity or seatmap
      let attendance = 1000; // default
      const venues = evt._embedded?.venues;
      if (venues?.[0]) {
        const cap = venues[0].generalInfo?.generalRule
          ? 5000
          : venues[0].upcomingEvents?._total || 2000;
        attendance = Math.min(cap * 0.8, 50000);
      }
      // Use price range as proxy for event size if available
      if (evt.priceRanges?.[0]?.max > 200) attendance = Math.max(attendance, 8000);

      return {
        city: city.toLowerCase(),
        event_date: evt.dates?.start?.localDate || now.toISOString().split("T")[0],
        name: evt.name,
        category,
        estimated_attendance: attendance,
      };
    });

    // Clear old cache for this city and insert new
    if (rows.length > 0) {
      await supabase
        .from("event_cache")
        .delete()
        .eq("city", city.toLowerCase())
        .lt("fetched_at", twentyFourHoursAgo);

      const { error: insertErr } = await supabase.from("event_cache").insert(rows);
      if (insertErr) console.error("Event cache insert error:", insertErr);
    }

    return new Response(JSON.stringify({ source: "api", data: rows }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Events function error:", err);
    return new Response(
      JSON.stringify({ error: err.message, data: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
