/**
 * Advanced Demand Forecasting Model
 * 
 * Calculates a Demand Score (0–100) using a weighted multi-factor model:
 * 
 *   Demand Score = w1 × Historical Weekday Avg
 *                + w2 × 7-Day Trend
 *                + w3 × 30-Day Seasonality Index
 *                + w4 × Event Strength Score
 *                + w5 × Booking Pace Velocity
 * 
 * All weights are configurable. All calculations deterministic.
 */

// ─── Configurable Factors ──────────────────────────────

/** Monthly seasonality multipliers (Jan=0 … Dec=11) */
export const SEASONALITY_FACTORS: Record<number, number> = {
  0: 0.75, 1: 0.80, 2: 0.88, 3: 0.95, 4: 1.05, 5: 1.15,
  6: 1.25, 7: 1.25, 8: 1.10, 9: 1.00, 10: 0.82, 11: 0.85,
};

/** Day-of-week multipliers (0=Sun … 6=Sat) */
export const WEEKDAY_FACTORS: Record<number, number> = {
  0: 0.90, 1: 0.78, 2: 0.80, 3: 0.85, 4: 0.92, 5: 1.15, 6: 1.12,
};

/** Event type impact multipliers */
export const EVENT_IMPACTS: Record<string, number> = {
  "conference": 1.18, "festival": 1.25, "sports": 1.15,
  "holiday": 1.12, "trade_fair": 1.20, "concert": 1.10, "none": 1.00,
};

export interface EventData {
  dayOffset: number;
  type: keyof typeof EVENT_IMPACTS;
  name: string;
}

/** Known events calendar (deterministic) */
export const SCHEDULED_EVENTS: EventData[] = [
  { dayOffset: 3, type: "conference", name: "Tech Conference" },
  { dayOffset: 7, type: "sports", name: "City Marathon" },
  { dayOffset: 14, type: "festival", name: "Music Festival" },
  { dayOffset: 15, type: "festival", name: "Music Festival" },
  { dayOffset: 21, type: "trade_fair", name: "Trade Fair" },
  { dayOffset: 22, type: "trade_fair", name: "Trade Fair" },
  { dayOffset: 25, type: "holiday", name: "National Holiday" },
];

// ─── Weighted Model Configuration ──────────────────────

export interface DemandWeights {
  /** Weight for historical weekday average. Default: 0.30 */
  weekdayAvg: number;
  /** Weight for 7-day trend. Default: 0.20 */
  trend7Day: number;
  /** Weight for 30-day seasonality. Default: 0.20 */
  seasonality30Day: number;
  /** Weight for event strength. Default: 0.15 */
  eventStrength: number;
  /** Weight for booking pace velocity. Default: 0.15 */
  bookingPace: number;
}

export const DEFAULT_DEMAND_WEIGHTS: DemandWeights = {
  weekdayAvg: 0.30,
  trend7Day: 0.20,
  seasonality30Day: 0.20,
  eventStrength: 0.15,
  bookingPace: 0.15,
};

export interface DemandModelConfig {
  baseOccupancy: number;       // 0–1 (e.g. 0.72 = 72%)
  trendMomentum?: number;      // multiplier, default 1.0
  weights?: Partial<DemandWeights>;
  /** Historical weekday avg occupancy (0–1) for this day of week, if available */
  historicalWeekdayAvg?: number;
  /** 7-day rolling trend multiplier from historical data */
  historicalTrend7Day?: number;
  /** 30-day seasonality index from historical data */
  historicalSeasonality30Day?: number;
  /** Booking pace velocity (-1 to +1 scale, 0 = normal pace) */
  bookingPaceVelocity?: number;
  /** External market signal score (0–20), added to the weighted model */
  externalSignalScore?: number;
}

export interface DemandResult {
  demandScore: number;         // 0–100
  seasonalityFactor: number;
  weekdayFactor: number;
  eventMultiplier: number;
  trendFactor: number;
  bookingPaceVelocity: number;
  externalSignalScore: number;
  event?: string;
  // Weighted component scores (0–100 each)
  components: {
    weekdayAvgScore: number;
    trendScore: number;
    seasonalityScore: number;
    eventScore: number;
    bookingPaceScore: number;
  };
  weights: DemandWeights;
}

/**
 * Calculate trend momentum based on a synthetic 14-day lookback.
 */
function calculateTrendMomentum(dayOffset: number): number {
  const trendCycle = Math.sin((dayOffset * Math.PI) / 30);
  return 1.0 + trendCycle * 0.06;
}

/**
 * Convert a multiplier (centered around 1.0) to a 0–100 score.
 * 1.0 maps to baseOccupancy*100, higher/lower scales proportionally.
 */
function multiplierToScore(multiplier: number, baseOccupancy: number): number {
  return Math.max(0, Math.min(100, Math.round(baseOccupancy * multiplier * 100)));
}

/**
 * Calculate Booking Pace Velocity.
 * 
 * Compares current booking rate vs historical same-lead-time.
 * Returns a value from -1 (decelerating) to +1 (accelerating).
 * In rule-based mode, derives from day offset and trend.
 */
function calculateBookingPaceVelocity(
  dayOffset: number,
  trendFactor: number,
  provided?: number
): number {
  if (provided !== undefined) return Math.max(-1, Math.min(1, provided));
  // Synthetic: closer days have more booking data, combine with trend
  const leadTimeFactor = Math.max(0, 1 - dayOffset / 30);
  const pace = (trendFactor - 1.0) * 3 * leadTimeFactor;
  return Math.max(-1, Math.min(1, Math.round(pace * 100) / 100));
}

/**
 * Calculate the Demand Score using the weighted multi-factor model.
 */
export function calculateDemandScore(
  date: Date,
  dayOffset: number,
  config: DemandModelConfig
): DemandResult {
  const month = date.getMonth();
  const dayOfWeek = date.getDay();
  const w: DemandWeights = { ...DEFAULT_DEMAND_WEIGHTS, ...config.weights };

  const seasonalityFactor = SEASONALITY_FACTORS[month];
  const weekdayFactor = WEEKDAY_FACTORS[dayOfWeek];

  const scheduledEvent = SCHEDULED_EVENTS.find(e => e.dayOffset === dayOffset);
  const eventType = scheduledEvent?.type ?? "none";
  const eventMultiplier = EVENT_IMPACTS[eventType];

  const trendFactor = config.trendMomentum ?? calculateTrendMomentum(dayOffset);

  // Booking pace velocity
  const bookingPaceVelocity = calculateBookingPaceVelocity(
    dayOffset, trendFactor, config.bookingPaceVelocity
  );

  // ─── Compute Component Scores (0–100) ───
  // 1. Historical weekday average
  const weekdayAvgOcc = config.historicalWeekdayAvg ?? (config.baseOccupancy * weekdayFactor);
  const weekdayAvgScore = Math.max(0, Math.min(100, Math.round(weekdayAvgOcc * 100)));

  // 2. 7-day trend score: trend multiplier → score centered on base occupancy
  const trend7Day = config.historicalTrend7Day ?? trendFactor;
  const trendScore = multiplierToScore(trend7Day, config.baseOccupancy);

  // 3. 30-day seasonality score
  const seasonality30Day = config.historicalSeasonality30Day ?? seasonalityFactor;
  const seasonalityScore = multiplierToScore(seasonality30Day, config.baseOccupancy);

  // 4. Event strength score (0 = no event, 100 = max impact event)
  const eventScore = Math.round(Math.min(100, (eventMultiplier - 1.0) * 400));

  // 5. Booking pace score: -1..+1 → 0..100
  const bookingPaceScore = Math.round(Math.max(0, Math.min(100, (bookingPaceVelocity + 1) * 50)));

  // ─── External Signal Score ───
  const externalSignalScore = config.externalSignalScore ?? 0;

  // ─── Weighted Demand Score ───
  // External signal adds 0–20 points directly on top of the weighted base
  const baseWeighted = 
    w.weekdayAvg * weekdayAvgScore +
    w.trend7Day * trendScore +
    w.seasonality30Day * seasonalityScore +
    w.eventStrength * eventScore +
    w.bookingPace * bookingPaceScore;

  // ─── Normalize around 50 to prevent upward bias ───
  // The weighted base naturally centers around baseOccupancy (e.g., 72%).
  // Without normalization, demand always reads "high" → constant premium pricing.
  // We re-center: 50 + (raw - historicalCenter) + external signals.
  const historicalCenter = config.baseOccupancy * 100; // e.g., 72
  const normalizedBase = 50 + (baseWeighted - historicalCenter);
  
  const demandScore = Math.max(0, Math.min(100, Math.round(normalizedBase + externalSignalScore)));

  // Debug logging for pricing diagnostics
  console.log("[DemandModel]", {
    date: date.toISOString().slice(0, 10),
    baseWeighted: Math.round(baseWeighted * 10) / 10,
    historicalCenter,
    normalizedBase: Math.round(normalizedBase * 10) / 10,
    externalSignalScore,
    finalDemandScore: demandScore,
  });

  return {
    demandScore,
    seasonalityFactor,
    weekdayFactor,
    eventMultiplier,
    trendFactor: Math.round(trendFactor * 1000) / 1000,
    bookingPaceVelocity,
    externalSignalScore,
    event: scheduledEvent?.name,
    components: {
      weekdayAvgScore,
      trendScore,
      seasonalityScore,
      eventScore,
      bookingPaceScore,
    },
    weights: w,
  };
}
