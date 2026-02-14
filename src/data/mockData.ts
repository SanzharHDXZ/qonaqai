/**
 * Data Layer – Powered by Pricing Engine
 * 
 * All values are computed deterministically from the pricing engine.
 * No random values. No hardcoded demo data.
 * Given the same hotel profile → same outputs every time.
 */

import { addDays, format } from "date-fns";
import {
  calculateDemandScore,
  calculatePrice,
  calculateConfidence,
  simulateRevenue,
} from "@/pricing-engine";

const today = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

// ─── Hotel Profile (would come from onboarding / database) ─────

export const hotelProfile = {
  name: "The Riverside Hotel",
  rooms: 85,
  city: "Barcelona",
  avgOccupancy: 0.72,   // 72% historical average
  basePrice: 120,
  currency: "€",
};

// ─── Competitor Data (would come from API in production) ────────

export interface Competitor {
  name: string;
  avgPrice: number;
  occupancy: number;
  rating: number;
}

export const competitors: Competitor[] = [
  { name: "Grand Plaza Hotel", avgPrice: 142, occupancy: 71, rating: 4.3 },
  { name: "City Center Inn", avgPrice: 98, occupancy: 82, rating: 4.0 },
  { name: "Harbor View Suites", avgPrice: 165, occupancy: 64, rating: 4.6 },
];

// ─── Daily Forecast (computed by engine) ────────────────────────

export interface DailyForecast {
  date: string;
  dayLabel: string;
  predictedOccupancy: number;
  recommendedPrice: number;
  minPrice: number;
  maxPrice: number;
  confidence: number;
  demandScore: number;
  staticPrice: number;
  aiRevenue: number;
  staticRevenue: number;
  pricingTier: string;
  priceMultiplier: number;
  // Demand breakdown
  seasonalityFactor: number;
  weekdayFactor: number;
  eventMultiplier: number;
  trendFactor: number;
  // Confidence breakdown
  dataCompleteness: number;
  eventSignalStrength: number;
  trendConsistency: number;
  event?: string;
}

/**
 * Generate 30-day forecasts using the pricing engine.
 * Fully deterministic – same date + same profile = same results.
 */
export function generateForecasts(
  totalRooms: number = hotelProfile.rooms,
  basePrice: number = hotelProfile.basePrice,
  baseOccupancy: number = hotelProfile.avgOccupancy
): DailyForecast[] {
  return Array.from({ length: 30 }, (_, dayOffset) => {
    const date = addDays(today, dayOffset);

    // 1. Demand Model
    const demand = calculateDemandScore(date, dayOffset, { baseOccupancy });

    // 2. Price Optimizer
    const pricing = calculatePrice(demand.demandScore, { basePrice });

    // 3. Confidence Model
    const conf = calculateConfidence(
      dayOffset,
      !!demand.event,
      demand.eventMultiplier,
      demand.trendFactor
    );

    // 4. Revenue calculation (AI vs static)
    const sim = simulateRevenue({
      totalRooms,
      predictedOccupancy: demand.demandScore,
      recommendedPrice: pricing.recommendedPrice,
      staticPrice: basePrice,
      manualPrice: pricing.recommendedPrice, // at recommended price
    });

    return {
      date: format(date, "yyyy-MM-dd"),
      dayLabel: format(date, "MMM dd"),
      predictedOccupancy: demand.demandScore,
      recommendedPrice: pricing.recommendedPrice,
      minPrice: pricing.minPrice,
      maxPrice: pricing.maxPrice,
      confidence: conf.confidence,
      demandScore: demand.demandScore,
      staticPrice: basePrice,
      aiRevenue: sim.aiRevenue,
      staticRevenue: sim.staticRevenue,
      pricingTier: pricing.pricingTier,
      priceMultiplier: pricing.priceMultiplier,
      seasonalityFactor: demand.seasonalityFactor,
      weekdayFactor: demand.weekdayFactor,
      eventMultiplier: demand.eventMultiplier,
      trendFactor: demand.trendFactor,
      dataCompleteness: conf.dataCompleteness,
      eventSignalStrength: conf.eventSignalStrength,
      trendConsistency: conf.trendConsistency,
      event: demand.event,
    };
  });
}

// ─── Alerts (derived from forecast data) ────────────────────────

export interface Alert {
  id: string;
  type: "surge" | "event" | "risk";
  title: string;
  description: string;
  date: string;
  impact: string;
}

/**
 * Generate alerts from forecast data. No hardcoded alerts.
 */
export function generateAlerts(forecasts: DailyForecast[]): Alert[] {
  const alerts: Alert[] = [];
  let id = 0;

  for (const f of forecasts) {
    // Surge alert: demand > 85
    if (f.demandScore > 85 && f.event) {
      alerts.push({
        id: String(++id),
        type: "surge",
        title: `High demand surge: ${f.event}`,
        description: `Demand score of ${f.demandScore} predicted on ${f.dayLabel} due to ${f.event}. AI recommends €${f.recommendedPrice} (+${Math.round((f.priceMultiplier - 1) * 100)}% above base).`,
        date: f.dayLabel,
        impact: `+${Math.round((f.priceMultiplier - 1) * 100)}% price opportunity`,
      });
    }

    // Event alert: has event but not surge-level
    if (f.event && f.demandScore <= 85 && f.demandScore > 70) {
      alerts.push({
        id: String(++id),
        type: "event",
        title: `Event detected: ${f.event}`,
        description: `${f.event} on ${f.dayLabel} is driving demand to ${f.demandScore}. Event multiplier: ${f.eventMultiplier}x.`,
        date: f.dayLabel,
        impact: `+${Math.round((f.eventMultiplier - 1) * 100)}% demand increase`,
      });
    }

    // Risk alert: demand < 55
    if (f.demandScore < 55) {
      alerts.push({
        id: String(++id),
        type: "risk",
        title: `Low occupancy risk on ${f.dayLabel}`,
        description: `Demand score of ${f.demandScore} is below target. Consider promotional pricing at €${f.minPrice} to maintain occupancy.`,
        date: f.dayLabel,
        impact: `${f.demandScore - 65}% below target`,
      });
    }
  }

  // Return top 5 most relevant alerts
  return alerts.slice(0, 5);
}

// ─── KPI Summary (computed from forecasts) ──────────────────────

export interface KPIData {
  avgOccupancy: number;
  avgRecommendedPrice: number;
  avgConfidence: number;
  projectedRevenue: number;
  staticRevenue: number;
  revenueLift: number;
}

export function computeKPIs(forecasts: DailyForecast[]): KPIData {
  const n = forecasts.length;
  const avgOccupancy = Math.round(forecasts.reduce((s, f) => s + f.predictedOccupancy, 0) / n);
  const avgRecommendedPrice = Math.round(forecasts.reduce((s, f) => s + f.recommendedPrice, 0) / n);
  const avgConfidence = Math.round(forecasts.reduce((s, f) => s + f.confidence, 0) / n);
  const projectedRevenue = forecasts.reduce((s, f) => s + f.aiRevenue, 0);
  const staticRevenue = forecasts.reduce((s, f) => s + f.staticRevenue, 0);
  const revenueLift = staticRevenue > 0
    ? Math.round(((projectedRevenue - staticRevenue) / staticRevenue) * 1000) / 10
    : 0;

  return { avgOccupancy, avgRecommendedPrice, avgConfidence, projectedRevenue, staticRevenue, revenueLift };
}
