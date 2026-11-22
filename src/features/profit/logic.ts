/**
 * Profit screens, pure logic (no React, no expo): periods, how a total is described, the Sell
 * sheet's live profit preview and the breakdown tabs. Seller-only (PLAN §3 "Buying price & profit").
 *
 * The rule that matters most: an item without a buying price has UNKNOWN profit. It is never
 * shown as 100 % profit and never hidden: every total says how many items it leaves out.
 */
import { computeSaleProfit, marginPct, type ProfitTotals, type SaleProfit } from '@/db/repo/profitMath';
import type { ProfitBreakdowns, ProfitGroupRow } from '@/db/repo/profit';
import { endOfDay, startOfDay, startOfMonth, startOfWeek } from '@/lib/dates';
import { formatINR } from '@/lib/money';

// ---------- periods ----------

export const PROFIT_PERIODS = ['today', 'week', 'month', 'custom'] as const;
export type ProfitPeriod = (typeof PROFIT_PERIODS)[number];

export type Range = { from: number; to: number };

/**
 * [from, to] for a period. `today` is the start of the current local day (useToday), so the range
 * only changes at midnight (stable query deps). Custom days are day starts, in any order.
 */
export function profitRange(period: ProfitPeriod, today: number, customFrom: number | null = null, customTo: number | null = null): Range {
  switch (period) {
    case 'today':
      return { from: today, to: endOfDay(today) };
    case 'week':
      return { from: startOfWeek(today), to: endOfDay(today) };
    case 'month':
      return { from: startOfMonth(today), to: endOfDay(today) };
    case 'custom': {
      const a = startOfDay(customFrom ?? today);
      const b = startOfDay(customTo ?? customFrom ?? today);
      return { from: Math.min(a, b), to: endOfDay(Math.max(a, b)) };
    }
  }
}

// ---------- formatting ----------

const pctFormatter = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1, minimumFractionDigits: 0 });

/** "23.5%" / "−4%", or null when there is no margin to show. */
export function formatMargin(pct: number | null | undefined): string | null {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return null;
  const text = `${pctFormatter.format(Math.abs(pct))}%`;
  return pct < 0 ? `−${text}` : text;
}

/** Money with a real minus sign for a loss: "₹2,500" / "−₹500". */
export function formatProfit(paise: number): string {
  return paise < 0 ? `−${formatINR(-paise)}` : formatINR(paise);
}

export type ProfitTone = 'meadow' | 'danger' | 'text';

/** Green for profit, red for a loss, plain for zero. Always paired with words, never colour alone. */
export function profitTone(paise: number): ProfitTone {
  if (paise > 0) return 'meadow';
  if (paise < 0) return 'danger';
  return 'text';
}

// ---------- describing a total ----------

/**
 * How a profit total should read:
 * - `none`: nothing sold in the range;
 * - `unknown`: things were sold, but none of them has a buying price (no profit figure at all);
 * - `partial`: a profit figure, plus "n items without a buying price are left out";
 * - `full`: every item has a buying price.
 */
export type ProfitState = 'none' | 'unknown' | 'partial' | 'full';

export function profitState(t: Pick<ProfitTotals, 'revenuePaise' | 'knownRevenuePaise' | 'knownCostPaise' | 'unknownCostItems' | 'pieces'>): ProfitState {
  if (t.pieces === 0 && t.revenuePaise === 0 && t.unknownCostItems === 0) return 'none';
  if (t.unknownCostItems === 0) return 'full';
  if (t.knownRevenuePaise === 0 && t.knownCostPaise === 0) return 'unknown';
  return 'partial';
}

// ---------- Sell sheet preview ----------

export type CartProfitLine = { qty: number; ratePaise: number; costPaise?: number | null };

export type CartProfit = SaleProfit & {
  /** At least one line is sold for less than its buying price. */
  belowCost: boolean;
  /** The whole bill (after the discount) loses money on the items with a buying price. */
  loss: boolean;
};

/** Live profit of the sale being entered: same maths as the saved sale (discount shared by value). */
export function cartProfit(lines: readonly CartProfitLine[], discountPaise: number | null): CartProfit {
  const items = lines.map((l) => ({ qty: l.qty, ratePaise: l.ratePaise, costPaise: l.costPaise ?? null }));
  const discount = Math.max(0, Math.min(discountPaise ?? 0, items.reduce((s, i) => s + i.qty * i.ratePaise, 0)));
  const p = computeSaleProfit({ discountPaise: discount, items });
  const belowCost = items.some((i) => i.costPaise !== null && i.ratePaise < i.costPaise);
  return { ...p, belowCost, loss: p.knownRevenuePaise > 0 && p.profitPaise < 0 };
}

/** Margin of one design at its normal rate: (rate − buying price) ÷ rate. */
export function rateMargin(ratePaise: number, costPaise: number | null): { profitPaise: number; marginPct: number | null } | null {
  if (costPaise === null) return null;
  const profitPaise = ratePaise - costPaise;
  return { profitPaise, marginPct: marginPct(profitPaise, ratePaise) };
}

// ---------- breakdown tabs ----------

export const BREAKDOWN_TABS = ['day', 'product', 'category', 'customer'] as const;
export type BreakdownTab = (typeof BREAKDOWN_TABS)[number];

/** Rows for a tab. Days newest first (the repo gives them oldest first); the others most profit first. */
export function breakdownRows(b: ProfitBreakdowns, tab: BreakdownTab): ProfitGroupRow[] {
  switch (tab) {
    case 'day':
      return [...b.byDay].reverse();
    case 'product':
      return b.byProduct;
    case 'category':
      return b.byCategory;
    case 'customer':
      return b.byCustomer;
  }
}

/** Width share (0–1) of a row's profit bar against the biggest profit in the list. Losses and unknowns get 0. */
export function barShare(profitPaise: number, rows: readonly Pick<ProfitGroupRow, 'profitPaise'>[]): number {
  const max = rows.reduce((m, r) => Math.max(m, r.profitPaise), 0);
  if (max <= 0 || profitPaise <= 0) return 0;
  return Math.min(1, profitPaise / max);
}
