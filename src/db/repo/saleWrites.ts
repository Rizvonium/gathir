/** Recording and cancelling sales. Stock moves are written in the same transaction. */
import { and, eq, isNull, sql } from 'drizzle-orm';

import { newId } from '@/lib/ids';

import {
  colours,
  customerCatalogueItems,
  customerEvents,
  customers,
  photos,
  products,
  reports,
  saleItems,
  sales,
  shopSettings,
  stockMoves,
  type PaymentMethod,
} from '../schema';
import { applyMove } from '../stock';
import type { DbOrTx } from '../types';
import { assertWhole, RepoError } from './errors';
import { effectiveCost } from './profitMath';
import { createCustomer, eraseCustomers, findByPhone } from './customerWrites';
import { getSettings, nextBillNo } from './settings';

export type SaleItemInput = { colourId: string; qty: number; ratePaise: number };
export type CreateSaleInput = {
  items: SaleItemInput[];
  payment?: PaymentMethod;
  discountPaise?: number;
  /** Existing customer. Omit (and newCustomer) for a walk-in sale. */
  customerId?: string | null;
  /** Created in the same transaction; an existing customer with the same phone is reused. */
  newCustomer?: { name: string; phone?: string | null };
  note?: string;
  /** Override the bill number (sample data, imports). Normally omitted. */
  billNo?: string;
};
export type CreateSaleResult = { saleId: string; billNo: string; totalPaise: number; customerId: string | null };

function resolveCustomer(tx: DbOrTx, input: CreateSaleInput, now: number): { id: string; name: string; phone: string | null } | null {
  if (input.customerId) {
    const c = tx
      .select()
      .from(customers)
      .where(and(eq(customers.id, input.customerId), isNull(customers.deletedAt)))
      .get();
    if (!c) throw new RepoError('Customer not found', 'not_found');
    return { id: c.id, name: c.name, phone: c.phone };
  }
  if (input.newCustomer) {
    const existing = findByPhone(tx, input.newCustomer.phone);
    const id = existing?.id ?? createCustomer(tx, { name: input.newCustomer.name, phone: input.newCustomer.phone, tag: 'walk_in' }, now);
    const c = tx.select().from(customers).where(eq(customers.id, id)).get();
    if (!c) throw new RepoError('Customer not found', 'not_found');
    return { id: c.id, name: c.name, phone: c.phone };
  }
  return null;
}

/**
 * Records a sale in ONE transaction: optional new customer, bill number, item snapshots
 * (name, code, colour, cover thumb) and a 'sold' move per item. Throws StockError
 * ('insufficient') and writes nothing when any colour has too few pieces.
 * Total = sum(qty × rate) − discount; a discount above the subtotal is rejected.
 */
export function createSale(db: DbOrTx, input: CreateSaleInput, now: number = Date.now()): CreateSaleResult {
  if (input.items.length === 0) throw new RepoError('Add at least one item', 'invalid');
  for (const item of input.items) {
    assertWhole(item.qty, 'Quantity', 1);
    assertWhole(item.ratePaise, 'Rate');
  }
  const discount = input.discountPaise ?? 0;
  assertWhole(discount, 'Discount');
  const subtotal = input.items.reduce((s, i) => s + i.qty * i.ratePaise, 0);
  if (discount > subtotal) throw new RepoError('Discount is more than the bill', 'invalid');

  return db.transaction((tx) => {
    const customer = resolveCustomer(tx, input, now);
    const saleId = newId();
    const billNo = input.billNo ?? nextBillNo(tx, now);
    const totalPaise = subtotal - discount;
    tx.insert(sales)
      .values({
        id: saleId,
        billNo,
        customerId: customer?.id ?? null,
        customerNameSnapshot: customer?.name ?? null,
        customerPhoneSnapshot: customer?.phone ?? null,
        payment: input.payment ?? 'cash',
        discountPaise: discount,
        totalPaise,
        note: input.note ?? '',
        createdAt: now,
      })
      .run();
    for (const item of input.items) {
      const row = tx
        .select({ colour: colours, product: products, coverThumb: photos.thumbName })
        .from(colours)
        .innerJoin(products, eq(products.id, colours.productId))
        .leftJoin(photos, eq(photos.id, products.coverPhotoId))
        .where(eq(colours.id, item.colourId))
        .get();
      if (!row || row.colour.deletedAt !== null || row.product.deletedAt !== null) {
        throw new RepoError('This design or colour is no longer in stock', 'not_found');
      }
      tx.insert(saleItems)
        .values({
          id: newId(),
          saleId,
          productId: row.product.id,
          colourId: row.colour.id,
          productNameSnapshot: row.product.name,
          productCodeSnapshot: row.product.code,
          colourNameSnapshot: row.colour.name,
          colourHexSnapshot: row.colour.hex,
          photoSnapshotName: row.coverThumb ?? null,
          qty: item.qty,
          ratePaise: item.ratePaise,
          costPaiseSnapshot: effectiveCost(row.colour.costPaise, row.product.costPaise),
        })
        .run();
      applyMove(tx, { colourId: item.colourId, delta: -item.qty, reason: 'sold', saleId, at: now });
    }
    return { saleId, billNo, totalPaise, customerId: customer?.id ?? null };
  });
}

/**
 * Pieces coming back from a sale must land in live stock. When the colour was removed from its
 * design, or the design was deleted, since the sale, it is brought back into the live list first
 * (without re-adding the pieces its delete wrote off: only the pieces coming back are counted).
 * Returns false when the colour was purged (that stock no longer exists).
 */
function reviveForReturn(tx: DbOrTx, colourId: string, now: number): boolean {
  const row = tx
    .select({ colourDeletedAt: colours.deletedAt, productId: products.id, productDeletedAt: products.deletedAt })
    .from(colours)
    .innerJoin(products, eq(products.id, colours.productId))
    .where(eq(colours.id, colourId))
    .get();
  if (!row) return false;
  if (row.productDeletedAt !== null) {
    tx.update(products).set({ deletedAt: null, updatedAt: now }).where(eq(products.id, row.productId)).run();
  }
  if (row.colourDeletedAt !== null) {
    tx.update(colours).set({ deletedAt: null, updatedAt: now }).where(eq(colours.id, colourId)).run();
  }
  return true;
}

/**
 * Return / cancel: puts the pieces back with 'returned' moves and sets cancelledAt.
 * Returns false (and changes nothing) when the sale was already cancelled.
 * A colour or design deleted since the sale comes back into live stock with the returned pieces;
 * items whose colour was purged are skipped (that stock no longer exists).
 */
export function cancelSale(db: DbOrTx, saleId: string, now: number = Date.now()): boolean {
  return db.transaction((tx) => {
    const sale = tx.select().from(sales).where(eq(sales.id, saleId)).get();
    if (!sale) throw new RepoError('Sale not found', 'not_found');
    if (sale.cancelledAt !== null) return false;
    const items = tx.select().from(saleItems).where(eq(saleItems.saleId, saleId)).all();
    for (const item of items) {
      if (reviveForReturn(tx, item.colourId, now)) {
        applyMove(tx, { colourId: item.colourId, delta: item.qty, reason: 'returned', saleId, at: now });
      }
    }
    tx.update(sales).set({ cancelledAt: now }).where(eq(sales.id, saleId)).run();
    return true;
  });
}

/** A sale can be voided (true Undo) only this long after it was recorded. */
export const VOID_WINDOW_MS = 2 * 60_000;

/** Note on the compensating 'correction' moves written by voidSale. */
export const VOID_NOTE = 'sale voided';

const BILL_YEAR_FACTOR = 100_000;

/**
 * True Undo for a sale just recorded (Sell sheet toast), within VOID_WINDOW_MS of creation.
 *
 * The ledger stays append-only and consistent: every 'sold' move gets a compensating +qty
 * 'correction' move (note VOID_NOTE, same sale id, so owner reports skip both), then the sale and
 * its items are deleted. The bill number is given back only when it is still the latest issued.
 *
 * A walk-in customer created by this very sale (and used nowhere else) is removed with it.
 *
 * Throws RepoError: 'not_found' (no such sale), 'already_done' (cancelled, older than the window,
 * already in an owner report, or its bill was already sent: use cancelSale / Return instead, so the
 * bill the customer holds keeps a matching sale and its number is never issued again).
 */
export function voidSale(db: DbOrTx, saleId: string, now: number = Date.now()): void {
  db.transaction((tx) => {
    const sale = tx.select().from(sales).where(eq(sales.id, saleId)).get();
    if (!sale) throw new RepoError('Sale not found', 'not_found');
    if (sale.cancelledAt !== null) throw new RepoError('Sale was already returned', 'already_done');
    if (sale.reportId !== null) throw new RepoError('Sale is already in an owner report', 'already_done');
    if (now - sale.createdAt > VOID_WINDOW_MS || now < sale.createdAt - VOID_WINDOW_MS) {
      throw new RepoError('Too late to undo this sale', 'already_done');
    }
    if (billWasSent(tx, saleId)) throw new RepoError('The bill was already sent', 'already_done');
    const moves = tx
      .select()
      .from(stockMoves)
      .where(and(eq(stockMoves.saleId, saleId), eq(stockMoves.reason, 'sold')))
      .all();
    for (const m of moves) {
      if (reviveForReturn(tx, m.colourId, now)) {
        applyMove(tx, { colourId: m.colourId, delta: -m.delta, reason: 'correction', saleId, note: VOID_NOTE, at: now });
      }
    }
    tx.delete(saleItems).where(eq(saleItems.saleId, saleId)).run();
    tx.delete(sales).where(eq(sales.id, saleId)).run();
    releaseBillNo(tx, sale.billNo, now);
    if (sale.customerId && createdOnlyBy(tx, sale.customerId, sale.createdAt)) eraseCustomers(tx, [sale.customerId]);
  });
}

/** True when a 'bill' record (sendBill) holds this sale: the customer already has its bill. */
function billWasSent(tx: DbOrTx, saleId: string): boolean {
  const row = tx
    .select({ id: reports.id })
    .from(reports)
    .where(
      and(
        eq(reports.kind, 'bill'),
        // CASE keeps json_extract away from malformed JSON (e.g. a hand-edited backup).
        sql`(case when json_valid(${reports.summaryJson}) then json_extract(${reports.summaryJson}, '$.saleId') end) = ${saleId}`,
      ),
    )
    .get();
  return row !== undefined;
}

/**
 * True when the customer was created by the sale recorded at `saleAt` (createSale's newCustomer:
 * walk-in tag, same timestamp, never edited) and nothing else refers to them (call after the sale
 * row is gone).
 */
function createdOnlyBy(tx: DbOrTx, customerId: string, saleAt: number): boolean {
  const c = tx.select().from(customers).where(eq(customers.id, customerId)).get();
  if (!c || c.tag !== 'walk_in' || c.createdAt !== saleAt || c.updatedAt !== saleAt) return false;
  const used =
    tx.select({ id: sales.id }).from(sales).where(eq(sales.customerId, customerId)).get() ??
    tx.select({ id: customerEvents.id }).from(customerEvents).where(eq(customerEvents.customerId, customerId)).get() ??
    tx.select({ id: customerCatalogueItems.id }).from(customerCatalogueItems).where(eq(customerCatalogueItems.customerId, customerId)).get() ??
    tx.select({ id: reports.id }).from(reports).where(eq(reports.customerId, customerId)).get();
  return used === undefined;
}

/** Steps the bill sequence back when `billNo` is the latest number issued (B-yyyy-nnnn). */
function releaseBillNo(tx: DbOrTx, billNo: string, now: number): void {
  const m = /^B-(\d{4})-(\d+)$/.exec(billNo);
  if (!m) return;
  const year = Number(m[1]);
  const seq = Number(m[2]);
  const stored = getSettings(tx, now).billSeq;
  if (stored !== year * BILL_YEAR_FACTOR + seq) return;
  // Never hand back a number another sale still uses (e.g. one restored from a backup).
  if (tx.select({ id: sales.id }).from(sales).where(eq(sales.billNo, billNo)).get()) return;
  const prev = seq > 1 ? year * BILL_YEAR_FACTOR + seq - 1 : 0;
  tx.update(shopSettings).set({ billSeq: prev, updatedAt: now }).where(eq(shopSettings.id, 1)).run();
}
