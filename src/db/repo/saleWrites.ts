/** Recording and cancelling sales. Stock moves are written in the same transaction. */
import { and, eq, isNull } from 'drizzle-orm';

import { newId } from '@/lib/ids';

import { colours, customers, photos, products, saleItems, sales, shopSettings, stockMoves, type PaymentMethod } from '../schema';
import { applyMove } from '../stock';
import type { DbOrTx } from '../types';
import { assertWhole, RepoError } from './errors';
import { effectiveCost } from './profitMath';
import { createCustomer, findByPhone } from './customerWrites';
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
 * Return / cancel: puts the pieces back with 'returned' moves and sets cancelledAt.
 * Returns false (and changes nothing) when the sale was already cancelled.
 * Items whose colour was purged are skipped (that stock no longer exists).
 */
export function cancelSale(db: DbOrTx, saleId: string, now: number = Date.now()): boolean {
  return db.transaction((tx) => {
    const sale = tx.select().from(sales).where(eq(sales.id, saleId)).get();
    if (!sale) throw new RepoError('Sale not found', 'not_found');
    if (sale.cancelledAt !== null) return false;
    const items = tx.select().from(saleItems).where(eq(saleItems.saleId, saleId)).all();
    for (const item of items) {
      const exists = tx.select({ id: colours.id }).from(colours).where(eq(colours.id, item.colourId)).get();
      if (exists) applyMove(tx, { colourId: item.colourId, delta: item.qty, reason: 'returned', saleId, at: now });
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
 * Throws RepoError: 'not_found' (no such sale), 'already_done' (cancelled, older than the window,
 * or already in an owner report: use cancelSale / Return instead).
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
    const moves = tx
      .select()
      .from(stockMoves)
      .where(and(eq(stockMoves.saleId, saleId), eq(stockMoves.reason, 'sold')))
      .all();
    for (const m of moves) {
      const exists = tx.select({ id: colours.id }).from(colours).where(eq(colours.id, m.colourId)).get();
      if (exists) applyMove(tx, { colourId: m.colourId, delta: -m.delta, reason: 'correction', saleId, note: VOID_NOTE, at: now });
    }
    tx.delete(saleItems).where(eq(saleItems.saleId, saleId)).run();
    tx.delete(sales).where(eq(sales.id, saleId)).run();
    releaseBillNo(tx, sale.billNo, now);
  });
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
