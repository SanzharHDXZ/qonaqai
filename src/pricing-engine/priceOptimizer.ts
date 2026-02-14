/**
 * Price Optimization Engine with Demand Saturation Cap
 * 
 * Converts a Demand Score (0–100) into a recommended price.
 * 
 * Pricing tiers with proportional scaling:
 *   Demand < 50  → Decrease base price by 10–20%
 *   Demand 50–70 → Keep near base (±5%)
 *   Demand 70–85 → Increase 10–25%
 *   Demand > 85  → Surge pricing 30–50%
 * 
 * DEMAND SATURATION CAP:
 *   When projected occupancy > 95%, switches to profit-maximizing mode.
 *   Instead of driving more occupancy, maximizes revenue per room.
 */

export interface PriceRecommendation {
  recommendedPrice: number;
  minPrice: number;
  maxPrice: number;
  priceMultiplier: number;
  pricingTier: "discount" | "base" | "premium" | "surge" | "saturation";
  isSaturated: boolean;
  saturationBoost: number; // additional multiplier from saturation mode
}

export interface PricingConfig {
  basePrice: number;
  /** Floor multiplier – never go below this × basePrice */
  floorMultiplier?: number;  // default 0.70
  /** Ceiling multiplier – never exceed this × basePrice */
  ceilingMultiplier?: number; // default 1.80 (raised for saturation)
  /** Min price spread below recommended (%) */
  minSpread?: number;  // default 0.15
  /** Max price spread above recommended (%) */
  maxSpread?: number;  // default 0.20
  /** Saturation threshold (projected occupancy %). Default: 95 */
  saturationThreshold?: number;
  /** Projected occupancy for saturation check (0–100) */
  projectedOccupancy?: number;
}

/**
 * Calculate the price multiplier based on demand score.
 */
function demandToMultiplier(demandScore: number): { multiplier: number; tier: PriceRecommendation["pricingTier"] } {
  if (demandScore < 50) {
    const t = demandScore / 50;
    return { multiplier: 0.80 + t * 0.10, tier: "discount" };
  }
  if (demandScore <= 70) {
    const t = (demandScore - 50) / 20;
    return { multiplier: 0.95 + t * 0.10, tier: "base" };
  }
  if (demandScore <= 85) {
    const t = (demandScore - 70) / 15;
    return { multiplier: 1.10 + t * 0.15, tier: "premium" };
  }
  const t = Math.min((demandScore - 85) / 15, 1);
  return { multiplier: 1.30 + t * 0.20, tier: "surge" };
}

/**
 * Calculate the recommended price and safe range for a given demand score.
 * Applies demand saturation cap when occupancy > threshold.
 */
export function calculatePrice(
  demandScore: number,
  config: PricingConfig
): PriceRecommendation {
  const {
    basePrice,
    floorMultiplier = 0.70,
    ceilingMultiplier = 1.80,
    minSpread = 0.15,
    maxSpread = 0.20,
    saturationThreshold = 95,
    projectedOccupancy,
  } = config;

  let { multiplier, tier } = demandToMultiplier(demandScore);

  // ─── Demand Saturation Cap ───
  // When projected occupancy > 95%, switch to profit-maximizing mode.
  // Instead of trying to fill more rooms, maximize revenue per room.
  let isSaturated = false;
  let saturationBoost = 0;

  if (projectedOccupancy !== undefined && projectedOccupancy > saturationThreshold) {
    isSaturated = true;
    tier = "saturation";
    // Boost price proportionally to how far above saturation threshold
    // e.g., at 98% occupancy with 95% threshold: (98-95)/5 = 0.6 → +12% boost
    const saturationExcess = (projectedOccupancy - saturationThreshold) / (100 - saturationThreshold);
    saturationBoost = saturationExcess * 0.20; // up to +20% additional
    multiplier = multiplier * (1 + saturationBoost);
  }

  const rawPrice = basePrice * multiplier;
  const floor = basePrice * floorMultiplier;
  const ceiling = basePrice * ceilingMultiplier;
  const recommendedPrice = Math.round(Math.max(floor, Math.min(ceiling, rawPrice)));

  const minPrice = Math.round(Math.max(floor, recommendedPrice * (1 - minSpread)));
  const maxPrice = Math.round(Math.min(ceiling, recommendedPrice * (1 + maxSpread)));

  return {
    recommendedPrice,
    minPrice,
    maxPrice,
    priceMultiplier: Math.round(multiplier * 1000) / 1000,
    pricingTier: tier,
    isSaturated,
    saturationBoost: Math.round(saturationBoost * 1000) / 1000,
  };
}
