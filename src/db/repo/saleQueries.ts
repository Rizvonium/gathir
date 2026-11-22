/** Sales reads: list by period, one sale, period summary, sales not yet in an owner report. */
import { and, asc, desc, eq, gte, inArray, isNull, lte, sql, type SQL } from 'drizzle-orm';

import { startOfDay } from '@/lib/dates';

import { categories, customers, products, saleItems, sales, PAYMENT_METHODS, type Customer, type PaymentMethod, type Sale, type SaleItem } from '../schema';
import type { DbOrTx } from '../types';
import { chunk } from './constants';
import { addLine, computeSaleProfit, EMPTY_TOTALS, finishTotals, type SaleProfit } from './profitMath';

export type DateRange = { from: number; to: number };

export type SaleListRow = {
  id: string;
  billNo: string;
  createdAt: number;
  /** Start of the local day, for grouping by day. */
  day: number;
  cancelledAt: number | null;
  payment: PaymentMethod;
  discountPaise: number;
  totalPaise: number;
  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  pieces: number;
  itemCount: number;
  items: SaleItem[];
  /** Seller-only. Profit of the whole bill, or null when any item's buying price is unknown. */
  profitPaise: number | null;
  /** Seller-only. Profit on the items whose buying price is known. */
  knownProfitPaise: number;
  /** Items (lines) without a buying price. */
  unknownCostItems: number;
};

/** `profit` is seller-only: never pass it to bills, catalogues or Showroom. */
export type SaleDetail = { sale: Sale; items: SaleItem[]; customer: Customer | null; profit: SaleProfit };

/** Profit of one sale from its item snapshots (discount shared between items). */
export function profitOfSale(sale: Pick<Sale, 'discountPaise'>, items: readonly SaleItem[]): SaleProfit {
  return computeSaleProfit({
    discountPaise: sale.discountPaise,
    items: items.map((i) => ({ qty: i.qty, ratePaise: i.ratePaise, costPaise: i.costPaiseSnapshot })),
  });
}

export type SalesSummary = {
  pieces: number;
  amountPaise: number;
  count: number;
  discountsPaise: number;
  byPayment: Record<PaymentMethod, { count: number; amountPaise: number }>;
  /** Gross item value (before bill discounts) per current product category. */
  byCategory: { categoryId: string | null; name: string | null; pieces: number; amountPaise: number }[];
  /** Seller-only profit figures (see src/db/repo/profit.ts): profit on items with a known buying price. */
  profitPaise: number;
  knownCostPaise: number;
  knownRevenuePaise: number;
  marginPct: number | null;
  unknownCostItems: number;
};

/** Sale items for many sales, grouped by sale id. */
export function itemsBySale(db: DbOrTx, saleIds: string[]): Map<string, SaleItem[]> {
  const map = new Map<string, SaleItem[]>();
  for (const ids of chunk(saleIds, 500)) {
    const rows = db.select().from(saleItems).where(inArray(saleItems.saleId, ids)).orderBy(sql`"sale_items"."rowid"`).all();
    for (const r of rows) {
      const list = map.get(r.saleId) ?? [];
      list.push(r);
      map.set(r.saleId, list);
    }
  }
  return map;
}

function toRows(db: DbOrTx, list: Sale[]): SaleListRow[] {
  const items = itemsBySale(
    db,
    list.map((s) => s.id),
  );
  return list.map((s) => {
    const its = items.get(s.id) ?? [];
    const profit = profitOfSale(s, its);
    return {
      id: s.id,
      billNo: s.billNo,
      createdAt: s.createdAt,
      day: startOfDay(s.createdAt),
      cancelledAt: s.cancelledAt,
      payment: s.payment,
      discountPaise: s.discountPaise,
      totalPaise: s.totalPaise,
      customerId: s.customerId,
      customerName: s.customerNameSnapshot,
      customerPhone: s.customerPhoneSnapshot,
      pieces: its.reduce((n, i) => n + i.qty, 0),
      itemCount: its.length,
      items: its,
      profitPaise: profit.fullProfitPaise,
      knownProfitPaise: profit.profitPaise,
      unknownCostItems: profit.unknownCostItems,
    };
  });
}

/** True once the shop has recorded any sale at all (returned ones included). Cheap: LIMIT 1. */
export function hasAnySale(db: DbOrTx): boolean {
  return !!db.select({ id: sales.id }).from(sales).limit(1).get();
}

/** Sales in [from, to] (inclusive), newest first, including cancelled ones (check cancelledAt). */
export function listSales(
  db: DbOrTx,
  q: DateRange & { payment?: PaymentMethod; customerId?: string; includeCancelled?: boolean },
): SaleListRow[] {
  const conds: SQL[] = [gte(sales.createdAt, q.from), lte(sales.createdAt, q.to)];
  if (q.payment) conds.push(eq(sales.payment, q.payment));
  if (q.customerId) conds.push(eq(sales.customerId, q.customerId));
  if (q.includeCancelled === false) conds.push(isNull(sales.cancelledAt));
  const list = db
    .select()
    .from(sales)
    .where(and(...conds))
    .orderBy(desc(sales.createdAt))
    .all();
  return toRows(db, list);
}

/** One sale with its items and (live or deleted) customer record, or null. */
export function getSale(db: DbOrTx, saleId: string): SaleDetail | null {
  const sale = db.select().from(sales).where(eq(sales.id, saleId)).get();
  if (!sale) return null;
  const items = db.select().from(saleItems).where(eq(saleItems.saleId, saleId)).orderBy(sql`"sale_items"."rowid"`).all();
  const customer = sale.customerId ? (db.select().from(customers).where(eq(customers.id, sale.customerId)).get() ?? null) : null;
  return { sale, items, customer, profit: profitOfSale(sale, items) };
}

/** Totals for non-cancelled sales in [from, to]. */
export function salesSummary(db: DbOrTx, range: DateRange): SalesSummary {
  const list = db
    .select()
    .from(sales)
    .where(and(gte(sales.createdAt, range.from), lte(sales.createdAt, range.to), isNull(sales.cancelledAt)))
    .all();
  return summarise(db, list);
}

/** Summary over an explicit list of sales (cancelled ones are ignored). */
export function summarise(db: DbOrTx, list: Sale[]): SalesSummary {
  const live = list.filter((s) => s.cancelledAt === null);
  const byPayment = Object.fromEntries(PAYMENT_METHODS.map((p) => [p, { count: 0, amountPaise: 0 }])) as SalesSummary['byPayment'];
  let amountPaise = 0;
  let discountsPaise = 0;
  for (const s of live) {
    amountPaise += s.totalPaise;
    discountsPaise += s.discountPaise;
    byPayment[s.payment].count += 1;
    byPayment[s.payment].amountPaise += s.totalPaise;
  }
  const items = itemsBySale(
    db,
    live.map((s) => s.id),
  );
  const productCats = new Map<string, { id: string | null; name: string | null }>();
  const cats = db
    .select({ productId: products.id, categoryId: categories.id, name: categories.name })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .all();
  for (const c of cats) productCats.set(c.productId, { id: c.categoryId, name: c.name });
  const byCat = new Map<string, SalesSummary['byCategory'][number]>();
  let pieces = 0;
  let profit = EMPTY_TOTALS;
  for (const s of live) {
    const its = items.get(s.id) ?? [];
    const p = profitOfSale(s, its);
    its.forEach((it, k) => {
      profit = addLine(profit, p.lines[k], it.qty);
    });
  }
  profit = finishTotals(profit);
  for (const its of items.values()) {
    for (const it of its) {
      pieces += it.qty;
      const cat = productCats.get(it.productId) ?? { id: null, name: null };
      const key = cat.id ?? '';
      const entry = byCat.get(key) ?? { categoryId: cat.id, name: cat.name, pieces: 0, amountPaise: 0 };
      entry.pieces += it.qty;
      entry.amountPaise += it.qty * it.ratePaise;
      byCat.set(key, entry);
    }
  }
  const byCategory = [...byCat.values()].sort((a, b) => b.amountPaise - a.amountPaise);
  return {
    pieces,
    amountPaise,
    count: live.length,
    discountsPaise,
    byPayment,
    byCategory,
    profitPaise: profit.profitPaise,
    knownCostPaise: profit.knownCostPaise,
    knownRevenuePaise: profit.knownRevenuePaise,
    marginPct: profit.marginPct,
    unknownCostItems: profit.unknownCostItems,
  };
}

/** Non-cancelled sales not yet included in a sent owner report (optionally only after a time), oldest first. */
export function unreportedSales(db: DbOrTx, sinceReportAt?: number | null): SaleListRow[] {
  const conds: SQL[] = [isNull(sales.reportId), isNull(sales.cancelledAt)];
  if (sinceReportAt != null) conds.push(gte(sales.createdAt, sinceReportAt));
  const list = db
    .select()
    .from(sales)
    .where(and(...conds))
    .orderBy(asc(sales.createdAt))
    .all();
  return toRows(db, list);
}
