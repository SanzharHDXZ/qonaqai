/**
 * Revenue Simulation Engine
 * 
 * Calculates revenue projections for different pricing scenarios.
 * Uses the elasticity model to project occupancy changes.
 * 
 * All calculations are deterministic. No randomness.
 */

import { calculateElasticity, type ElasticityConfig } from "./elasticityModel";

export interface RevenueSimulationInput {
  totalRooms: number;
  predictedOccupancy: number;   // 0–100
  recommendedPrice: number;
  staticPrice: number;
  manualPrice: number;
  elasticityConfig?: ElasticityConfig;
}

export interface RevenueSimulationResult {
  // At AI-recommended price
  aiOccupancy: number;
  aiRoomsSold: number;
  aiRevenue: number;

  // At static (base) price
  staticOccupancy: number;
  staticRoomsSold: number;
  staticRevenue: number;

  // At manual price
  manualOccupancy: number;
  manualRoomsSold: number;
  manualRevenue: number;

  // Deltas
  revenueVsStatic: number;
  revenueVsAI: number;
  revenueLiftPercent: number;

  // Risk analysis
  underpricingLoss: number;   // revenue lost if pricing below AI recommendation
  overpricingLoss: number;    // revenue lost if pricing above optimal
}

/**
 * Run a full revenue simulation comparing AI price, static price, and manual price.
 */
export function simulateRevenue(input: RevenueSimulationInput): RevenueSimulationResult {
  const {
    totalRooms,
    predictedOccupancy,
    recommendedPrice,
    staticPrice,
    manualPrice,
    elasticityConfig,
  } = input;

  // AI-recommended scenario (baseline – occupancy is as predicted)
  const aiOccupancy = predictedOccupancy;
  const aiRoomsSold = Math.round((aiOccupancy / 100) * totalRooms);
  const aiRevenue = aiRoomsSold * recommendedPrice;

  // Static price scenario
  const staticElasticity = calculateElasticity(
    predictedOccupancy,
    recommendedPrice,
    staticPrice,
    elasticityConfig
  );
  const staticOccupancy = staticElasticity.projectedOccupancy;
  const staticRoomsSold = Math.round((staticOccupancy / 100) * totalRooms);
  const staticRevenue = staticRoomsSold * staticPrice;

  // Manual price scenario
  const manualElasticity = calculateElasticity(
    predictedOccupancy,
    recommendedPrice,
    manualPrice,
    elasticityConfig
  );
  const manualOccupancy = manualElasticity.projectedOccupancy;
  const manualRoomsSold = Math.round((manualOccupancy / 100) * totalRooms);
  const manualRevenue = manualRoomsSold * manualPrice;

  // Revenue deltas
  const revenueVsStatic = aiRevenue - staticRevenue;
  const revenueVsAI = manualRevenue - aiRevenue;
  const revenueLiftPercent = staticRevenue > 0
    ? Math.round(((aiRevenue - staticRevenue) / staticRevenue) * 1000) / 10
    : 0;

  // Risk analysis
  const underpricingLoss = manualPrice < recommendedPrice
    ? aiRevenue - manualRevenue
    : 0;
  const overpricingLoss = manualPrice > recommendedPrice
    ? aiRevenue - manualRevenue
    : 0;

  return {
    aiOccupancy,
    aiRoomsSold,
    aiRevenue,
    staticOccupancy,
    staticRoomsSold,
    staticRevenue,
    manualOccupancy,
    manualRoomsSold,
    manualRevenue,
    revenueVsStatic,
    revenueVsAI,
    revenueLiftPercent,
    underpricingLoss: Math.max(0, underpricingLoss),
    overpricingLoss: Math.max(0, overpricingLoss),
  };
}
