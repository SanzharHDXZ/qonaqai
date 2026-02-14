/**
 * Price Elasticity Model
 * 
 * Models the relationship between price changes and occupancy changes.
 * 
 * Core formula:
 *   Occupancy Change (%) = ElasticityCoefficient × Price Change (%)
 * 
 * Default ElasticityCoefficient = -0.4
 * (A 10% price increase → 4% occupancy decrease)
 * 
 * All calculations are deterministic.
 */

export interface ElasticityConfig {
  /** Elasticity coefficient (negative = inverse relationship). Default: -0.4 */
  elasticityCoefficient?: number;
  /** Minimum occupancy floor (never below this). Default: 0.15 (15%) */
  occupancyFloor?: number;
  /** Maximum occupancy ceiling. Default: 0.98 (98%) */
  occupancyCeiling?: number;
}

export interface ElasticityResult {
  projectedOccupancy: number;    // 0–100 (percentage)
  occupancyChange: number;        // percentage points changed
  priceChangePercent: number;     // how much price deviated from recommended
  elasticityCoefficient: number;
}

/**
 * Calculate projected occupancy given a manual price vs the AI-recommended price.
 * 
 * @param baseOccupancy - The predicted occupancy at the recommended price (0–100)
 * @param recommendedPrice - The AI-recommended price
 * @param manualPrice - The price the user has set
 * @param config - Elasticity configuration
 */
export function calculateElasticity(
  baseOccupancy: number,
  recommendedPrice: number,
  manualPrice: number,
  config: ElasticityConfig = {}
): ElasticityResult {
  const {
    elasticityCoefficient = -0.4,
    occupancyFloor = 15,
    occupancyCeiling = 98,
  } = config;

  if (recommendedPrice === 0) {
    return {
      projectedOccupancy: baseOccupancy,
      occupancyChange: 0,
      priceChangePercent: 0,
      elasticityCoefficient,
    };
  }

  const priceChangePercent = ((manualPrice - recommendedPrice) / recommendedPrice) * 100;
  const occupancyChangePoints = elasticityCoefficient * priceChangePercent;
  const rawOccupancy = baseOccupancy + occupancyChangePoints;
  const projectedOccupancy = Math.max(
    occupancyFloor,
    Math.min(occupancyCeiling, Math.round(rawOccupancy))
  );

  return {
    projectedOccupancy,
    occupancyChange: Math.round(occupancyChangePoints * 10) / 10,
    priceChangePercent: Math.round(priceChangePercent * 10) / 10,
    elasticityCoefficient,
  };
}
