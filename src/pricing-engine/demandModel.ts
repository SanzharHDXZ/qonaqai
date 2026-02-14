/**
 * Demand Forecasting Model
 * 
 * Calculates a Demand Score (0–100) for each day based on:
 * - Base occupancy rate (from hotel profile)
 * - Seasonality factor (month-based)
 * - Day-of-week factor
 * - Event impact multiplier
 * - Trend momentum (14-day rolling direction)
 * 
 * All factors are deterministic and configurable.
 * No randomness. Same inputs → same outputs.
 */

// ─── Configurable Factors ──────────────────────────────

/** Monthly seasonality multipliers (Jan=0 … Dec=11) */
export const SEASONALITY_FACTORS: Record<number, number> = {
  0: 0.75,  // Jan – low season
  1: 0.80,  // Feb
  2: 0.88,  // Mar – spring pickup
  3: 0.95,  // Apr
  4: 1.05,  // May
  5: 1.15,  // Jun – high season begins
  6: 1.25,  // Jul – peak
  7: 1.25,  // Aug – peak
  8: 1.10,  // Sep
  9: 1.00,  // Oct
  10: 0.82, // Nov
  11: 0.85, // Dec – holiday bump
};

/** Day-of-week multipliers (0=Sun … 6=Sat) */
export const WEEKDAY_FACTORS: Record<number, number> = {
  0: 0.90,  // Sunday – checkout day
  1: 0.78,  // Monday
  2: 0.80,  // Tuesday
  3: 0.85,  // Wednesday
  4: 0.92,  // Thursday – pre-weekend
  5: 1.15,  // Friday – weekend arrival
  6: 1.12,  // Saturday
};

/** Event type impact multipliers */
export const EVENT_IMPACTS: Record<string, number> = {
  "conference": 1.18,
  "festival": 1.25,
  "sports": 1.15,
  "holiday": 1.12,
  "trade_fair": 1.20,
  "concert": 1.10,
  "none": 1.00,
};

export interface EventData {
  dayOffset: number;
  type: keyof typeof EVENT_IMPACTS;
  name: string;
}

/** Known events calendar (deterministic, no randomness) */
export const SCHEDULED_EVENTS: EventData[] = [
  { dayOffset: 3, type: "conference", name: "Tech Conference" },
  { dayOffset: 7, type: "sports", name: "City Marathon" },
  { dayOffset: 14, type: "festival", name: "Music Festival" },
  { dayOffset: 15, type: "festival", name: "Music Festival" },
  { dayOffset: 21, type: "trade_fair", name: "Trade Fair" },
  { dayOffset: 22, type: "trade_fair", name: "Trade Fair" },
  { dayOffset: 25, type: "holiday", name: "National Holiday" },
];

export interface DemandModelConfig {
  baseOccupancy: number;       // 0–1 (e.g. 0.72 = 72%)
  trendMomentum?: number;      // multiplier, default 1.0 (>1 = upward trend)
}

export interface DemandResult {
  demandScore: number;         // 0–100
  seasonalityFactor: number;
  weekdayFactor: number;
  eventMultiplier: number;
  trendFactor: number;
  event?: string;
}

/**
 * Calculate trend momentum based on a synthetic 14-day lookback.
 * In production this would use real historical data.
 * For now, we derive it deterministically from the day offset
 * to simulate a realistic trend curve without randomness.
 */
function calculateTrendMomentum(dayOffset: number, baseOccupancy: number): number {
  // Simulate a mild upward trend for the first 10 days,
  // then stabilizing. This represents "recent booking momentum".
  // The formula creates a smooth S-curve of momentum.
  const trendCycle = Math.sin((dayOffset * Math.PI) / 30);
  const momentum = 1.0 + trendCycle * 0.06; // ±6% max trend effect
  return momentum;
}

/**
 * Calculate the Demand Score for a specific day.
 * 
 * Formula:
 *   rawDemand = baseOccupancy × seasonalityFactor × weekdayFactor × eventMultiplier × trendMomentum
 *   demandScore = clamp(rawDemand × 100, 0, 100)
 */
export function calculateDemandScore(
  date: Date,
  dayOffset: number,
  config: DemandModelConfig
): DemandResult {
  const month = date.getMonth();
  const dayOfWeek = date.getDay();

  const seasonalityFactor = SEASONALITY_FACTORS[month];
  const weekdayFactor = WEEKDAY_FACTORS[dayOfWeek];

  // Find event for this day
  const scheduledEvent = SCHEDULED_EVENTS.find(e => e.dayOffset === dayOffset);
  const eventType = scheduledEvent?.type ?? "none";
  const eventMultiplier = EVENT_IMPACTS[eventType];

  const trendFactor = config.trendMomentum ?? calculateTrendMomentum(dayOffset, config.baseOccupancy);

  const rawDemand = config.baseOccupancy * seasonalityFactor * weekdayFactor * eventMultiplier * trendFactor;
  const demandScore = Math.max(0, Math.min(100, Math.round(rawDemand * 100)));

  return {
    demandScore,
    seasonalityFactor,
    weekdayFactor,
    eventMultiplier,
    trendFactor: Math.round(trendFactor * 1000) / 1000,
    event: scheduledEvent?.name,
  };
}
