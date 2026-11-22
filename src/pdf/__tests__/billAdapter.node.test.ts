import { addTestProduct, T0 } from '@/db/__tests__/fixtures';
import { cancelSale, createSale, getSale } from '@/db/repo/sales';
import { getShopInfo } from '@/db/repo/shopInfo';
import { createTestDb } from '@/test/testDb';

import { billDocFromSale } from '../adapters';
import { renderBillHtml } from '../templates/bill';

describe('billDocFromSale', () => {
  it('maps a saved sale (snapshots, subtotal, discount, customer) to a bill doc', () => {
    const db = createTestDb();
    const { colourIds } = addTestProduct(db, { name: 'Kani shawl', ratePaise: 650_000 });
    const { saleId, billNo } = createSale(
      db,
      {
        items: [
          { colourId: colourIds[0], qty: 2, ratePaise: 650_000 },
          { colourId: colourIds[1], qty: 1, ratePaise: 600_000 },
        ],
        payment: 'upi',
        discountPaise: 100_000,
        newCustomer: { name: 'Rukhsana', phone: '98765 43210' },
        note: 'Gift wrap',
      },
      T0,
    );
    const detail = getSale(db, saleId);
    if (!detail) throw new Error('sale missing');
    const doc = billDocFromSale(detail, getShopInfo(db), '/*fonts*/');

    expect(doc.billNo).toBe(billNo);
    expect(doc.createdAt).toBe(T0);
    expect(doc.customer).toEqual({ name: 'Rukhsana', phone: '+919876543210' });
    expect(doc.items).toEqual([
      { name: 'Kani shawl', code: expect.any(String), colourName: 'Red', qty: 2, ratePaise: 650_000, amountPaise: 1_300_000 },
      { name: 'Kani shawl', code: expect.any(String), colourName: 'Beige', qty: 1, ratePaise: 600_000, amountPaise: 600_000 },
    ]);
    expect(doc.subtotalPaise).toBe(1_900_000);
    expect(doc.discountPaise).toBe(100_000);
    expect(doc.totalPaise).toBe(1_800_000);
    expect(doc.payment).toBe('upi');
    expect(doc.note).toBe('Gift wrap');
    expect(doc.cancelled).toBe(false);
    expect(doc.fontCss).toBe('/*fonts*/');
    expect(renderBillHtml(doc)).toContain(billNo);

    cancelSale(db, saleId, T0 + 1);
    const after = getSale(db, saleId);
    if (!after) throw new Error('sale missing');
    expect(billDocFromSale(after, getShopInfo(db)).cancelled).toBe(true);
  });

  it('prints a walk-in sale with no customer', () => {
    const db = createTestDb();
    const { colourIds } = addTestProduct(db);
    const { saleId } = createSale(db, { items: [{ colourId: colourIds[0], qty: 1, ratePaise: 650_000 }] }, T0);
    const detail = getSale(db, saleId);
    if (!detail) throw new Error('sale missing');
    const doc = billDocFromSale(detail, getShopInfo(db));
    expect(doc.customer).toBeNull();
    expect(doc.note).toBeNull();
    expect(doc.subtotalPaise).toBe(doc.totalPaise);
  });
});
