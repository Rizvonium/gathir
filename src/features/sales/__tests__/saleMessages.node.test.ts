import i18n from '@/i18n';
import { addTestProduct, T0 } from '@/db/__tests__/fixtures';
import { RepoError } from '@/db/repo/errors';
import { createSale } from '@/db/repo/sales';
import { StockError } from '@/db/stock';
import { createTestDb } from '@/test/testDb';

import { billOutcomeMessage, sellErrorKey, soldMessage } from '../logic/saleMessages';
import type { SellLine } from '../logic/sellCart';

const t = i18n.getFixedT('en', 'sales');

const line = (over: Partial<SellLine> = {}): SellLine => ({
  key: 'k',
  productId: 'p',
  productName: 'Sozni stole',
  colourId: 'c',
  colourName: 'Red',
  colourHex: '#C0262D',
  thumb: null,
  qty: 1,
  ratePaise: 650_000,
  ...over,
});

describe('sale messages', () => {
  it('builds the PLAN toast text', () => {
    expect(soldMessage(t, [line()], 650_000)).toBe('Sold 1 · Sozni stole (Red) · ₹6,500');
    expect(soldMessage(t, [line({ qty: 2 }), line({ qty: 1 })], 1_900_000)).toBe('Sold 3 pieces · ₹19,000');
  });

  it('maps repo and stock errors to plain messages', () => {
    const db = createTestDb();
    const { colourIds } = addTestProduct(db);
    let caught: unknown = null;
    try {
      createSale(db, { items: [{ colourId: colourIds[1], qty: 99, ratePaise: 1 }] }, T0);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(StockError);
    expect(sellErrorKey(caught)).toBe('sell.errors.insufficient');
    expect(sellErrorKey(new StockError('x', 'not_found'))).toBe('sell.errors.gone');
    expect(sellErrorKey(new RepoError('Customer not found', 'not_found'))).toBe('sell.errors.customer');
    expect(sellErrorKey(new RepoError('Discount is more than the bill', 'invalid'))).toBe('sell.errors.invalid');
    expect(sellErrorKey(new Error('disk full'))).toBe('sell.errors.generic');
    for (const key of ['sell.errors.insufficient', 'sell.errors.gone', 'sell.errors.customer', 'sell.errors.invalid', 'sell.errors.generic']) {
      expect(i18n.exists(key, { ns: 'sales' })).toBe(true);
    }
  });

  it('says nothing when the seller backs out of sharing, and something useful otherwise', () => {
    expect(billOutcomeMessage({ status: 'dismissed', hadPhone: true })).toBeNull();
    expect(billOutcomeMessage({ status: 'sent', hadPhone: true })).toEqual({ key: 'detail.billSent', tone: 'success' });
    expect(billOutcomeMessage({ status: 'fallback_shared', hadPhone: true })?.key).toBe('detail.billShared');
    expect(billOutcomeMessage({ status: 'fallback_shared', hadPhone: false })?.key).toBe('detail.billSharedNoPhone');
    expect(billOutcomeMessage({ status: 'render_failed', hadPhone: false })?.tone).toBe('danger');
  });
});
