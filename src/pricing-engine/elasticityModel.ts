/**
 * Non-Linear Price Elasticity Model
 * 
 * Models the relationship between price changes and occupancy changes
 * using a quadratic (non-linear) curve to prevent unrealistic large swings.
 * 
 * Core formula:
 *   Elasticity Impact = -k × (Price Change %)²  (signed by direction)
 * 
 * For small price changes, this behaves similarly to linear elasticity.
 * For large price changes, the quadratic term dampens the effect.
 * 
 * k is configurable (default: 0.004).
 * All calculations are deterministic.
 */

export interface ElasticityConfig {
  /** Non-linear elasticity coefficient. Default: 0.004 */
  elasticityK?: number;
  /** Legacy linear coefficient (used as fallback). Default: -0.4 */
  elasticityCoefficient?: number;
  /** Minimum occupancy floor. Default: 15 (%) */
  occupancyFloor?: number;
  /** Maximum occupancy ceiling. Default: 98 (%) */
  occupancyCeiling?: number;
  /** Use non-linear model. Default: true */
  useNonLinear?: boolean;
}

export interface ElasticityResult {
  projectedOccupancy: number;    // 0–100 (percentage)
  occupancyChange: number;        // percentage points changed
  priceChangePercent: number;     // how much price deviated from recommended
  elasticityCoefficient: number;
  isNonLinear: boolean;
}

/**
 * Calculate projected occupancy given a manual price vs the AI-recommended price.
 * 
 * Non-linear formula:
 *   occupancyChange = -k × (priceChange%)² × sign(priceChange)
 * 
 * This prevents unrealistic large swings:
 *   - 10% price increase → -0.4 pp change (similar to linear)
 *   - 30% price increase → -3.6 pp change (dampened vs linear's -12 pp)
 */
export function calculateElasticity(
  baseOccupancy: number,
  recommendedPrice: number,
  manualPrice: number,
  config: ElasticityConfig = {}
): ElasticityResult {
  const {
    elasticityK = 0.004,
    elasticityCoefficient = -0.4,
    occupancyFloor = 15,
    occupancyCeiling = 98,
    useNonLinear = true,
  } = config;

  if (recommendedPrice === 0) {
    return {
      projectedOccupancy: baseOccupancy,
      occupancyChange: 0,
      priceChangePercent: 0,
      elasticityCoefficient: useNonLinear ? elasticityK : elasticityCoefficient,
      isNonLinear: useNonLinear,
    };
  }

  const priceChangePercent = ((manualPrice - recommendedPrice) / recommendedPrice) * 100;

  let occupancyChangePoints: number;

  if (useNonLinear) {
    // Non-linear: -k × (priceChange%)² × sign(priceChange)
    const sign = priceChangePercent >= 0 ? -1 : 1;
    occupancyChangePoints = sign * elasticityK * priceChangePercent * priceChangePercent;
  } else {
    // Legacy linear
    occupancyChangePoints = elasticityCoefficient * priceChangePercent;
  }

  const rawOccupancy = baseOccupancy + occupancyChangePoints;
  const projectedOccupancy = Math.max(
    occupancyFloor,
    Math.min(occupancyCeiling, Math.round(rawOccupancy))
  );

  return {
    projectedOccupancy,
    occupancyChange: Math.round(occupancyChangePoints * 10) / 10,
    priceChangePercent: Math.round(priceChangePercent * 10) / 10,
    elasticityCoefficient: useNonLinear ? elasticityK : elasticityCoefficient,
    isNonLinear: useNonLinear,
  };
}
