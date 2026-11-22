export type StockStatus = 'ok' | 'low' | 'out';

/** Default "low stock" line: at or below this many pieces counts as low. */
export const DEFAULT_LOW_THRESHOLD = 2;

/** 0 or less → out; at or below `lowThreshold` → low; otherwise ok. */
export function stockStatusOf(count: number, lowThreshold: number = DEFAULT_LOW_THRESHOLD): StockStatus {
  if (count <= 0) return 'out';
  if (count <= lowThreshold) return 'low';
  return 'ok';
}
