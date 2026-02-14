/**
 * Confidence Score Model with Data Volume & Volatility
 * 
 * Calculates a dynamic Confidence Score (0–100%) based on:
 * - Data completeness: forecast horizon decay
 * - Event signal strength
 * - Historical stability (from data volume)
 * - Trend consistency
 * - Data volume score: more historical days = higher confidence
 * - Volatility score: low occupancy std dev = higher confidence
 * 
 * All calculations are deterministic.
 */

export interface ConfidenceConfig {
  /** Base occupancy stability (0–1). Default: 0.75 */
  historicalStability?: number;
  /** Maximum forecast horizon in days. Default: 30 */
  forecastHorizon?: number;
  /** Number of historical data points available. Default: 0 */
  dataPointCount?: number;
  /** Minimum data points for full confidence. Default: 90 */
  minDataForFullConfidence?: number;
  /** Standard deviation of occupancy over last 30 days (0–1 scale). Default: undefined */
  occupancyVolatility?: number;
}

export interface ConfidenceResult {
  confidence: number;           // 0–100
  dataCompleteness: number;     // 0–1
  eventSignalStrength: number;  // 0–1
  historicalStability: number;  // 0–1
  trendConsistency: number;     // 0–1
  dataVolumeScore: number;      // 0–1
  volatilityScore: number;      // 0–1
}

function calcDataCompleteness(dayOffset: number, horizon: number): number {
  return Math.exp(-1.0 * dayOffset / horizon);
}

function calcEventSignalStrength(hasEvent: boolean, eventMultiplier: number): number {
  if (!hasEvent) return 0.60;
  return Math.min(1.0, 0.70 + (eventMultiplier - 1.0) * 2.0);
}

function calcTrendConsistency(trendFactor: number): number {
  const deviation = Math.abs(trendFactor - 1.0);
  return Math.max(0.3, 1.0 - deviation * 5.0);
}

/**
 * Calculate data volume confidence score.
 * More historical data points = higher confidence.
 * Logarithmic scaling: diminishing returns after minimum threshold.
 */
function calcDataVolumeScore(dataPoints: number, minForFull: number): number {
  if (dataPoints === 0) return 0.2; // minimal confidence with no data
  if (dataPoints >= minForFull) return 1.0;
  // Logarithmic curve: fast initial growth, then plateaus
  return Math.min(1.0, 0.2 + 0.8 * Math.log(1 + dataPoints) / Math.log(1 + minForFull));
}

/**
 * Calculate volatility score.
 * Low standard deviation of occupancy = consistent patterns = higher confidence.
 * High volatility = unpredictable = lower confidence.
 */
function calcVolatilityScore(volatility?: number): number {
  if (volatility === undefined) return 0.65; // neutral when no data
  // volatility is std dev on 0–1 scale. Typical range: 0.05 (stable) to 0.25 (volatile)
  // Map: 0 → 1.0, 0.10 → 0.75, 0.20 → 0.50, 0.30+ → 0.30
  return Math.max(0.30, 1.0 - volatility * 3.5);
}

/**
 * Calculate the overall confidence score.
 * 
 * Weights:
 *   dataCompleteness = 0.25
 *   eventSignal = 0.10
 *   stability = 0.15
 *   trend = 0.10
 *   dataVolume = 0.25
 *   volatility = 0.15
 */
export function calculateConfidence(
  dayOffset: number,
  hasEvent: boolean,
  eventMultiplier: number,
  trendFactor: number,
  config: ConfidenceConfig = {}
): ConfidenceResult {
  const {
    historicalStability = 0.75,
    forecastHorizon = 30,
    dataPointCount = 0,
    minDataForFullConfidence = 90,
    occupancyVolatility,
  } = config;

  const dataCompleteness = calcDataCompleteness(dayOffset, forecastHorizon);
  const eventSignalStrength = calcEventSignalStrength(hasEvent, eventMultiplier);
  const trendConsistency = calcTrendConsistency(trendFactor);
  const dataVolumeScore = calcDataVolumeScore(dataPointCount, minDataForFullConfidence);
  const volatilityScore = calcVolatilityScore(occupancyVolatility);

  const weightedScore =
    dataCompleteness * 0.25 +
    eventSignalStrength * 0.10 +
    historicalStability * 0.15 +
    trendConsistency * 0.10 +
    dataVolumeScore * 0.25 +
    volatilityScore * 0.15;

  const confidence = Math.max(0, Math.min(100, Math.round(weightedScore * 100)));

  return {
    confidence,
    dataCompleteness: Math.round(dataCompleteness * 100) / 100,
    eventSignalStrength: Math.round(eventSignalStrength * 100) / 100,
    historicalStability,
    trendConsistency: Math.round(trendConsistency * 100) / 100,
    dataVolumeScore: Math.round(dataVolumeScore * 100) / 100,
    volatilityScore: Math.round(volatilityScore * 100) / 100,
  };
}
