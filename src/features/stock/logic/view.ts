/** Small pure helpers that turn repo rows into what the stock screens show. */
import type { StockReason } from '@/db/schema';
import type { ProductFilter, ProductSort } from '@/db/repo/productQueries';
import type { IconName } from '@/ui/components';

export const FILTERS: ProductFilter[] = ['all', 'in', 'low', 'out'];
export const SORTS: ProductSort[] = ['newest', 'most', 'least', 'rate_high', 'rate_low', 'name'];

/** Reasons offered when the seller lowers a count by hand. 'sold' opens the Sell sheet. */
export const REDUCE_CHOICES = ['sold', 'damaged', 'correction', 'returned_to_owner', 'sample'] as const;
export type ReduceChoice = (typeof REDUCE_CHOICES)[number];

export const REASON_ICONS: Record<StockReason, IconName> = {
  opening: 'inventory-2',
  added: 'add-circle-outline',
  sold: 'sell',
  returned: 'undo',
  damaged: 'broken-image',
  correction: 'edit-note',
  returned_to_owner: 'assignment-return',
  sample: 'card-giftcard',
  deleted: 'delete-outline',
  restored: 'restore',
};

export const REDUCE_ICONS: Record<ReduceChoice, IconName> = {
  sold: 'sell',
  damaged: 'broken-image',
  correction: 'edit-note',
  returned_to_owner: 'assignment-return',
  sample: 'card-giftcard',
};

export type HistoryLine = { sign: '+' | '−'; amount: number; reasonKey: string; tone: 'up' | 'down' };

/** "+3 Added" / "−1 Sold": sign (true minus), amount and the i18n key of the reason. */
export function historyLine(move: { delta: number; reason: StockReason }): HistoryLine {
  const up = move.delta > 0;
  return { sign: up ? '+' : '−', amount: Math.abs(move.delta), reasonKey: `history.reason.${move.reason}`, tone: up ? 'up' : 'down' };
}

/** Days left before a deleted item is purged, rounded up (a part day counts as one). */
export function deletedAgeDays(purgeAt: number, now: number): number {
  return Math.max(0, Math.ceil((purgeAt - now) / 86_400_000));
}

export function listTotals(rows: readonly { totalPieces: number }[]): { designs: number; pieces: number } {
  return { designs: rows.length, pieces: rows.reduce((s, r) => s + r.totalPieces, 0) };
}

/** Same calendar day check for "Today" / "Yesterday" history labels. */
export function dayLabelKey(at: number, now: number): 'today' | 'yesterday' | null {
  const d = new Date(now);
  const startToday = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  if (at >= startToday) return 'today';
  if (at >= startToday - 86_400_000) return 'yesterday';
  return null;
}
