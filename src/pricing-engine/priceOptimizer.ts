/**
 * Price Optimization Engine
 * 
 * Converts a Demand Score (0–100) into a recommended price
 * using rule-based pricing tiers with proportional scaling.
 * 
 * Pricing Rules:
 *   Demand < 50  → Decrease base price by 10–20%
 *   Demand 50–70 → Keep near base (±5%)
 *   Demand 70–85 → Increase 10–25%
 *   Demand > 85  → Surge pricing 30–50%
 * 
 * Price adjustments scale proportionally within each tier.
 * 
 * Also calculates min safe price and max demand price.
 */

export interface PriceRecommendation {
  recommendedPrice: number;
  minPrice: number;
  maxPrice: number;
  priceMultiplier: number;
  pricingTier: "discount" | "base" | "premium" | "surge";
}

export interface PricingConfig {
  basePrice: number;
  /** Floor multiplier – never go below this × basePrice */
  floorMultiplier?: number;  // default 0.70
  /** Ceiling multiplier – never exceed this × basePrice */
  ceilingMultiplier?: number; // default 1.60
  /** Min price spread below recommended (%) */
  minSpread?: number;  // default 0.15
  /** Max price spread above recommended (%) */
  maxSpread?: number;  // default 0.20
}

/**
 * Calculate the price multiplier based on demand score.
 * Uses linear interpolation within each tier for smooth scaling.
 */
function demandToMultiplier(demandScore: number): { multiplier: number; tier: PriceRecommendation["pricingTier"] } {
  if (demandScore < 50) {
    // 0→0.80, 49→0.90 (20% to 10% discount)
    const t = demandScore / 50;
    const multiplier = 0.80 + t * 0.10;
    return { multiplier, tier: "discount" };
  }

  if (demandScore <= 70) {
    // 50→0.95, 70→1.05 (±5% around base)
    const t = (demandScore - 50) / 20;
    const multiplier = 0.95 + t * 0.10;
    return { multiplier, tier: "base" };
  }

  if (demandScore <= 85) {
    // 70→1.10, 85→1.25 (10–25% increase)
    const t = (demandScore - 70) / 15;
    const multiplier = 1.10 + t * 0.15;
    return { multiplier, tier: "premium" };
  }

  // 85→1.30, 100→1.50 (30–50% surge)
  const t = Math.min((demandScore - 85) / 15, 1);
  const multiplier = 1.30 + t * 0.20;
  return { multiplier, tier: "surge" };
}

/**
 * Calculate the recommended price and safe range for a given demand score.
 */
export function calculatePrice(
  demandScore: number,
  config: PricingConfig
): PriceRecommendation {
  const {
    basePrice,
    floorMultiplier = 0.70,
    ceilingMultiplier = 1.60,
    minSpread = 0.15,
    maxSpread = 0.20,
  } = config;

  const { multiplier, tier } = demandToMultiplier(demandScore);

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
  };
}
