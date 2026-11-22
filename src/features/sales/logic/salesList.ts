/** Sales tab logic, pure: period ranges, day groups with totals, summary, item labels. */
import { computeSaleProfit, marginPct, type ProfitTotals } from '@/db/repo/profitMath';
import type { SaleListRow } from '@/db/repo/saleQueries';
import type { PaymentMethod } from '@/db/schema';
import { addDays, endOfDay, startOfMonth, startOfWeek } from '@/lib/dates';

export type SalesPeriod = 'today' | 'week' | 'month' | 'all';
export const SALES_PERIODS: readonly SalesPeriod[] = ['today', 'week', 'month', 'all'];

/** [from, to] for a period. `today` is the start of the current local day (useToday). */
export function periodRange(period: SalesPeriod, today: number): { from: number; to: number } {
  const to = endOfDay(today);
  switch (period) {
    case 'today':
      return { from: today, to };
    case 'week':
      return { from: startOfWeek(today), to };
    case 'month':
      return { from: startOfMonth(today), to };
    case 'all':
      return { from: 0, to };
  }
}

export type SalesTotals = { pieces: number; amountPaise: number; count: number };

/** Totals over rows; returned (cancelled) sales do not count. */
export function totalsOf(rows: readonly SaleListRow[]): SalesTotals {
  let pieces = 0;
  let amountPaise = 0;
  let count = 0;
  for (const r of rows) {
    if (r.cancelledAt !== null) continue;
    pieces += r.pieces;
    amountPaise += r.totalPaise;
    count += 1;
  }
  return { pieces, amountPaise, count };
}

/**
 * Seller-only profit over the listed rows (so it follows the payment filter too). Returned sales
 * do not count; items without a buying price are left out of the profit and counted in
 * `unknownCostItems`, never treated as 100 % profit.
 */
export function profitOfRows(rows: readonly Pick<SaleListRow, 'cancelledAt' | 'discountPaise' | 'items'>[]): ProfitTotals {
  const t = { revenuePaise: 0, knownRevenuePaise: 0, knownCostPaise: 0, profitPaise: 0, unknownCostItems: 0, pieces: 0 };
  for (const r of rows) {
    if (r.cancelledAt !== null) continue;
    const p = computeSaleProfit({
      discountPaise: r.discountPaise,
      items: r.items.map((i) => ({ qty: i.qty, ratePaise: i.ratePaise, costPaise: i.costPaiseSnapshot ?? null })),
    });
    t.revenuePaise += p.revenuePaise;
    t.knownRevenuePaise += p.knownRevenuePaise;
    t.knownCostPaise += p.knownCostPaise;
    t.profitPaise += p.profitPaise;
    t.unknownCostItems += p.unknownCostItems;
    t.pieces += p.pieces;
  }
  return { ...t, marginPct: marginPct(t.profitPaise, t.knownRevenuePaise) };
}

export type SalesListItem =
  | ({ type: 'day'; key: string; day: number } & SalesTotals)
  | { type: 'sale'; key: string; sale: SaleListRow; lastInDay: boolean };

/**
 * Flattens newest-first rows into day headers (with that day's totals) and sale rows, plus
 * the header indices for sticky headers.
 */
export function groupSalesByDay(rows: readonly SaleListRow[]): { items: SalesListItem[]; stickyIndices: number[] } {
  const items: SalesListItem[] = [];
  const stickyIndices: number[] = [];
  let i = 0;
  while (i < rows.length) {
    const day = rows[i].day;
    let j = i;
    while (j < rows.length && rows[j].day === day) j += 1;
    const group = rows.slice(i, j);
    stickyIndices.push(items.length);
    items.push({ type: 'day', key: `day-${day}`, day, ...totalsOf(group) });
    group.forEach((sale, k) => items.push({ type: 'sale', key: sale.id, sale, lastInDay: k === group.length - 1 }));
    i = j;
  }
  return { items, stickyIndices };
}

export type DayLabel = { kind: 'today' } | { kind: 'yesterday' } | { kind: 'date'; day: number };

export function dayLabel(day: number, today: number): DayLabel {
  if (day === today) return { kind: 'today' };
  if (day === addDays(today, -1)) return { kind: 'yesterday' };
  return { kind: 'date', day };
}

/** First item as "Sozni stole (Red) × 2" parts and how many more items the sale has. */
export function itemSummary(items: readonly { productNameSnapshot: string; colourNameSnapshot: string; qty: number }[]): {
  name: string;
  colour: string;
  qty: number;
  more: number;
} | null {
  const first = items[0];
  if (!first) return null;
  return { name: first.productNameSnapshot, colour: first.colourNameSnapshot, qty: first.qty, more: items.length - 1 };
}

export const PAYMENT_ICONS: Record<PaymentMethod, 'payments' | 'qr-code-2' | 'credit-card' | 'more-horiz'> = {
  cash: 'payments',
  upi: 'qr-code-2',
  card: 'credit-card',
  other: 'more-horiz',
};

/** Which empty state the list shows. */
export type EmptyKind = 'none' | 'never' | 'today' | 'period' | 'payment';

export function emptyKind(opts: { rows: number; period: SalesPeriod; payment: PaymentMethod | null; anySalesEver: boolean }): EmptyKind {
  if (opts.rows > 0) return 'none';
  if (!opts.anySalesEver) return 'never';
  if (opts.payment) return 'payment';
  if (opts.period === 'today') return 'today';
  return 'period';
}
