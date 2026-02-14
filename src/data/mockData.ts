/**
 * Data Layer – Powered by Advanced Pricing Engine
 * 
 * All values are computed deterministically from the pricing engine.
 * Uses weighted demand model, non-linear elasticity, and saturation cap.
 */

import { addDays, format } from "date-fns";
import {
  calculateDemandScore,
  calculatePrice,
  calculateConfidence,
  simulateRevenue,
  getExternalSignalScore,
} from "@/pricing-engine";
import type { CompetitorRate, WeatherData, LocalEvent } from "@/pricing-engine";

const today = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

// ─── Hotel Profile (fallback only for unauthenticated/demo) ─

export const hotelProfile = {
  name: "Demo Hotel",
  rooms: 85,
  city: "",
  avgOccupancy: 0.72,
  basePrice: 120,
  currency: "€",
};

// ─── Competitor Data (kept for type compatibility) ─────

export interface Competitor {
  name: string;
  avgPrice: number;
  occupancy: number;
  rating: number;
}

export const competitors: Competitor[] = [];

// ─── Daily Forecast ────────────────────────────────────

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
  isSaturated: boolean;
  saturationBoost: number;
  seasonalityFactor: number;
  weekdayFactor: number;
  eventMultiplier: number;
  trendFactor: number;
  bookingPaceVelocity: number;
  externalSignalScore: number;
  externalEventImpact: number;
  externalWeatherImpact: number;
  externalCompetitorImpact: number;
  weatherAvailable: boolean;
  eventsAvailable: boolean;
  demandComponents: {
    weekdayAvgScore: number;
    trendScore: number;
    seasonalityScore: number;
    eventScore: number;
    bookingPaceScore: number;
  };
  dataCompleteness: number;
  eventSignalStrength: number;
  trendConsistency: number;
  dataVolumeScore: number;
  volatilityScore: number;
  event?: string;
}

/**
 * Generate 30-day forecasts using the advanced pricing engine.
 * Now accepts pre-fetched weather and event data (real API data).
 */
export function generateForecasts(
  totalRooms: number = hotelProfile.rooms,
  basePrice: number = hotelProfile.basePrice,
  baseOccupancy: number = hotelProfile.avgOccupancy,
  histStats?: { 
    dataPointCount?: number; 
    occupancyVolatility?: number;
    weekdayAvgOccupancy?: Record<number, number>;
    rolling7DayTrend?: number;
    rolling30DaySeasonality?: number;
    weekdayBookingPace?: Record<number, number>;
  },
  city: string = "",
  competitorRates: CompetitorRate[] = [],
  weatherData: WeatherData[] = [],
  events: LocalEvent[] = []
): DailyForecast[] {
  return Array.from({ length: 30 }, (_, dayOffset) => {
    const date = addDays(today, dayOffset);
    const dow = date.getDay();

    // External market signals (using pre-fetched real data)
    const externalSignals = getExternalSignalScore(date, basePrice, competitorRates, weatherData, events);

    // 1. Demand Model (weighted) with external signal
    const demand = calculateDemandScore(date, dayOffset, {
      baseOccupancy,
      historicalWeekdayAvg: histStats?.weekdayAvgOccupancy?.[dow],
      historicalTrend7Day: histStats?.rolling7DayTrend,
      historicalSeasonality30Day: histStats?.rolling30DaySeasonality,
      bookingPaceVelocity: histStats?.weekdayBookingPace?.[dow],
      externalSignalScore: externalSignals.totalScore,
    });

    // 2. Price Optimizer (with saturation cap)
    const pricing = calculatePrice(demand.demandScore, {
      basePrice,
      projectedOccupancy: demand.demandScore,
    });

    // 3. Confidence Model (with data volume & volatility)
    const conf = calculateConfidence(
      dayOffset,
      !!demand.event,
      demand.eventMultiplier,
      demand.trendFactor,
      {
        dataPointCount: histStats?.dataPointCount ?? 0,
        occupancyVolatility: histStats?.occupancyVolatility,
      }
    );

    // 4. Revenue simulation
    const sim = simulateRevenue({
      totalRooms,
      predictedOccupancy: demand.demandScore,
      recommendedPrice: pricing.recommendedPrice,
      staticPrice: basePrice,
      manualPrice: pricing.recommendedPrice,
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
      isSaturated: pricing.isSaturated,
      saturationBoost: pricing.saturationBoost,
      seasonalityFactor: demand.seasonalityFactor,
      weekdayFactor: demand.weekdayFactor,
      eventMultiplier: demand.eventMultiplier,
      trendFactor: demand.trendFactor,
      bookingPaceVelocity: demand.bookingPaceVelocity,
      externalSignalScore: externalSignals.totalScore,
      externalEventImpact: externalSignals.eventImpact,
      externalWeatherImpact: externalSignals.weatherImpact,
      externalCompetitorImpact: externalSignals.competitorImpact,
      weatherAvailable: externalSignals.weatherAvailable,
      eventsAvailable: externalSignals.eventsAvailable,
      demandComponents: demand.components,
      dataCompleteness: conf.dataCompleteness,
      eventSignalStrength: conf.eventSignalStrength,
      trendConsistency: conf.trendConsistency,
      dataVolumeScore: conf.dataVolumeScore,
      volatilityScore: conf.volatilityScore,
      event: demand.event,
    };
  });
}

// ─── Alerts ────────────────────────────────────────────

export interface Alert {
  id: string;
  type: "surge" | "event" | "risk";
  title: string;
  description: string;
  date: string;
  impact: string;
}

export function generateAlerts(forecasts: DailyForecast[]): Alert[] {
  const alerts: Alert[] = [];
  let id = 0;

  for (const f of forecasts) {
    if (f.isSaturated) {
      alerts.push({
        id: String(++id),
        type: "surge",
        title: `Demand saturation: profit-maximizing mode`,
        description: `Occupancy at ${f.demandScore}% on ${f.dayLabel}. Switched to profit-maximizing pricing at €${f.recommendedPrice} (+${Math.round(f.saturationBoost * 100)}% saturation boost).`,
        date: f.dayLabel,
        impact: `Saturation mode active`,
      });
    } else if (f.demandScore > 85 && f.event) {
      alerts.push({
        id: String(++id),
        type: "surge",
        title: `High demand surge: ${f.event}`,
        description: `Demand score of ${f.demandScore} predicted on ${f.dayLabel} due to ${f.event}. AI recommends €${f.recommendedPrice} (+${Math.round((f.priceMultiplier - 1) * 100)}% above base).`,
        date: f.dayLabel,
        impact: `+${Math.round((f.priceMultiplier - 1) * 100)}% price opportunity`,
      });
    }

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

    if (f.demandScore < 55) {
      alerts.push({
        id: String(++id),
        type: "risk",
        title: `Low occupancy risk on ${f.dayLabel}`,
        description: `Demand score of ${f.demandScore} is below target. Consider promotional pricing at €${f.minPrice}.`,
        date: f.dayLabel,
        impact: `${f.demandScore - 65}% below target`,
      });
    }
  }

  return alerts.slice(0, 5);
}

// ─── KPI Summary ───────────────────────────────────────

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
