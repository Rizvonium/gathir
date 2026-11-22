import { eq } from 'drizzle-orm';

import { RepoError } from '@/db/repo/errors';
import { softDeleteProduct, stockHistory } from '@/db/repo/products';
import { buildOwnerReportData } from '@/db/repo/reports';
import { cancelSale, createSale, getSale, hasAnySale, listSales, salesSummary, unreportedSales, VOID_NOTE, VOID_WINDOW_MS, voidSale } from '@/db/repo/sales';
import { createCategory } from '@/db/repo/categories';
import { colours, customers, saleItems, sales, stockMoves } from '@/db/schema';
import { productPieces, StockError } from '@/db/stock';
import { createTestDb } from '@/test/testDb';

import { addTestProduct, DAY, expectNoDrift, T0 } from './fixtures';

describe('sales', () => {
  it('records a sale with snapshots, bill number and sold moves', () => {
    const db = createTestDb();
    const { productId, colourIds } = addTestProduct(db, { photos: 1, name: 'stole' });
    const res = createSale(
      db,
      { items: [{ colourId: colourIds[0], qty: 2, ratePaise: 650_000 }, { colourId: colourIds[1], qty: 1, ratePaise: 600_000 }], payment: 'upi', discountPaise: 50_000 },
      T0,
    );
    expect(res.billNo).toBe('B-2026-0001');
    expect(res.totalPaise).toBe(1_850_000);
    expect(productPieces(db, productId)).toBe(3);
    const detail = getSale(db, res.saleId);
    expect(detail?.items).toHaveLength(2);
    expect(detail?.items[0]).toMatchObject({ productNameSnapshot: 'stole', colourNameSnapshot: 'Red', photoSnapshotName: 'stole-0-t.jpg', productCodeSnapshot: 'GTH-0001' });
    expect(db.select().from(stockMoves).where(eq(stockMoves.saleId, res.saleId)).all().every((m) => m.reason === 'sold')).toBe(true);
    expect(createSale(db, { items: [{ colourId: colourIds[0], qty: 1, ratePaise: 1 }] }, T0 + 1).billNo).toBe('B-2026-0002');
    expect(createSale(db, { items: [{ colourId: colourIds[0], qty: 1, ratePaise: 1 }] }, new Date(2027, 0, 2).getTime()).billNo).toBe('B-2027-0001');
    expectNoDrift(db);
  });

  it('hasAnySale is false for a new shop and stays true after a return', () => {
    const db = createTestDb();
    const { colourIds } = addTestProduct(db);
    expect(hasAnySale(db)).toBe(false);
    const { saleId } = createSale(db, { items: [{ colourId: colourIds[0], qty: 1, ratePaise: 1 }] }, T0);
    expect(hasAnySale(db)).toBe(true);
    cancelSale(db, saleId, T0 + 1);
    expect(hasAnySale(db)).toBe(true);
  });

  it('fails atomically when any item has too few pieces', () => {
    const db = createTestDb();
    const { productId, colourIds } = addTestProduct(db);
    expect(() =>
      createSale(
        db,
        { items: [{ colourId: colourIds[0], qty: 1, ratePaise: 1 }, { colourId: colourIds[1], qty: 3, ratePaise: 1 }], newCustomer: { name: 'Asha', phone: '9876543210' } },
        T0,
      ),
    ).toThrow(StockError);
    expect(productPieces(db, productId)).toBe(6);
    expect(db.select().from(sales).all()).toHaveLength(0);
    expect(db.select().from(customers).all()).toHaveLength(0);
    // Same colour twice can't oversell either.
    expect(() =>
      createSale(db, { items: [{ colourId: colourIds[1], qty: 2, ratePaise: 1 }, { colourId: colourIds[1], qty: 1, ratePaise: 1 }] }, T0),
    ).toThrow(StockError);
    expectNoDrift(db);
  });

  it('enforces discount bounds and valid quantities', () => {
    const db = createTestDb();
    const { colourIds } = addTestProduct(db);
    const item = { colourId: colourIds[0], qty: 1, ratePaise: 10_000 };
    expect(() => createSale(db, { items: [item], discountPaise: 10_001 })).toThrow(RepoError);
    expect(() => createSale(db, { items: [item], discountPaise: -1 })).toThrow(RepoError);
    expect(() => createSale(db, { items: [{ ...item, qty: 0 }] })).toThrow(RepoError);
    expect(() => createSale(db, { items: [] })).toThrow(RepoError);
    expect(createSale(db, { items: [item], discountPaise: 10_000 }).totalPaise).toBe(0);
  });

  it('refuses deleted products', () => {
    const db = createTestDb();
    const { productId, colourIds } = addTestProduct(db);
    softDeleteProduct(db, productId, T0);
    expect(() => createSale(db, { items: [{ colourId: colourIds[0], qty: 1, ratePaise: 1 }] })).toThrow(/no longer/);
  });

  it('creates or reuses a customer inside the sale', () => {
    const db = createTestDb();
    const { colourIds } = addTestProduct(db);
    const a = createSale(db, { items: [{ colourId: colourIds[0], qty: 1, ratePaise: 1 }], newCustomer: { name: 'Asha', phone: '98765 43210' } }, T0);
    const b = createSale(db, { items: [{ colourId: colourIds[0], qty: 1, ratePaise: 1 }], newCustomer: { name: 'Asha K', phone: '+919876543210' } }, T0);
    expect(a.customerId).not.toBeNull();
    expect(b.customerId).toBe(a.customerId);
    expect(getSale(db, a.saleId)?.sale.customerPhoneSnapshot).toBe('+919876543210');
    expect(db.select().from(customers).all()).toHaveLength(1);
  });

  it('cancel restores stock once; a second cancel is a no-op', () => {
    const db = createTestDb();
    const { productId, colourIds } = addTestProduct(db);
    const { saleId } = createSale(db, { items: [{ colourId: colourIds[0], qty: 3, ratePaise: 1 }] }, T0);
    expect(productPieces(db, productId)).toBe(3);
    expect(cancelSale(db, saleId, T0 + 10)).toBe(true);
    expect(productPieces(db, productId)).toBe(6);
    expect(cancelSale(db, saleId, T0 + 20)).toBe(false);
    expect(productPieces(db, productId)).toBe(6);
    expect(getSale(db, saleId)?.sale.cancelledAt).toBe(T0 + 10);
    expect(db.select().from(stockMoves).where(eq(stockMoves.reason, 'returned')).all()).toHaveLength(1);
    expect(() => cancelSale(db, 'nope')).toThrow(RepoError);
    expectNoDrift(db);
  });

  it('lists and summarises by period, payment and category', () => {
    const db = createTestDb();
    const cat = createCategory(db, { name: 'Test cat' });
    const p = addTestProduct(db, { categoryId: cat });
    const q = addTestProduct(db, { name: 'Other' });
    createSale(db, { items: [{ colourId: p.colourIds[0], qty: 2, ratePaise: 1000 }], payment: 'cash', discountPaise: 100 }, T0);
    createSale(db, { items: [{ colourId: q.colourIds[0], qty: 1, ratePaise: 5000 }], payment: 'upi' }, T0 + 1000);
    const cancelled = createSale(db, { items: [{ colourId: q.colourIds[1], qty: 1, ratePaise: 7000 }], payment: 'upi' }, T0 + 2000);
    cancelSale(db, cancelled.saleId, T0 + 3000);
    createSale(db, { items: [{ colourId: p.colourIds[1], qty: 1, ratePaise: 9999 }] }, T0 + 2 * DAY);

    const range = { from: T0 - 1, to: T0 + DAY };
    const rows = listSales(db, range);
    expect(rows.map((r) => r.totalPaise)).toEqual([7000, 5000, 1900]);
    expect(rows[2]).toMatchObject({ pieces: 2, itemCount: 1 });
    expect(listSales(db, { ...range, payment: 'upi', includeCancelled: false })).toHaveLength(1);
    const s = salesSummary(db, range);
    expect(s).toMatchObject({ pieces: 3, amountPaise: 6900, count: 2, discountsPaise: 100 });
    expect(s.byPayment.cash).toEqual({ count: 1, amountPaise: 1900 });
    expect(s.byPayment.upi).toEqual({ count: 1, amountPaise: 5000 });
    expect(s.byCategory.find((c) => c.categoryId === cat)).toMatchObject({ name: 'Test cat', pieces: 2, amountPaise: 2000 });
    expect(unreportedSales(db)).toHaveLength(3);
    expect(unreportedSales(db, T0 + DAY)).toHaveLength(1);
    expect(db.select().from(colours).all().every((c) => c.pieces >= 0)).toBe(true);
  });
});

describe('voidSale (true Undo)', () => {
  it('removes the sale, puts the pieces back with compensating moves and keeps the ledger consistent', () => {
    const db = createTestDb();
    const { productId, colourIds } = addTestProduct(db);
    const before = productPieces(db, productId);
    const sale = createSale(db, { items: [{ colourId: colourIds[0], qty: 2, ratePaise: 650_000 }, { colourId: colourIds[1], qty: 1, ratePaise: 600_000 }] }, T0);
    expect(productPieces(db, productId)).toBe(before - 3);

    voidSale(db, sale.saleId, T0 + 30_000);
    expect(productPieces(db, productId)).toBe(before);
    expect(getSale(db, sale.saleId)).toBeNull();
    expect(db.select().from(saleItems).where(eq(saleItems.saleId, sale.saleId)).all()).toEqual([]);
    // Append-only ledger: the sold moves stay, each with a +qty correction "sale voided".
    const moves = db.select().from(stockMoves).where(eq(stockMoves.saleId, sale.saleId)).all();
    expect(moves.map((m) => [m.reason, m.delta]).sort()).toEqual([
      ['correction', 1],
      ['correction', 2],
      ['sold', -1],
      ['sold', -2],
    ]);
    expect(moves.filter((m) => m.reason === 'correction').every((m) => m.note === VOID_NOTE)).toBe(true);
    expectNoDrift(db);
    // The history keeps the moves without a dead link to the voided sale.
    expect(stockHistory(db, productId).filter((h) => h.reason === 'sold').every((h) => h.saleId === null && h.billNo === null)).toBe(true);
    expect(listSales(db, { from: T0 - DAY, to: T0 + DAY })).toEqual([]);
    // Nothing shows in the owner report's "stock changes not from sales".
    expect(buildOwnerReportData(db, { from: T0 - DAY, to: T0 + DAY, includeCustomerPhones: false }).stockChanges.filter((c) => c.reason === 'correction')).toEqual([]);
  });

  it('gives the bill number back only when it is the latest', () => {
    const db = createTestDb();
    const { colourIds } = addTestProduct(db);
    const item = { colourId: colourIds[0], qty: 1, ratePaise: 100 };
    const s1 = createSale(db, { items: [item] }, T0);
    const s2 = createSale(db, { items: [item] }, T0 + 1);
    voidSale(db, s1.saleId, T0 + 2); // not the latest: B-2026-0001 is not reused
    expect(createSale(db, { items: [item] }, T0 + 3).billNo).toBe('B-2026-0003');
    const s4 = createSale(db, { items: [item] }, T0 + 4);
    expect(s4.billNo).toBe('B-2026-0004');
    voidSale(db, s4.saleId, T0 + 5); // latest: released
    expect(createSale(db, { items: [item] }, T0 + 6).billNo).toBe('B-2026-0004');
    expect(s2.billNo).toBe('B-2026-0002');
    expectNoDrift(db);
  });

  it('refuses after 2 minutes, for returned or reported sales, and for unknown ids', () => {
    const db = createTestDb();
    const { colourIds } = addTestProduct(db);
    const item = { colourId: colourIds[0], qty: 1, ratePaise: 100 };
    const old = createSale(db, { items: [item] }, T0);
    expect(() => voidSale(db, old.saleId, T0 + VOID_WINDOW_MS + 1)).toThrow(expect.objectContaining({ code: 'already_done' }));
    const returned = createSale(db, { items: [item] }, T0);
    cancelSale(db, returned.saleId, T0 + 1);
    expect(() => voidSale(db, returned.saleId, T0 + 2)).toThrow(expect.objectContaining({ code: 'already_done' }));
    const reported = createSale(db, { items: [item] }, T0);
    db.update(sales).set({ reportId: 'r1' }).where(eq(sales.id, reported.saleId)).run();
    expect(() => voidSale(db, reported.saleId, T0 + 2)).toThrow(expect.objectContaining({ code: 'already_done' }));
    expect(() => voidSale(db, 'nope', T0)).toThrow(expect.objectContaining({ code: 'not_found' }));
    expect(getSale(db, old.saleId)).not.toBeNull();
    expectNoDrift(db);
  });
});
