import { createCustomer } from '@/db/repo/customers';
import { homeSummary } from '@/db/repo/dashboard';
import { addFollowUp, logCatalogueSent } from '@/db/repo/events';
import { softDeleteProduct } from '@/db/repo/products';
import {
  buildCatalogueData,
  buildOwnerReportData,
  computeFingerprint,
  createReportRecord,
  lastOwnerReport,
  listReports,
  markSent,
  unmarkSent,
} from '@/db/repo/reports';
import { cancelSale, createSale, salesSummary, unreportedSales } from '@/db/repo/sales';
import { updateSettings } from '@/db/repo/settings';
import { recordReduction } from '@/db/stock';
import { createTestDb } from '@/test/testDb';

import { addTestProduct, DAY, T0 } from './fixtures';

function setup() {
  const db = createTestDb();
  updateSettings(db, { shopName: 'Kashmir Looms', sellerName: 'Bilal' }, T0);
  const a = addTestProduct(db, { name: 'Sozni stole', photos: 1, ratePaise: 650_000, costPaise: 300_000 });
  const b = addTestProduct(db, { name: 'Kani shawl', ratePaise: 5_000_000, colours: [{ name: 'Multi', hex: 'multi', pieces: 1 }] });
  const c = addTestProduct(db, { name: 'Aari stole', ratePaise: 200_000, colours: [{ name: 'Blue', hex: '#2F5DA8', pieces: 1 }] });
  const cust = createCustomer(db, { name: 'Asha', phone: '9876543210', city: 'Srinagar' }, T0 + 1);
  createSale(db, { items: [{ colourId: a.colourIds[0], qty: 2, ratePaise: 650_000 }], customerId: cust, payment: 'upi', discountPaise: 10_000 }, T0 + 1000);
  createSale(db, { items: [{ colourId: c.colourIds[0], qty: 1, ratePaise: 200_000 }] }, T0 + 2000);
  const r = createSale(db, { items: [{ colourId: a.colourIds[1], qty: 1, ratePaise: 600_000 }] }, T0 + 3000);
  cancelSale(db, r.saleId, T0 + 4000);
  recordReduction(db, a.colourIds[1], 1, 'damaged', 'moth', T0 + 5000);
  logCatalogueSent(db, cust, null, [a.productId], T0 + 6000);
  return { db, a, b, c, cust };
}

describe('owner report data', () => {
  it('totals match the sales summary and hides phones on request', () => {
    const { db, cust } = setup();
    const range = { from: T0, to: T0 + DAY };
    const data = buildOwnerReportData(db, { ...range, includeCustomerPhones: false, now: T0 + DAY });
    const summary = salesSummary(db, range);
    // Profit is seller-only: the report summary leaves it out unless the setting is on.
    const { profitPaise, knownCostPaise, knownRevenuePaise, marginPct, unknownCostItems, ...withoutProfit } = summary;
    void [profitPaise, knownCostPaise, knownRevenuePaise, marginPct, unknownCostItems];
    expect(data.summary).toEqual(withoutProfit);
    expect(data.includeProfit).toBe(false);
    expect(data.profit).toBeNull();
    expect(data.sales.reduce((s, x) => s + x.totalPaise, 0)).toBe(summary.amountPaise);
    expect(data.sales.flatMap((s) => s.items).reduce((n, i) => n + i.qty, 0)).toBe(summary.pieces);
    expect(data.sales[0].items[0].photoName).toBe('Sozni stole-0-t.jpg');
    expect(data.sales[0].customer).toMatchObject({ id: cust, name: 'Asha', phone: null, city: 'Srinagar' });
    expect(data.returns).toHaveLength(1);
    const reasons = data.stockChanges.map((m) => m.reason);
    expect(reasons).toEqual(['opening', 'opening', 'opening', 'opening', 'damaged']);
    expect(data.stockChanges[4].note).toBe('moth');
    expect(data.customers.newCustomers.map((c) => c.name)).toEqual(['Asha']);
    expect(data.customers.topBySpend[0]).toMatchObject({ name: 'Asha', spendPaise: 1_290_000 });
    expect(data.customers.cataloguesSent).toBe(1);
    expect(data.totals).toMatchObject({ totalPieces: 4, designs: 3, outCount: 1, lowCount: 1 });
    expect(data.totals.stockValuePaise).toBe(3 * 650_000 + 5_000_000);
    expect(data.stock.find((p) => p.name === 'Sozni stole')?.colours).toEqual([
      { name: 'Red', hex: '#C0262D', pieces: 2 },
      { name: 'Beige', hex: '#D8C3A5', pieces: 1 },
    ]);
    expect(data.shop.shopName).toBe('Kashmir Looms');
    expect(data.reportNumber).toBe(1);
    expect(buildOwnerReportData(db, { ...range, includeCustomerPhones: true }).sales[0].customer?.phone).toBe('+919876543210');
    expect(JSON.stringify(data)).not.toContain('costPaise');
  });

  it('records, marks sent (claiming sales) and undoes', () => {
    const { db } = setup();
    const data = buildOwnerReportData(db, { from: T0, to: T0 + DAY, includeCustomerPhones: true, now: T0 + DAY });
    const fp = computeFingerprint(data);
    const rec = createReportRecord(db, { kind: 'owner', periodFrom: T0, periodTo: T0 + DAY, fileName: 'r.pdf', summary: data.summary, fingerprint: fp }, T0 + DAY);
    expect(rec.number).toBe(1);
    expect(createReportRecord(db, { kind: 'catalogue' }, T0 + DAY).number).toBe(0);
    expect(unreportedSales(db)).toHaveLength(2);
    markSent(db, rec.id, T0 + DAY + 1);
    expect(unreportedSales(db)).toHaveLength(0);
    expect(lastOwnerReport(db)?.id).toBe(rec.id);
    expect(listReports(db, 'owner')).toHaveLength(1);
    expect(listReports(db)).toHaveLength(2);
    unmarkSent(db, rec.id);
    expect(unreportedSales(db)).toHaveLength(2);
    expect(lastOwnerReport(db)).toBeNull();
  });
});

describe('catalogue data', () => {
  it('hides sold-out, cost and (optionally) rates and counts', () => {
    const { db, a, b, c } = setup();
    const data = buildCatalogueData(db, 'all', { hideSoldOut: true, showRates: false, showCounts: false }, T0);
    expect(data.products.map((p) => p.id).sort()).toEqual([a.productId, b.productId].sort());
    expect(data.products.every((p) => p.ratePaise === null && p.totalPieces === null)).toBe(true);
    expect(JSON.stringify(data)).not.toMatch(/cost/i);
    const stole = data.products.find((p) => p.id === a.productId);
    expect(stole?.colours).toEqual([
      { name: 'Red', hex: '#C0262D', pieces: null },
      { name: 'Beige', hex: '#D8C3A5', pieces: null },
    ]);
    expect(stole?.availability).toEqual({ kind: 'available' });
    expect(data.products.find((p) => p.id === b.productId)?.availability).toEqual({ kind: 'few', count: 1 });
    expect(stole?.cover?.fileName).toBe('Sozni stole-0.jpg');
    const all = buildCatalogueData(db, { productIds: [c.productId, a.productId] }, { hideSoldOut: false, showRates: true, showCounts: true });
    expect(all.products.map((p) => p.id)).toEqual([c.productId, a.productId]);
    expect(all.products[0].availability).toEqual({ kind: 'sold_out' });
    expect(all.products[1].ratePaise).toBe(650_000);
    const mixed = addTestProduct(db, { name: 'Mixed', colours: [{ name: 'Red', hex: '#C0262D', pieces: 3 }, { name: 'Blue', hex: '#2F5DA8', pieces: 0 }] });
    const mixedRow = buildCatalogueData(db, { productIds: [mixed.productId] }, { hideSoldOut: true, showRates: true, showCounts: true }).products[0];
    expect(mixedRow.colours).toEqual([{ name: 'Red', hex: '#C0262D', pieces: 3 }]);
    softDeleteProduct(db, b.productId, T0);
    expect(buildCatalogueData(db, 'all', { hideSoldOut: false, showRates: true, showCounts: false }).products.map((p) => p.id)).not.toContain(b.productId);
  });
});

describe('fingerprint', () => {
  it('is short, stable across key order and sensitive to changes', () => {
    const f1 = computeFingerprint({ a: 1, b: [1, 2, { c: 'x' }] });
    expect(f1).toMatch(/^[0-9a-z]{10}$/);
    expect(computeFingerprint({ b: [1, 2, { c: 'x' }], a: 1 })).toBe(f1);
    expect(computeFingerprint({ a: 2, b: [1, 2, { c: 'x' }] })).not.toBe(f1);
  });
});

describe('home summary', () => {
  it('shows stock, today vs yesterday, attention lists and report status', () => {
    const { db, b, c, cust } = setup();
    const now = T0 + 6000;
    createSale(db, { items: [{ colourId: b.colourIds[0], qty: 1, ratePaise: 4_000_000 }] }, T0 - DAY);
    addFollowUp(db, { customerId: cust, dueAt: now - 1 }, T0);
    const h = homeSummary(db, now, 1);
    expect(h).toMatchObject({ totalPieces: 3, designs: 3, todayPieces: 3, todayAmountPaise: 1_490_000, yesterdayAmountPaise: 4_000_000 });
    expect(h.soldOut.map((p) => p.id).sort()).toEqual([b.productId, c.productId].sort());
    expect(h.lowStock).toEqual([]);
    expect(h.unreportedSalesCount).toBe(3);
    expect(h.lastReportSentAt).toBeNull();
    expect(h.followUpsDue).toHaveLength(1);
  });
});
