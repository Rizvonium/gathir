/** Shared constants and tiny pure helpers for repositories. */
import { shawlSwatches } from '@/ui/tokens';

export const DAY_MS = 86_400_000;

/** Items stay in Recently deleted this many days before purge. */
export const RECENTLY_DELETED_DAYS = 30;

export type StockStatus = 'in' | 'low' | 'out';

/** 'out' at 0 pieces, 'low' at 1..lowStockLevel, otherwise 'in'. */
export function stockStatus(totalPieces: number, lowStockLevel: number): StockStatus {
  if (totalPieces <= 0) return 'out';
  if (totalPieces <= lowStockLevel) return 'low';
  return 'in';
}

/**
 * Swatch key (see `shawlSwatches` in src/ui/tokens.ts) for a stored colour.
 * Matches by hex first, then by name; falls back to the lower-cased name.
 */
export function swatchKeyFor(name: string, hex: string): string {
  const h = hex.trim().toLowerCase();
  const byHex = shawlSwatches.find((s) => s.hex.toLowerCase() === h);
  if (byHex) return byHex.key;
  const n = name.trim().toLowerCase();
  const byName = shawlSwatches.find((s) => s.key === n || s.name.toLowerCase() === n);
  return byName ? byName.key : n;
}

/** Split an array into chunks (keeps SQL variable counts below SQLite limits). */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
