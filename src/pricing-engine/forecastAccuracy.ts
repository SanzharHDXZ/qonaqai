/**
 * Forecast Accuracy Tracking
 * 
 * For each completed day, compares predicted occupancy vs actual occupancy.
 * 
 * Metrics:
 *   - MAE (Mean Absolute Error)
 *   - MAPE (Mean Absolute Percentage Error)
 *   - Rolling 30-day accuracy
 * 
 * All calculations are deterministic.
 */

export interface ForecastRecord {
  date: string;
  predictedOccupancy: number;  // 0–100
  actualOccupancy: number;     // 0–100
}

export interface ForecastAccuracyResult {
  mae: number;           // Mean Absolute Error (percentage points)
  mape: number;          // Mean Absolute Percentage Error (%)
  accuracy: number;      // 100 - MAPE (clamped 0–100)
  totalDays: number;
  rolling30: {
    mae: number;
    mape: number;
    accuracy: number;
    days: number;
  };
  dailyErrors: Array<{
    date: string;
    predicted: number;
    actual: number;
    absoluteError: number;
    percentageError: number;
  }>;
}

/**
 * Calculate forecast accuracy metrics from prediction-vs-actual records.
 */
export function calculateForecastAccuracy(records: ForecastRecord[]): ForecastAccuracyResult {
  if (records.length === 0) {
    return {
      mae: 0, mape: 0, accuracy: 100, totalDays: 0,
      rolling30: { mae: 0, mape: 0, accuracy: 100, days: 0 },
      dailyErrors: [],
    };
  }

  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));

  const dailyErrors = sorted.map(r => {
    const absoluteError = Math.abs(r.predictedOccupancy - r.actualOccupancy);
    const percentageError = r.actualOccupancy > 0
      ? (absoluteError / r.actualOccupancy) * 100
      : 0;
    return {
      date: r.date,
      predicted: r.predictedOccupancy,
      actual: r.actualOccupancy,
      absoluteError: Math.round(absoluteError * 10) / 10,
      percentageError: Math.round(percentageError * 10) / 10,
    };
  });

  // Overall MAE & MAPE
  const mae = Math.round(
    (dailyErrors.reduce((s, e) => s + e.absoluteError, 0) / dailyErrors.length) * 10
  ) / 10;

  const mape = Math.round(
    (dailyErrors.reduce((s, e) => s + e.percentageError, 0) / dailyErrors.length) * 10
  ) / 10;

  const accuracy = Math.max(0, Math.min(100, Math.round((100 - mape) * 10) / 10));

  // Rolling 30-day
  const last30 = dailyErrors.slice(-30);
  const rolling30Mae = last30.length > 0
    ? Math.round((last30.reduce((s, e) => s + e.absoluteError, 0) / last30.length) * 10) / 10
    : 0;
  const rolling30Mape = last30.length > 0
    ? Math.round((last30.reduce((s, e) => s + e.percentageError, 0) / last30.length) * 10) / 10
    : 0;

  return {
    mae,
    mape,
    accuracy,
    totalDays: sorted.length,
    rolling30: {
      mae: rolling30Mae,
      mape: rolling30Mape,
      accuracy: Math.max(0, Math.min(100, Math.round((100 - rolling30Mape) * 10) / 10)),
      days: last30.length,
    },
    dailyErrors,
  };
}

/**
 * Build forecast records from historical data and backtested predictions.
 * Used to create the input for calculateForecastAccuracy.
 */
export function buildForecastRecords(
  historicalData: Array<{ date: string; rooms_sold: number; rooms_available: number }>,
  predictions: Array<{ date: string; predictedOccupancy: number }>
): ForecastRecord[] {
  const predMap = new Map(predictions.map(p => [p.date, p.predictedOccupancy]));

  return historicalData
    .filter(h => predMap.has(h.date))
    .map(h => ({
      date: h.date,
      predictedOccupancy: predMap.get(h.date)!,
      actualOccupancy: h.rooms_available > 0
        ? Math.round((h.rooms_sold / h.rooms_available) * 100)
        : 0,
    }));
}
