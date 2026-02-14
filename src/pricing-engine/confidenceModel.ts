/**
 * Confidence Score Model
 * 
 * Calculates a dynamic Confidence Score (0–100%) per day based on:
 * - Data completeness: how far in the future (closer = more data = higher confidence)
 * - Event signal strength: known events boost confidence in demand direction
 * - Historical stability: stable base occupancy = higher confidence
 * - Trend consistency: consistent trend = higher confidence
 * 
 * No static values. All calculations are deterministic.
 */

export interface ConfidenceConfig {
  /** Base occupancy stability (0–1). Higher = more historically stable hotel. Default: 0.75 */
  historicalStability?: number;
  /** Maximum forecast horizon in days. Default: 30 */
  forecastHorizon?: number;
}

export interface ConfidenceResult {
  confidence: number;           // 0–100
  dataCompleteness: number;     // 0–1
  eventSignalStrength: number;  // 0–1
  historicalStability: number;  // 0–1
  trendConsistency: number;     // 0–1
}

/**
 * Calculate data completeness – decays with forecast distance.
 * Day 0 (today) = 1.0, Day 30 = ~0.5
 */
function calcDataCompleteness(dayOffset: number, horizon: number): number {
  // Exponential decay: closer days have much more reliable data
  return Math.exp(-1.0 * dayOffset / horizon);
}

/**
 * Calculate event signal strength.
 * If there's a known event, signal is strong (boosting or lowering doesn't matter,
 * the point is we KNOW something is happening).
 */
function calcEventSignalStrength(hasEvent: boolean, eventMultiplier: number): number {
  if (!hasEvent) {
    // No event = moderate signal (baseline behavior is predictable)
    return 0.60;
  }
  // Known event = high signal strength proportional to impact
  return Math.min(1.0, 0.70 + (eventMultiplier - 1.0) * 2.0);
}

/**
 * Calculate trend consistency from trend factor.
 * Trend factor near 1.0 = very consistent = high score.
 * Large deviations = less consistent.
 */
function calcTrendConsistency(trendFactor: number): number {
  const deviation = Math.abs(trendFactor - 1.0);
  // Small deviation = high consistency
  return Math.max(0.3, 1.0 - deviation * 5.0);
}

/**
 * Calculate the overall confidence score for a forecasted day.
 * 
 * Formula:
 *   confidence = weighted average of all four sub-scores
 *   Weights: dataCompleteness=0.35, eventSignal=0.20, stability=0.25, trend=0.20
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
  } = config;

  const dataCompleteness = calcDataCompleteness(dayOffset, forecastHorizon);
  const eventSignalStrength = calcEventSignalStrength(hasEvent, eventMultiplier);
  const trendConsistency = calcTrendConsistency(trendFactor);

  const weightedScore =
    dataCompleteness * 0.35 +
    eventSignalStrength * 0.20 +
    historicalStability * 0.25 +
    trendConsistency * 0.20;

  const confidence = Math.max(0, Math.min(100, Math.round(weightedScore * 100)));

  return {
    confidence,
    dataCompleteness: Math.round(dataCompleteness * 100) / 100,
    eventSignalStrength: Math.round(eventSignalStrength * 100) / 100,
    historicalStability,
    trendConsistency: Math.round(trendConsistency * 100) / 100,
  };
}
