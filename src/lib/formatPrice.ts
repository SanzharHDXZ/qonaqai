/** Safely format a price value — returns "—" for null/undefined/NaN */
export function formatPrice(value: number | null | undefined, currency = "€"): string {
  if (value === null || value === undefined || isNaN(value)) return "—";
  return `${currency}${Math.round(value).toLocaleString()}`;
}

/** Safe number: returns fallback for null/undefined/NaN */
export function safeNum(value: number | null | undefined, fallback = 0): number {
  if (value === null || value === undefined || isNaN(value)) return fallback;
  return value;
}