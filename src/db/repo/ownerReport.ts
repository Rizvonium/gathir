/** View model for the owner's sales report PDF (docs/PLAN.md §7). Pure data, no rendering. */
import { and, asc, eq, gte, isNull, lte, ne } from 'drizzle-orm';

import { colours, customerEvents, customers, products, sales, stockMoves, type CustomerTag, type PaymentMethod, type StockReason } from '../schema';
import type { DbOrTx } from '../types';
import { stockStatus, type StockStatus } from './constants';
import { displayNote } from './moveNotes';
import { loadLiveProducts } from './productQueries';
import { itemsBySale, summarise, type DateRange, type SalesSummary } from './saleQueries';
import { getSettings, peekNextReportNumber } from './settings';
import { getShopInfo, type ShopInfo } from './shopInfo';

export type OwnerReportCustomer = { id: string | null; name: string; phone: string | null; city: string; tag: CustomerTag | null };

export type OwnerReportSale = {
  id: string;
  billNo: string;
  createdAt: number;
  payment: PaymentMethod;
  discountPaise: number;
  totalPaise: number;
  note: string;
  customer: OwnerReportCustomer | null;
  items: {
    productName: string;
    productCode: string;
    colourName: string;
    colourHex: string;
    qty: number;
    ratePaise: number;
    amountPaise: number;
    /** Thumbnail file name copied at sale time (relative to <documents>/photos/), or null. */
    photoName: string | null;
  }[];
};

export type OwnerReportStockChange = {
  at: number;
  productId: string;
  productName: string;
  productCode: string;
  colourName: string;
  delta: number;
  reason: StockReason;
  note: string;
};

export type OwnerReportStockRow = {
  productId: string;
  code: string;
  name: string;
  craft: string;
  categoryName: string | null;
  ratePaise: number;
  totalPieces: number;
  status: StockStatus;
  photoName: string | null;
  colours: { name: string; hex: string; pieces: number }[];
};

export type OwnerReportData = {
  shop: ShopInfo;
  period: DateRange;
  generatedAt: number;
  /** Number this report will get when createReportRecord is called. */
  reportNumber: number;
  includeCustomerPhones: boolean;
  summary: SalesSummary;
  sales: OwnerReportSale[];
  /** Sales in the period that were later returned/cancelled. */
  returns: { saleId: string; billNo: string; createdAt: number; cancelledAt: number; totalPaise: number }[];
  customers: {
    newCustomers: OwnerReportCustomer[];
    topBySpend: (OwnerReportCustomer & { spendPaise: number; purchases: number })[];
    cataloguesSent: number;
  };
  /** Stock changes not caused by sales or sale returns, oldest first. */
  stockChanges: OwnerReportStockChange[];
  stock: OwnerReportStockRow[];
  totals: { totalPieces: number; designs: number; stockValuePaise: number; lowCount: number; outCount: number };
};

/** Builds everything the owner report shows for [from, to]. Phones are null when not included. */
export function buildOwnerReportData(
  db: DbOrTx,
  opts: DateRange & { includeCustomerPhones: boolean; now?: number },
): OwnerReportData {
  const { from, to, includeCustomerPhones } = opts;
  const phone = (p: string | null) => (includeCustomerPhones ? p : null);
  const settings = getSettings(db);
  const custById = new Map(
    db
      .select()
      .from(customers)
      .all()
      .map((c) => [c.id, c]),
  );
  const toCustomer = (id: string | null, name: string | null, ph: string | null): OwnerReportCustomer | null => {
    if (!id && !name) return null;
    const c = id ? custById.get(id) : undefined;
    return { id, name: name ?? c?.name ?? '', phone: phone(ph ?? c?.phone ?? null), city: c?.city ?? '', tag: c?.tag ?? null };
  };

  const inPeriod = db
    .select()
    .from(sales)
    .where(and(gte(sales.createdAt, from), lte(sales.createdAt, to)))
    .orderBy(asc(sales.createdAt))
    .all();
  const live = inPeriod.filter((s) => s.cancelledAt === null);
  const items = itemsBySale(
    db,
    live.map((s) => s.id),
  );
  const reportSales: OwnerReportSale[] = live.map((s) => ({
    id: s.id,
    billNo: s.billNo,
    createdAt: s.createdAt,
    payment: s.payment,
    discountPaise: s.discountPaise,
    totalPaise: s.totalPaise,
    note: s.note,
    customer: toCustomer(s.customerId, s.customerNameSnapshot, s.customerPhoneSnapshot),
    items: (items.get(s.id) ?? []).map((i) => ({
      productName: i.productNameSnapshot,
      productCode: i.productCodeSnapshot,
      colourName: i.colourNameSnapshot,
      colourHex: i.colourHexSnapshot,
      qty: i.qty,
      ratePaise: i.ratePaise,
      amountPaise: i.qty * i.ratePaise,
      photoName: i.photoSnapshotName,
    })),
  }));

  const spend = new Map<string, { spendPaise: number; purchases: number }>();
  for (const s of live) {
    if (!s.customerId) continue;
    const e = spend.get(s.customerId) ?? { spendPaise: 0, purchases: 0 };
    e.spendPaise += s.totalPaise;
    e.purchases += 1;
    spend.set(s.customerId, e);
  }
  const topBySpend = [...spend.entries()]
    .sort((a, b) => b[1].spendPaise - a[1].spendPaise)
    .slice(0, 5)
    .flatMap(([id, v]) => {
      const c = toCustomer(id, null, null);
      return c ? [{ ...c, ...v }] : [];
    });
  const newCustomers = [...custById.values()]
    .filter((c) => c.deletedAt === null && c.createdAt >= from && c.createdAt <= to)
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((c) => ({ id: c.id, name: c.name, phone: phone(c.phone), city: c.city, tag: c.tag }));
  const cataloguesSent = db
    .select({ id: customerEvents.id })
    .from(customerEvents)
    .where(and(eq(customerEvents.kind, 'catalogue_sent'), gte(customerEvents.createdAt, from), lte(customerEvents.createdAt, to)))
    .all().length;

  const stockChanges = db
    .select({
      at: stockMoves.createdAt,
      productId: stockMoves.productId,
      productName: products.name,
      productCode: products.code,
      colourName: colours.name,
      delta: stockMoves.delta,
      reason: stockMoves.reason,
      note: stockMoves.note,
    })
    .from(stockMoves)
    .innerJoin(colours, eq(colours.id, stockMoves.colourId))
    .innerJoin(products, eq(products.id, stockMoves.productId))
    .where(and(gte(stockMoves.createdAt, from), lte(stockMoves.createdAt, to), isNull(stockMoves.saleId), ne(stockMoves.reason, 'sold')))
    .orderBy(asc(stockMoves.createdAt))
    .all()
    .map((m) => ({ ...m, note: displayNote(m.note) }));

  const level = settings.lowStockLevel;
  const stock: OwnerReportStockRow[] = loadLiveProducts(db, level)
    .map((p) => ({
      productId: p.id,
      code: p.code,
      name: p.name,
      craft: p.craft,
      categoryName: p.categoryName,
      ratePaise: p.ratePaise,
      totalPieces: p.totalPieces,
      status: stockStatus(p.totalPieces, level),
      photoName: p.coverThumb,
      colours: p.colours.map((c) => ({ name: c.name, hex: c.hex, pieces: c.pieces })),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    shop: getShopInfo(db),
    period: { from, to },
    generatedAt: opts.now ?? Date.now(),
    reportNumber: peekNextReportNumber(db),
    includeCustomerPhones,
    summary: summarise(db, live),
    sales: reportSales,
    returns: inPeriod
      .filter((s) => s.cancelledAt !== null)
      .map((s) => ({ saleId: s.id, billNo: s.billNo, createdAt: s.createdAt, cancelledAt: s.cancelledAt ?? 0, totalPaise: s.totalPaise })),
    customers: { newCustomers, topBySpend, cataloguesSent },
    stockChanges,
    stock,
    totals: {
      totalPieces: stock.reduce((s, p) => s + p.totalPieces, 0),
      designs: stock.length,
      stockValuePaise: stock.reduce((s, p) => s + p.totalPieces * p.ratePaise, 0),
      lowCount: stock.filter((p) => p.status === 'low').length,
      outCount: stock.filter((p) => p.status === 'out').length,
    },
  };
}
