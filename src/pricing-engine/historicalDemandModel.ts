/**
 * Historical Data-Driven Demand Model
 * 
 * Enhances the base demand model by computing:
 * - Historical average occupancy per weekday
 * - Rolling 7-day trend
 * - Rolling 30-day seasonality index
 * - Recent momentum (last 14 days)
 * - Occupancy volatility (std dev over last 30 days)
 * - Booking pace velocity per weekday
 * 
 * When historical data is available, demand scores are based on real data.
 * Falls back to rule-based model when no data exists.
 */

export interface HistoricalRecord {
  date: string;
  rooms_available: number;
  rooms_sold: number;
  average_daily_rate: number;
  cancellations: number;
}

export interface HistoricalDemandStats {
  hasData: boolean;
  totalRecords: number;
  avgOccupancy: number;
  weekdayAvgOccupancy: Record<number, number>; // 0=Sun..6=Sat
  rolling7DayTrend: number;    // multiplier
  rolling30DaySeasonality: number; // multiplier
  recentMomentum14Day: number; // multiplier
  avgADR: number;
  totalRevenue: number;
  /** Std deviation of occupancy over last 30 days (0–1 scale) */
  occupancyVolatility: number;
  /** Booking pace velocity per weekday (-1 to +1) */
  weekdayBookingPace: Record<number, number>;
  // Dynamic marketing metrics
  dataRangeStart: string;
  dataRangeEnd: string;
}

/**
 * Compute standard deviation of an array of numbers.
 */
function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Compute demand statistics from historical data.
 * All calculations are deterministic.
 */
export function computeHistoricalStats(records: HistoricalRecord[]): HistoricalDemandStats {
  if (!records || records.length === 0) {
    return {
      hasData: false,
      totalRecords: 0,
      avgOccupancy: 0,
      weekdayAvgOccupancy: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
      rolling7DayTrend: 1.0,
      rolling30DaySeasonality: 1.0,
      recentMomentum14Day: 1.0,
      avgADR: 0,
      totalRevenue: 0,
      occupancyVolatility: 0,
      weekdayBookingPace: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
      dataRangeStart: "",
      dataRangeEnd: "",
    };
  }

  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));

  // Overall average occupancy
  const occupancies = sorted.map(r =>
    r.rooms_available > 0 ? r.rooms_sold / r.rooms_available : 0
  );
  const avgOccupancy = occupancies.reduce((s, o) => s + o, 0) / occupancies.length;

  // Weekday averages
  const weekdayBuckets: number[][] = [[], [], [], [], [], [], []];
  for (const rec of sorted) {
    const dow = new Date(rec.date).getDay();
    const occ = rec.rooms_available > 0 ? rec.rooms_sold / rec.rooms_available : 0;
    weekdayBuckets[dow].push(occ);
  }
  const weekdayAvgOccupancy: Record<number, number> = {};
  for (let d = 0; d < 7; d++) {
    weekdayAvgOccupancy[d] = weekdayBuckets[d].length > 0
      ? weekdayBuckets[d].reduce((s, o) => s + o, 0) / weekdayBuckets[d].length
      : avgOccupancy;
  }

  // Rolling 7-day trend (last 7 vs previous 7)
  let rolling7DayTrend = 1.0;
  if (sorted.length >= 14) {
    const last7 = sorted.slice(-7);
    const prev7 = sorted.slice(-14, -7);
    const avgLast7 = last7.reduce((s, r) => s + (r.rooms_available > 0 ? r.rooms_sold / r.rooms_available : 0), 0) / 7;
    const avgPrev7 = prev7.reduce((s, r) => s + (r.rooms_available > 0 ? r.rooms_sold / r.rooms_available : 0), 0) / 7;
    rolling7DayTrend = avgPrev7 > 0 ? avgLast7 / avgPrev7 : 1.0;
    rolling7DayTrend = Math.max(0.8, Math.min(1.2, rolling7DayTrend));
  }

  // Rolling 30-day seasonality (last 30 vs overall)
  let rolling30DaySeasonality = 1.0;
  if (sorted.length >= 30) {
    const last30 = sorted.slice(-30);
    const avgLast30 = last30.reduce((s, r) => s + (r.rooms_available > 0 ? r.rooms_sold / r.rooms_available : 0), 0) / 30;
    rolling30DaySeasonality = avgOccupancy > 0 ? avgLast30 / avgOccupancy : 1.0;
    rolling30DaySeasonality = Math.max(0.7, Math.min(1.3, rolling30DaySeasonality));
  }

  // Recent momentum (last 14 days)
  let recentMomentum14Day = 1.0;
  if (sorted.length >= 14) {
    const last14 = sorted.slice(-14);
    const avgLast14 = last14.reduce((s, r) => s + (r.rooms_available > 0 ? r.rooms_sold / r.rooms_available : 0), 0) / 14;
    recentMomentum14Day = avgOccupancy > 0 ? avgLast14 / avgOccupancy : 1.0;
    recentMomentum14Day = Math.max(0.85, Math.min(1.15, recentMomentum14Day));
  }

  // Occupancy volatility (std dev of last 30 days, on 0–1 scale)
  const last30Occ = occupancies.slice(-30);
  const occupancyVolatility = Math.round(stdDev(last30Occ) * 1000) / 1000;

  // Booking pace velocity per weekday
  // Compare last 2 weeks' weekday occupancy vs previous 2 weeks
  const weekdayBookingPace: Record<number, number> = {};
  if (sorted.length >= 28) {
    const recent14 = sorted.slice(-14);
    const prev14 = sorted.slice(-28, -14);
    const recentBuckets: number[][] = [[], [], [], [], [], [], []];
    const prevBuckets: number[][] = [[], [], [], [], [], [], []];
    for (const r of recent14) {
      const dow = new Date(r.date).getDay();
      recentBuckets[dow].push(r.rooms_available > 0 ? r.rooms_sold / r.rooms_available : 0);
    }
    for (const r of prev14) {
      const dow = new Date(r.date).getDay();
      prevBuckets[dow].push(r.rooms_available > 0 ? r.rooms_sold / r.rooms_available : 0);
    }
    for (let d = 0; d < 7; d++) {
      const recentAvg = recentBuckets[d].length > 0
        ? recentBuckets[d].reduce((s, o) => s + o, 0) / recentBuckets[d].length : 0;
      const prevAvg = prevBuckets[d].length > 0
        ? prevBuckets[d].reduce((s, o) => s + o, 0) / prevBuckets[d].length : 0;
      // Velocity: difference normalized to -1..+1
      weekdayBookingPace[d] = prevAvg > 0
        ? Math.max(-1, Math.min(1, Math.round(((recentAvg - prevAvg) / prevAvg) * 100) / 100))
        : 0;
    }
  } else {
    for (let d = 0; d < 7; d++) weekdayBookingPace[d] = 0;
  }

  // ADR and revenue
  const avgADR = sorted.reduce((s, r) => s + r.average_daily_rate, 0) / sorted.length;
  const totalRevenue = sorted.reduce((s, r) => s + r.rooms_sold * r.average_daily_rate, 0);

  const dates = sorted.map(r => r.date);

  return {
    hasData: true,
    totalRecords: sorted.length,
    avgOccupancy: Math.round(avgOccupancy * 1000) / 1000,
    weekdayAvgOccupancy,
    rolling7DayTrend: Math.round(rolling7DayTrend * 1000) / 1000,
    rolling30DaySeasonality: Math.round(rolling30DaySeasonality * 1000) / 1000,
    recentMomentum14Day: Math.round(recentMomentum14Day * 1000) / 1000,
    avgADR: Math.round(avgADR * 100) / 100,
    totalRevenue: Math.round(totalRevenue),
    occupancyVolatility,
    weekdayBookingPace,
    dataRangeStart: dates[0],
    dataRangeEnd: dates[dates.length - 1],
  };
}

/**
 * Get historical data from localStorage (pilot mode).
 */
export function getStoredHistoricalData(): HistoricalRecord[] {
  try {
    const data = localStorage.getItem("qonaqai_historical_data");
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}
