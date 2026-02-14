/**
 * Backtesting Engine
 * 
 * Simulates what RevPilot would have recommended for historical dates,
 * then compares to actual revenue to measure potential uplift.
 * 
 * All calculations are deterministic. No randomness.
 */

import { calculateDemandScore, type DemandModelConfig } from "./demandModel";
import { calculatePrice, type PricingConfig } from "./priceOptimizer";
import { calculateConfidence } from "./confidenceModel";

export interface HistoricalRecord {
  date: string;
  rooms_available: number;
  rooms_sold: number;
  average_daily_rate: number;
  cancellations: number;
}

export interface BacktestDayResult {
  date: string;
  // Actual
  actualOccupancy: number;
  actualADR: number;
  actualRevenue: number;
  actualRoomsSold: number;
  // RevPilot recommendation
  aiDemandScore: number;
  aiRecommendedPrice: number;
  aiProjectedOccupancy: number;
  aiProjectedRevenue: number;
  aiConfidence: number;
  aiPricingTier: string;
  // Comparison
  revenueDifference: number;
  isWin: boolean;
  // Demand breakdown
  seasonalityFactor: number;
  weekdayFactor: number;
  eventMultiplier: number;
  trendFactor: number;
}

export interface BacktestSummary {
  totalDays: number;
  winDays: number;
  lossDays: number;
  actualTotalRevenue: number;
  aiTotalRevenue: number;
  revenueDifference: number;
  revenueUpliftPercent: number;
  meanAbsoluteError: number; // MAE of demand score vs actual occupancy
  avgConfidence: number;
  dailyResults: BacktestDayResult[];
}

/**
 * Run a backtest over historical data.
 * For each day, compute what RevPilot would have recommended,
 * then compare to actual performance.
 */
export function runBacktest(
  records: HistoricalRecord[],
  config: {
    baseOccupancy: number;
    basePrice: number;
    totalRooms: number;
  }
): BacktestSummary {
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
  
  // Compute historical averages per weekday for enhanced demand model
  const weekdayOccupancies: number[][] = [[], [], [], [], [], [], []];
  for (const rec of sorted) {
    const dow = new Date(rec.date).getDay();
    const occ = rec.rooms_available > 0 ? rec.rooms_sold / rec.rooms_available : 0;
    weekdayOccupancies[dow].push(occ);
  }
  
  // Calculate rolling trends
  const dailyResults: BacktestDayResult[] = [];
  let totalAbsError = 0;

  for (let i = 0; i < sorted.length; i++) {
    const rec = sorted[i];
    const date = new Date(rec.date);
    
    // Calculate trend momentum from recent historical data (last 14 days)
    const recentStart = Math.max(0, i - 14);
    const recentRecords = sorted.slice(recentStart, i);
    let trendMomentum = 1.0;
    if (recentRecords.length >= 3) {
      const recentAvgOcc = recentRecords.reduce((s, r) => 
        s + (r.rooms_available > 0 ? r.rooms_sold / r.rooms_available : 0), 0) / recentRecords.length;
      trendMomentum = recentAvgOcc / config.baseOccupancy;
      trendMomentum = Math.max(0.85, Math.min(1.15, trendMomentum));
    }

    // Use demand model
    const demandConfig: DemandModelConfig = {
      baseOccupancy: config.baseOccupancy,
      trendMomentum,
    };
    const demand = calculateDemandScore(date, 0, demandConfig);

    // Price optimization
    const pricingConfig: PricingConfig = { basePrice: config.basePrice };
    const pricing = calculatePrice(demand.demandScore, pricingConfig);

    // Confidence
    const confidence = calculateConfidence(
      0, !!demand.event, demand.eventMultiplier, demand.trendFactor
    );

    // Actual values
    const actualOccupancy = rec.rooms_available > 0 
      ? Math.round((rec.rooms_sold / rec.rooms_available) * 100)
      : 0;
    const actualRevenue = rec.rooms_sold * rec.average_daily_rate;

    // AI projected revenue (using actual rooms available for fair comparison)
    const aiProjectedOccupancy = demand.demandScore;
    const aiRoomsSold = Math.round((aiProjectedOccupancy / 100) * rec.rooms_available);
    const aiProjectedRevenue = aiRoomsSold * pricing.recommendedPrice;

    const revenueDifference = aiProjectedRevenue - actualRevenue;
    const absError = Math.abs(demand.demandScore - actualOccupancy);
    totalAbsError += absError;

    dailyResults.push({
      date: rec.date,
      actualOccupancy,
      actualADR: rec.average_daily_rate,
      actualRevenue,
      actualRoomsSold: rec.rooms_sold,
      aiDemandScore: demand.demandScore,
      aiRecommendedPrice: pricing.recommendedPrice,
      aiProjectedOccupancy,
      aiProjectedRevenue,
      aiConfidence: confidence.confidence,
      aiPricingTier: pricing.pricingTier,
      revenueDifference,
      isWin: revenueDifference > 0,
      seasonalityFactor: demand.seasonalityFactor,
      weekdayFactor: demand.weekdayFactor,
      eventMultiplier: demand.eventMultiplier,
      trendFactor: demand.trendFactor,
    });
  }

  const actualTotalRevenue = dailyResults.reduce((s, d) => s + d.actualRevenue, 0);
  const aiTotalRevenue = dailyResults.reduce((s, d) => s + d.aiProjectedRevenue, 0);
  const revenueDifference = aiTotalRevenue - actualTotalRevenue;
  const revenueUpliftPercent = actualTotalRevenue > 0
    ? Math.round((revenueDifference / actualTotalRevenue) * 1000) / 10
    : 0;

  return {
    totalDays: dailyResults.length,
    winDays: dailyResults.filter((d) => d.isWin).length,
    lossDays: dailyResults.filter((d) => !d.isWin).length,
    actualTotalRevenue,
    aiTotalRevenue,
    revenueDifference,
    revenueUpliftPercent,
    meanAbsoluteError: dailyResults.length > 0 ? Math.round(totalAbsError / dailyResults.length * 10) / 10 : 0,
    avgConfidence: dailyResults.length > 0 
      ? Math.round(dailyResults.reduce((s, d) => s + d.aiConfidence, 0) / dailyResults.length)
      : 0,
    dailyResults,
  };
}
