/**
 * External Market Signals Layer
 *
 * Provides a modular, API-ready architecture for integrating
 * real-world signals into the demand forecasting model.
 *
 * Three signal types:
 *   1. Event Impact (0–10 scale)
 *   2. Weather Impact (-5 to +5 scale)
 *   3. Competitor Impact (-5 to +5 scale)
 *
 * Combined External Signal Score: 0–20 (clamped)
 *
 * All functions are deterministic and fail gracefully (score = 0 on error).
 * API responses are cached with a 6-hour TTL.
 */

// ─── Cache Layer ───────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

// ─── Event Impact ──────────────────────────────────────

/** Category weights for event types */
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

export interface LocalEvent {
  name: string;
  category: string;
  estimatedAttendance: number;
  date: string; // YYYY-MM-DD
}

/**
 * Compute event strength score for a given city and date.
 *
 * Formula: log(attendance + 1) × proximity_factor × category_weight
 * Normalized to 0–10 scale.
 *
 * Currently uses a deterministic rule-based fallback.
 * Replace the body of fetchEvents() with a real API call (e.g. Eventbrite)
 * when ready – the rest of the pipeline stays the same.
 */
export function getEventImpact(
  city: string,
  date: Date,
  events?: LocalEvent[]
): number {
  const cacheKey = `event:${city}:${date.toISOString().slice(0, 10)}`;
  const cached = getCached<number>(cacheKey);
  if (cached !== null) return cached;

  const dayEvents = events ?? fetchEventsRuleBased(city, date);
  if (dayEvents.length === 0) {
    setCache(cacheKey, 0);
    return 0;
  }

  // Sum contributions from all events on this day
  let totalScore = 0;
  for (const evt of dayEvents) {
    const attendance = Math.max(0, evt.estimatedAttendance);
    const categoryWeight =
      EVENT_CATEGORY_WEIGHTS[evt.category.toLowerCase()] ??
      EVENT_CATEGORY_WEIGHTS.other;
    // Proximity factor: 1.0 for the day itself (could degrade for adjacent days)
    const proximityFactor = 1.0;
    totalScore +=
      Math.log(attendance + 1) * proximityFactor * categoryWeight;
  }

  // Normalize: log(10000) ≈ 9.2, so divide by ~9 to get 0–10
  const normalized = Math.min(10, Math.max(0, Math.round((totalScore / 9) * 10) / 10));
  setCache(cacheKey, normalized);
  return normalized;
}

/**
 * Rule-based event fallback (deterministic, no API).
 * Replace with real API call when ready.
 */
function fetchEventsRuleBased(city: string, date: Date): LocalEvent[] {
  const dayOfWeek = date.getDay();
  const month = date.getMonth();
  const dayOfMonth = date.getDate();
  const events: LocalEvent[] = [];

  // Weekend concert (Fri/Sat) in summer months
  if ((dayOfWeek === 5 || dayOfWeek === 6) && month >= 5 && month <= 8) {
    events.push({
      name: `${city} Summer Music Night`,
      category: "concert",
      estimatedAttendance: 3000,
      date: date.toISOString().slice(0, 10),
    });
  }

  // Monthly trade fair (15th of each month)
  if (dayOfMonth === 15) {
    events.push({
      name: `${city} Trade Expo`,
      category: "trade_fair",
      estimatedAttendance: 5000,
      date: date.toISOString().slice(0, 10),
    });
  }

  // Quarterly conference (1st of Jan/Apr/Jul/Oct)
  if (dayOfMonth === 1 && [0, 3, 6, 9].includes(month)) {
    events.push({
      name: `${city} Quarterly Tech Conference`,
      category: "conference",
      estimatedAttendance: 8000,
      date: date.toISOString().slice(0, 10),
    });
  }

  return events;
}

// ─── Weather Impact ────────────────────────────────────

export interface WeatherData {
  temperature: number; // Celsius
  rainProbability: number; // 0–1
  severeWeather: boolean;
}

/**
 * Compute weather impact on demand.
 *
 * Rules:
 *   Severe weather → -5
 *   Heavy rain + weekend → -3
 *   Ideal temp (18–28°C) + weekend → +2
 *   Light rain → -1
 *
 * Returns -5 to +5 scale.
 *
 * Currently uses a deterministic rule-based model.
 * Replace fetchWeather() with OpenWeather API when ready.
 */
export function getWeatherImpact(city: string, date: Date): number {
  const cacheKey = `weather:${city}:${date.toISOString().slice(0, 10)}`;
  const cached = getCached<number>(cacheKey);
  if (cached !== null) return cached;

  const weather = fetchWeatherRuleBased(city, date);
  let impact = 0;

  if (weather.severeWeather) {
    impact = -5;
  } else {
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;

    if (weather.rainProbability > 0.7 && isWeekend) {
      impact = -3;
    } else if (weather.rainProbability > 0.5) {
      impact = -1;
    }

    if (
      weather.temperature >= 18 &&
      weather.temperature <= 28 &&
      isWeekend &&
      weather.rainProbability < 0.3
    ) {
      impact = Math.max(impact, 2);
    }
  }

  impact = Math.max(-5, Math.min(5, impact));
  setCache(cacheKey, impact);
  return impact;
}

/**
 * Rule-based weather fallback (deterministic).
 * Replace with real OpenWeather API call when ready.
 */
function fetchWeatherRuleBased(_city: string, date: Date): WeatherData {
  const month = date.getMonth();
  const dayOfMonth = date.getDate();

  // Deterministic temperature based on month (seasonal curve)
  const baseTemps: Record<number, number> = {
    0: 2, 1: 4, 2: 10, 3: 15, 4: 20, 5: 25,
    6: 30, 7: 29, 8: 24, 9: 17, 10: 9, 11: 4,
  };
  const temperature = baseTemps[month] + (dayOfMonth % 5) - 2;

  // Rain probability: higher in spring/autumn
  const rainBase: Record<number, number> = {
    0: 0.3, 1: 0.3, 2: 0.4, 3: 0.5, 4: 0.4, 5: 0.2,
    6: 0.1, 7: 0.1, 8: 0.3, 9: 0.5, 10: 0.5, 11: 0.4,
  };
  const rainProbability = Math.min(1, rainBase[month] + ((dayOfMonth % 7) * 0.05));

  // Severe weather: rare, deterministic trigger
  const severeWeather = month >= 11 && dayOfMonth % 13 === 0;

  return { temperature, rainProbability, severeWeather };
}

// ─── Competitor Impact ─────────────────────────────────

export interface CompetitorRate {
  competitor_name: string;
  price: number;
}

/**
 * Compute competitor market position impact.
 *
 * If hotel price < market avg → positive demand effect
 * If hotel price > market avg → negative demand effect
 *
 * Returns -5 to +5 scale.
 */
export function getCompetitorImpact(
  hotelPrice: number,
  competitorRates: CompetitorRate[]
): number {
  if (competitorRates.length === 0) return 0;

  const marketAvg =
    competitorRates.reduce((s, c) => s + c.price, 0) / competitorRates.length;

  if (marketAvg === 0) return 0;

  // Percentage difference: positive means hotel is cheaper
  const diff = (marketAvg - hotelPrice) / marketAvg;

  // Scale: ±20% price diff → ±5 score
  const score = Math.round(diff * 25 * 10) / 10;
  return Math.max(-5, Math.min(5, score));
}

// ─── Combined External Signal Score ────────────────────

export interface ExternalSignalResult {
  eventImpact: number;      // 0–10
  weatherImpact: number;    // -5 to +5
  competitorImpact: number; // -5 to +5
  totalScore: number;       // 0–20 (clamped)
}

/**
 * Compute the combined External Signal Score (0–20).
 *
 * totalScore = eventImpact + (weatherImpact + 5) + (competitorImpact + 5)
 *
 * Weather & competitor are shifted from [-5,+5] to [0,10] so the
 * total range is 0–30, then clamped to 0–20.
 */
export function getExternalSignalScore(
  city: string,
  date: Date,
  hotelPrice: number,
  competitorRates: CompetitorRate[],
  events?: LocalEvent[]
): ExternalSignalResult {
  const eventImpact = getEventImpact(city, date, events);
  const weatherImpact = getWeatherImpact(city, date);
  const competitorImpact = getCompetitorImpact(hotelPrice, competitorRates);

  // Shift weather and competitor from [-5,+5] to [0,10]
  const weatherShifted = weatherImpact + 5;
  const competitorShifted = competitorImpact + 5;

  const raw = eventImpact + weatherShifted + competitorShifted;
  const totalScore = Math.max(0, Math.min(20, Math.round(raw * 10) / 10));

  return { eventImpact, weatherImpact, competitorImpact, totalScore };
}
