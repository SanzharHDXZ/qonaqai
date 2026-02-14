/**
 * External Market Signals Layer
 *
 * Integrates real-world data from:
 *   1. OpenWeather API (weather forecasts) — via edge function
 *   2. Ticketmaster API (local events) — via edge function
 *   3. Manual competitor rates (from DB)
 *
 * Combined External Signal Score: 0–20 (clamped)
 * All functions fail gracefully (score = 0 on API error).
 */

import { supabase } from "@/integrations/supabase/client";

// ─── Types ─────────────────────────────────────────────

export interface LocalEvent {
  name: string;
  category: string;
  estimatedAttendance: number;
  date: string;
}

export interface WeatherData {
  temperature: number;
  rainProbability: number;
  condition: string;
}

export interface CompetitorRate {
  competitor_name: string;
  price: number;
}

export interface ExternalSignalResult {
  eventImpact: number;
  weatherImpact: number;
  competitorImpact: number;
  totalScore: number;
  weatherAvailable: boolean;
  eventsAvailable: boolean;
}

export interface ApiStatus {
  weather: "connected" | "error" | "unconfigured";
  events: "connected" | "error" | "unconfigured";
  competitor: "connected";
}

// ─── Category weights ──────────────────────────────────

export const EVENT_CATEGORY_WEIGHTS: Record<string, number> = {
  conference: 1.2,
  concert: 1.1,
  sports: 1.15,
  festival: 1.25,
  trade_fair: 1.2,
  holiday: 1.12,
  meetup: 0.6,
  other: 0.8,
};

// ─── In-memory cache for current session ───────────────

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const memCache = new Map<string, { data: unknown; ts: number }>();

function getMemCached<T>(key: string): T | null {
  const e = memCache.get(key);
  if (!e || Date.now() - e.ts > CACHE_TTL_MS) return null;
  return e.data as T;
}

function setMemCache<T>(key: string, data: T): void {
  memCache.set(key, { data, ts: Date.now() });
}

// ─── Weather (Real API via Edge Function) ──────────────

export async function fetchWeatherData(city: string): Promise<{ data: WeatherData[]; available: boolean }> {
  if (!city) return { data: [], available: false };

  const cacheKey = `weather:${city.toLowerCase()}`;
  const cached = getMemCached<WeatherData[]>(cacheKey);
  if (cached) return { data: cached, available: true };

  try {
    const { data, error } = await supabase.functions.invoke("weather", {
      body: { city },
    });

    if (error || !data?.data || data.data.length === 0) {
      console.warn("Weather API unavailable:", error?.message || data?.error);
      return { data: [], available: false };
    }

    const weatherData: WeatherData[] = data.data.map((d: any) => ({
      temperature: Number(d.temperature),
      rainProbability: Number(d.rain_probability),
      condition: d.condition || "Clear",
    }));

    setMemCache(cacheKey, weatherData);
    return { data: weatherData, available: true };
  } catch (err) {
    console.warn("Weather fetch failed:", err);
    return { data: [], available: false };
  }
}

export function computeWeatherImpact(weather: WeatherData | undefined, date: Date): number {
  if (!weather) return 0;

  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
  const isSevere = ["Thunderstorm", "Snow", "Extreme"].includes(weather.condition);

  if (isSevere) return -5;

  let impact = 0;

  if (weather.rainProbability > 0.7 && isWeekend) {
    impact = -3;
  } else if (weather.rainProbability > 0.5) {
    impact = -1;
  }

  if (weather.temperature >= 18 && weather.temperature <= 28 && isWeekend && weather.rainProbability < 0.3) {
    impact = Math.max(impact, 2);
  }

  return Math.max(-5, Math.min(5, impact));
}

// ─── Events (Real API via Edge Function) ───────────────

export async function fetchEventData(
  city: string,
  lat?: number | null,
  lon?: number | null
): Promise<{ data: LocalEvent[]; available: boolean }> {
  if (!city && !lat) return { data: [], available: false };

  const cacheKey = `events:${lat && lon ? `${lat},${lon}` : city.toLowerCase()}`;
  const cached = getMemCached<LocalEvent[]>(cacheKey);
  if (cached) return { data: cached, available: true };

  try {
    const body: Record<string, unknown> = { city };
    if (lat != null && lon != null) {
      body.lat = lat;
      body.lon = lon;
    }

    const { data, error } = await supabase.functions.invoke("events", { body });

    if (error || !data?.data || data.data.length === 0) {
      const reason = error?.message || data?.error || "empty response";
      console.warn("[Events API] No events returned:", reason, "city:", city, "lat:", lat, "lon:", lon);
      if (data?.count === 0) {
        console.warn("[Events API] No events returned by API for selected range.");
      }
      return { data: [], available: !error };
    }

    console.log("[Events API] Fetched", data.data.length, "events for", city);

    const events: LocalEvent[] = data.data.map((d: any) => ({
      name: d.name,
      category: d.category || "other",
      estimatedAttendance: Number(d.estimated_attendance) || 1000,
      date: d.event_date,
    }));

    setMemCache(cacheKey, events);
    return { data: events, available: true };
  } catch (err) {
    console.warn("Events fetch failed:", err);
    return { data: [], available: false };
  }
}

// ─── Event Impact ──────────────────────────────────────

export function getEventImpact(date: Date, events: LocalEvent[]): number {
  const dateStr = date.toISOString().slice(0, 10);
  const dayEvents = events.filter((e) => e.date === dateStr);

  if (dayEvents.length === 0) return 0;

  let totalScore = 0;
  for (const evt of dayEvents) {
    const attendance = Math.max(0, evt.estimatedAttendance);
    const categoryWeight = EVENT_CATEGORY_WEIGHTS[evt.category.toLowerCase()] ?? EVENT_CATEGORY_WEIGHTS.other;
    totalScore += Math.log(attendance + 1) * categoryWeight;
  }

  return Math.min(10, Math.max(0, Math.round((totalScore / 9) * 10) / 10));
}

// ─── Weather Impact (using pre-fetched data) ───────────

export function getWeatherImpact(date: Date, weatherData: WeatherData[]): number {
  if (weatherData.length === 0) return 0;

  // Use index based on day offset from today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOffset = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  const weather = weatherData[Math.min(dayOffset, weatherData.length - 1)];
  return computeWeatherImpact(weather, date);
}

// ─── Competitor Impact ─────────────────────────────────

export function getCompetitorImpact(hotelPrice: number, competitorRates: CompetitorRate[]): number {
  if (competitorRates.length === 0) return 0;

  const marketAvg = competitorRates.reduce((s, c) => s + c.price, 0) / competitorRates.length;
  if (marketAvg === 0) return 0;

  const diff = (marketAvg - hotelPrice) / marketAvg;
  const score = Math.round(diff * 25 * 10) / 10;
  return Math.max(-5, Math.min(5, score));
}

// ─── Combined External Signal Score ────────────────────

export function getExternalSignalScore(
  date: Date,
  hotelPrice: number,
  competitorRates: CompetitorRate[],
  weatherData: WeatherData[],
  events: LocalEvent[]
): ExternalSignalResult {
  const eventImpact = getEventImpact(date, events);
  const weatherImpact = getWeatherImpact(date, weatherData);
  const competitorImpact = getCompetitorImpact(hotelPrice, competitorRates);

  const weatherShifted = weatherImpact + 5;
  const competitorShifted = competitorImpact + 5;

  const raw = eventImpact + weatherShifted + competitorShifted;
  const totalScore = Math.max(0, Math.min(20, Math.round(raw * 10) / 10));

  return {
    eventImpact,
    weatherImpact,
    competitorImpact,
    totalScore,
    weatherAvailable: weatherData.length > 0,
    eventsAvailable: events.length > 0,
  };
}

// ─── API Status Check ──────────────────────────────────

export async function checkApiStatus(): Promise<ApiStatus> {
  const results: ApiStatus = {
    weather: "unconfigured",
    events: "unconfigured",
    competitor: "connected",
  };

  try {
    const { data: wData, error: wErr } = await supabase.functions.invoke("weather", {
      body: { city: "London" },
    });
    if (wErr) {
      results.weather = "error";
    } else if (wData?.error?.includes("not configured")) {
      results.weather = "unconfigured";
    } else {
      results.weather = "connected";
    }
  } catch {
    results.weather = "error";
  }

  try {
    const { data: eData, error: eErr } = await supabase.functions.invoke("events", {
      body: { city: "London" },
    });
    if (eErr) {
      results.events = "error";
    } else if (eData?.error?.includes("not configured")) {
      results.events = "unconfigured";
    } else {
      results.events = "connected";
    }
  } catch {
    results.events = "error";
  }

  return results;
}
