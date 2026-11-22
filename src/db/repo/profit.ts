/**
 * Buying price & profit (PLAN §3). Seller-only: nothing here may reach Showroom, catalogues,
 * product cards or bills. The maths lives in ./profitMath (pure); this module reads the database.
 *
 * - Effective buying price of a colour = colours.cost_paise ?? products.cost_paise ?? unknown.
 * - Each sale item stores that price at sale time (`cost_paise_snapshot`), so later edits never
 *   change past profit. Items without a snapshot have unknown profit (never counted as 100 %).
 * - Cancelled (returned) sales are left out everywhere.
 */
import { and, eq, gte, inArray, isNull, lte } from 'drizzle-orm';

import { startOfDay, startOfMonth, startOfWeek } from '@/lib/dates';

import { categories, colours, products, saleItems, sales, type Sale, type SaleItem } from '../schema';
import type { DbOrTx } from '../types';
import { chunk } from './constants';
import {
  addLine,
  effectiveCost,
  EMPTY_TOTALS,
  finishTotals,
  type ProfitTotals,
  type SaleProfit,
} from './profitMath';
import { itemsBySale, profitOfSale, type DateRange } from './saleQueries';

export * from './profitMath';

export type ProfitSummary = ProfitTotals & { salesCount: number };

export type ProfitGroupBy = 'day' | 'week' | 'month' | 'product' | 'category' | 'customer';

export type ProfitGroupRow = ProfitSummary & {
  /** Product / category / customer id, or the period start (as a string) for time groups. '' = none. */
  key: string;
  /** Product name (as sold), category name or customer name; null = uncategorised / walk-in. */
  label: string | null;
  /** Period start (epoch ms) for day/week/month groups, else null. */
  at: number | null;
};

export type ProfitBreakdowns = {
  summary: ProfitSummary;
  byDay: ProfitGroupRow[];
  byProduct: ProfitGroupRow[];
  byCategory: ProfitGroupRow[];
  byCustomer: ProfitGroupRow[];
};

/** Profit of one sale from its items (snapshots). */
export const saleProfitOf = profitOfSale;

/** Effective buying price per piece of a colour right now (null = unknown). */
export function colourCost(db: DbOrTx, colourId: string): number | null {
  const row = db
    .select({ colourCost: colours.costPaise, productCost: products.costPaise })
    .from(colours)
    .innerJoin(products, eq(products.id, colours.productId))
    .where(eq(colours.id, colourId))
    .get();
  return row ? effectiveCost(row.colourCost, row.productCost) : null;
}

function liveSalesIn(db: DbOrTx, range: DateRange): Sale[] {
  return db
    .select()
    .from(sales)
    .where(and(gte(sales.createdAt, range.from), lte(sales.createdAt, range.to), isNull(sales.cancelledAt)))
    .all();
}

type Contribution = { sale: Sale; item: SaleItem; line: SaleProfit['lines'][number] };

/** Every sold line of live sales, with its share of the bill discount. */
function contributions(db: DbOrTx, list: Sale[]): Contribution[] {
  const items = itemsBySale(
    db,
    list.map((s) => s.id),
  );
  const out: Contribution[] = [];
  for (const sale of list) {
    const its = items.get(sale.id) ?? [];
    const p = saleProfitOf(sale, its);
    its.forEach((item, k) => out.push({ sale, item, line: p.lines[k] }));
  }
  return out;
}

class Groups {
  private map = new Map<string, { label: string | null; at: number | null; totals: ProfitTotals; sales: Set<string> }>();
  add(key: string, label: string | null, at: number | null, c: Contribution): void {
    const g = this.map.get(key) ?? { label, at, totals: EMPTY_TOTALS, sales: new Set<string>() };
    g.totals = addLine(g.totals, c.line, c.item.qty);
    g.sales.add(c.sale.id);
    this.map.set(key, g);
  }
  rows(): ProfitGroupRow[] {
    return [...this.map.entries()].map(([key, g]) => ({ ...finishTotals(g.totals), salesCount: g.sales.size, key, label: g.label, at: g.at }));
  }
}

function summaryOf(list: Sale[], cs: Contribution[]): ProfitSummary {
  let t = EMPTY_TOTALS;
  for (const c of cs) t = addLine(t, c.line, c.item.qty);
  return { ...finishTotals(t), salesCount: list.length };
}

/** Totals for non-cancelled sales in [from, to]. */
export function profitSummary(db: DbOrTx, range: DateRange): ProfitSummary {
  const list = liveSalesIn(db, range);
  return summaryOf(list, contributions(db, list));
}

/** Profit grouped by day / week / month (oldest first) or by product / category / customer (most profit first). */
export function profitBreakdown(db: DbOrTx, range: DateRange, by: ProfitGroupBy): ProfitGroupRow[] {
  const list = liveSalesIn(db, range);
  return groupContributions(db, contributions(db, list), by);
}

/** Summary and the four standard breakdowns in one pass over the sales. */
export function profitBreakdowns(db: DbOrTx, range: DateRange): ProfitBreakdowns {
  const list = liveSalesIn(db, range);
  const cs = contributions(db, list);
  return {
    summary: summaryOf(list, cs),
    byDay: groupContributions(db, cs, 'day'),
    byProduct: groupContributions(db, cs, 'product'),
    byCategory: groupContributions(db, cs, 'category'),
    byCustomer: groupContributions(db, cs, 'customer'),
  };
}

const PERIOD_START: Record<'day' | 'week' | 'month', (ms: number) => number> = { day: startOfDay, week: startOfWeek, month: startOfMonth };

function groupContributions(db: DbOrTx, cs: Contribution[], by: ProfitGroupBy): ProfitGroupRow[] {
  const groups = new Groups();
  if (by === 'day' || by === 'week' || by === 'month') {
    for (const c of cs) {
      const at = PERIOD_START[by](c.sale.createdAt);
      groups.add(String(at), null, at, c);
    }
    return groups.rows().sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
  }
  if (by === 'product') {
    for (const c of cs) groups.add(c.item.productId, c.item.productNameSnapshot, null, c);
  } else if (by === 'customer') {
    for (const c of cs) groups.add(c.sale.customerId ?? '', c.sale.customerNameSnapshot, null, c);
  } else {
    const cats = productCategories(
      db,
      cs.map((c) => c.item.productId),
    );
    for (const c of cs) {
      const cat = cats.get(c.item.productId) ?? { id: null, name: null };
      groups.add(cat.id ?? '', cat.name, null, c);
    }
  }
  return groups.rows().sort((a, b) => b.profitPaise - a.profitPaise || b.revenuePaise - a.revenuePaise);
}

function productCategories(db: DbOrTx, productIds: string[]): Map<string, { id: string | null; name: string | null }> {
  const map = new Map<string, { id: string | null; name: string | null }>();
  for (const ids of chunk([...new Set(productIds)], 500)) {
    const rows = db
      .select({ productId: products.id, categoryId: categories.id, name: categories.name })
      .from(products)
      .leftJoin(categories, eq(categories.id, products.categoryId))
      .where(inArray(products.id, ids))
      .all();
    for (const r of rows) map.set(r.productId, { id: r.categoryId, name: r.name });
  }
  return map;
}

export type ProductProfit = ProfitSummary;

/** Profit earned on one design over all its non-cancelled sales (product detail). */
export function productProfit(db: DbOrTx, productId: string): ProductProfit {
  const saleIds = db
    .selectDistinct({ id: saleItems.saleId })
    .from(saleItems)
    .innerJoin(sales, eq(sales.id, saleItems.saleId))
    .where(and(eq(saleItems.productId, productId), isNull(sales.cancelledAt)))
    .all()
    .map((r) => r.id);
  const list: Sale[] = [];
  for (const ids of chunk(saleIds, 500)) list.push(...db.select().from(sales).where(inArray(sales.id, ids)).all());
  const cs = contributions(db, list).filter((c) => c.item.productId === productId);
  return summaryOf(list, cs);
}

export type StockValues = {
  /** Pieces × selling rate (potential sales). */
  atRatePaise: number;
  /** Pieces × buying price, for pieces whose buying price is known (money tied up). */
  atCostPaise: number;
  /** Pieces in stock without a buying price (left out of atCostPaise). */
  unknownCostPieces: number;
  totalPieces: number;
};

/** Value of live stock at selling rate and at buying price (Home). */
export function stockValues(db: DbOrTx): StockValues {
  const rows = db
    .select({ pieces: colours.pieces, colourCost: colours.costPaise, productCost: products.costPaise, ratePaise: products.ratePaise })
    .from(colours)
    .innerJoin(products, eq(products.id, colours.productId))
    .where(and(isNull(colours.deletedAt), isNull(products.deletedAt)))
    .all();
  const out: StockValues = { atRatePaise: 0, atCostPaise: 0, unknownCostPieces: 0, totalPieces: 0 };
  for (const r of rows) {
    if (r.pieces <= 0) continue;
    out.totalPieces += r.pieces;
    out.atRatePaise += r.pieces * r.ratePaise;
    const cost = effectiveCost(r.colourCost, r.productCost);
    if (cost === null) out.unknownCostPieces += r.pieces;
    else out.atCostPaise += r.pieces * cost;
  }
  return out;
}
