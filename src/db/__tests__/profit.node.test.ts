import { createCategory } from '@/db/repo/categories';
import { createCustomer } from '@/db/repo/customers';
import { homeSummary } from '@/db/repo/dashboard';
import { renameColour, softDeleteProduct, updateProduct } from '@/db/repo/products';
import {
  allocateDiscount,
  computeSaleProfit,
  effectiveCost,
  marginPct,
  productProfit,
  profitBreakdown,
  profitBreakdowns,
  profitSummary,
  stockValues,
} from '@/db/repo/profit';
import { cancelSale, createSale, getSale, listSales, salesSummary } from '@/db/repo/sales';
import { createTestDb } from '@/test/testDb';

import { addTestProduct, DAY, T0 } from './fixtures';

describe('profit maths (pure)', () => {
  it('effective cost: colour override, else product, else unknown', () => {
    expect(effectiveCost(500, 400)).toBe(500);
    expect(effectiveCost(null, 400)).toBe(400);
    expect(effectiveCost(undefined, null)).toBeNull();
  });

  it('allocates a discount in proportion, whole paise, adding up exactly', () => {
    expect(allocateDiscount([100, 200], 30)).toEqual([10, 20]);
    const shares = allocateDiscount([1, 1, 1], 100);
    expect(shares.reduce((s, x) => s + x, 0)).toBe(100);
    expect(shares.sort()).toEqual([33, 33, 34]);
    expect(allocateDiscount([0, 0], 5)).toEqual([5, 0]);
    expect(allocateDiscount([], 5)).toEqual([]);
  });

  it('profit = (rate − cost) × qty − discount', () => {
    const p = computeSaleProfit({
      discountPaise: 50_000,
      items: [
        { qty: 2, ratePaise: 650_000, costPaise: 400_000 },
        { qty: 1, ratePaise: 600_000, costPaise: 450_000 },
      ],
    });
    // (2×2,50,000 + 1,50,000) − 50,000 = 6,00,000
    expect(p.fullProfitPaise).toBe(600_000);
    expect(p.profitPaise).toBe(600_000);
    expect(p.revenuePaise).toBe(1_850_000);
    expect(p.knownCostPaise).toBe(1_250_000);
    expect(p.marginPct).toBe(marginPct(600_000, 1_850_000));
    expect(p.lines.map((l) => l.discountSharePaise)).toEqual([34_211, 15_789]);
  });

  it('an item without a buying price is "profit unknown", never 100 % profit', () => {
    const p = computeSaleProfit({
      discountPaise: 30_000,
      items: [
        { qty: 1, ratePaise: 100_000, costPaise: 60_000 },
        { qty: 1, ratePaise: 200_000, costPaise: null },
      ],
    });
    expect(p.fullProfitPaise).toBeNull();
    expect(p.unknownCostItems).toBe(1);
    // Known item: revenue 1,00,000 − its share of the discount (10,000) − cost 60,000.
    expect(p.profitPaise).toBe(30_000);
    expect(p.knownRevenuePaise).toBe(90_000);
    expect(p.revenuePaise).toBe(270_000);
    expect(p.lines[1].profitPaise).toBeNull();
    expect(marginPct(0, 0)).toBeNull();
  });
});

describe('profit from the database', () => {
  function shop() {
    const db = createTestDb();
    const stoles = createCategory(db, { name: 'Stoles' }, T0);
    const shawls = createCategory(db, { name: 'Shawls' }, T0);
    const a = addTestProduct(db, { name: 'Sozni stole', ratePaise: 650_000, costPaise: 400_000, categoryId: stoles });
    const b = addTestProduct(db, { name: 'Kani shawl', ratePaise: 1_000_000, costPaise: null, categoryId: shawls });
    const shah = createCustomer(db, { name: 'Mrs. Shah', phone: '9876543210' }, T0);
    return { db, a, b, shah, stoles, shawls };
  }

  it('createSale snapshots the effective buying price, including a per-colour override', () => {
    const { db, a, b } = shop();
    renameColour(db, a.colourIds[1], { costPaise: 450_000 }, T0);
    const sale = createSale(
      db,
      {
        items: [
          { colourId: a.colourIds[0], qty: 1, ratePaise: 650_000 },
          { colourId: a.colourIds[1], qty: 1, ratePaise: 650_000 },
          { colourId: b.colourIds[0], qty: 1, ratePaise: 1_000_000 },
        ],
      },
      T0,
    );
    const detail = getSale(db, sale.saleId);
    expect(detail?.items.map((i) => i.costPaiseSnapshot)).toEqual([400_000, 450_000, null]);
    expect(detail?.profit.fullProfitPaise).toBeNull();
    expect(detail?.profit.profitPaise).toBe(250_000 + 200_000);
    expect(detail?.profit.unknownCostItems).toBe(1);

    // Later price changes never change past profit.
    updateProduct(db, a.productId, { costPaise: 600_000 }, T0 + 1);
    expect(getSale(db, sale.saleId)?.profit.profitPaise).toBe(450_000);
  });

  it('updateProduct sets product and per-colour buying prices', () => {
    const { db, a } = shop();
    updateProduct(db, a.productId, { costPaise: 350_000, colourCosts: { [a.colourIds[0]]: 300_000 } }, T0);
    const s1 = createSale(db, { items: [{ colourId: a.colourIds[0], qty: 1, ratePaise: 650_000 }] }, T0);
    const s2 = createSale(db, { items: [{ colourId: a.colourIds[1], qty: 1, ratePaise: 650_000 }] }, T0);
    expect(getSale(db, s1.saleId)?.items[0].costPaiseSnapshot).toBe(300_000);
    expect(getSale(db, s2.saleId)?.items[0].costPaiseSnapshot).toBe(350_000);
    updateProduct(db, a.productId, { colourCosts: { [a.colourIds[0]]: null } }, T0);
    const s3 = createSale(db, { items: [{ colourId: a.colourIds[0], qty: 1, ratePaise: 650_000 }] }, T0);
    expect(getSale(db, s3.saleId)?.items[0].costPaiseSnapshot).toBe(350_000);
    expect(() => updateProduct(db, a.productId, { colourCosts: { nope: 1 } }, T0)).toThrow();
  });

  it('period summary: discounts, unknown cost and cancelled sales', () => {
    const { db, a, b, shah } = shop();
    // Day 1: 2 stoles to Mrs. Shah with ₹500 off → profit 5,00,000 − 50,000.
    createSale(db, { items: [{ colourId: a.colourIds[0], qty: 2, ratePaise: 650_000 }], discountPaise: 50_000, customerId: shah }, T0);
    // Day 2: a Kani shawl without buying price (walk-in).
    createSale(db, { items: [{ colourId: b.colourIds[0], qty: 1, ratePaise: 1_000_000 }] }, T0 + DAY);
    // Day 2: a stole, later returned → excluded.
    const returned = createSale(db, { items: [{ colourId: a.colourIds[1], qty: 1, ratePaise: 650_000 }] }, T0 + DAY + 1);
    cancelSale(db, returned.saleId, T0 + DAY + 2);

    const range = { from: T0 - DAY, to: T0 + 2 * DAY };
    const sum = profitSummary(db, range);
    expect(sum).toMatchObject({
      revenuePaise: 1_250_000 + 1_000_000,
      knownRevenuePaise: 1_250_000,
      knownCostPaise: 800_000,
      profitPaise: 450_000,
      marginPct: 36,
      unknownCostItems: 1,
      salesCount: 2,
      pieces: 3,
    });
    const ss = salesSummary(db, range);
    expect(ss).toMatchObject({ profitPaise: 450_000, knownCostPaise: 800_000, marginPct: 36, unknownCostItems: 1 });

    const rows = listSales(db, range);
    const byId = new Map(rows.map((r) => [r.billNo, r]));
    expect(byId.get('B-2026-0001')).toMatchObject({ profitPaise: 450_000, knownProfitPaise: 450_000, unknownCostItems: 0 });
    expect(byId.get('B-2026-0002')).toMatchObject({ profitPaise: null, knownProfitPaise: 0, unknownCostItems: 1 });

    const b2 = profitBreakdowns(db, range);
    expect(b2.summary).toEqual(sum);
    expect(b2.byDay.map((d) => [d.at, d.profitPaise, d.unknownCostItems])).toEqual([
      [new Date(2026, 10, 10).getTime(), 450_000, 0],
      [new Date(2026, 10, 11).getTime(), 0, 1],
    ]);
    expect(b2.byProduct.map((p) => [p.label, p.profitPaise, p.salesCount])).toEqual([
      ['Sozni stole', 450_000, 1],
      ['Kani shawl', 0, 1],
    ]);
    expect(b2.byCategory.map((c) => [c.label, c.profitPaise, c.unknownCostItems])).toEqual([
      ['Stoles', 450_000, 0],
      ['Shawls', 0, 1],
    ]);
    expect(b2.byCustomer.map((c) => [c.key, c.label, c.profitPaise])).toEqual([
      [shah, 'Mrs. Shah', 450_000],
      ['', null, 0],
    ]);
    expect(profitBreakdown(db, range, 'month')).toHaveLength(1);
    expect(profitBreakdown(db, range, 'week').reduce((s, w) => s + w.profitPaise, 0)).toBe(450_000);
  });

  it('a discount is shared, so mixed bills count only the known items’ profit', () => {
    const { db, a, b } = shop();
    // Gross 6,50,000 + 10,00,000; ₹1,650 off → stole's share 65,000.
    createSale(
      db,
      {
        items: [
          { colourId: a.colourIds[0], qty: 1, ratePaise: 650_000 },
          { colourId: b.colourIds[0], qty: 1, ratePaise: 1_000_000 },
        ],
        discountPaise: 165_000,
      },
      T0,
    );
    const sum = profitSummary(db, { from: T0, to: T0 });
    expect(sum.profitPaise).toBe(650_000 - 65_000 - 400_000);
    expect(sum.unknownCostItems).toBe(1);
    expect(sum.revenuePaise).toBe(1_485_000);
  });

  it('product profit earned, stock values and Home', () => {
    const { db, a, b } = shop();
    createSale(db, { items: [{ colourId: a.colourIds[0], qty: 1, ratePaise: 600_000 }] }, T0);
    const r = createSale(db, { items: [{ colourId: a.colourIds[0], qty: 1, ratePaise: 650_000 }] }, T0);
    cancelSale(db, r.saleId, T0 + 1);
    expect(productProfit(db, a.productId)).toMatchObject({ profitPaise: 200_000, pieces: 1, salesCount: 1, unknownCostItems: 0 });
    expect(productProfit(db, b.productId)).toMatchObject({ profitPaise: 0, pieces: 0, salesCount: 0 });

    // a: 5 pieces left × 4,00,000; b: 6 pieces without a buying price.
    expect(stockValues(db)).toEqual({ atRatePaise: 5 * 650_000 + 6 * 1_000_000, atCostPaise: 5 * 400_000, unknownCostPieces: 6, totalPieces: 11 });
    renameColour(db, a.colourIds[1], { costPaise: 500_000 }, T0);
    expect(stockValues(db).atCostPaise).toBe(3 * 400_000 + 2 * 500_000);

    const home = homeSummary(db, T0, 1);
    expect(home.stockValuePaise).toBe(5 * 650_000 + 6 * 1_000_000);
    expect(home.stockValueAtCostPaise).toBe(3 * 400_000 + 2 * 500_000);
    expect(home.stockCostUnknownPieces).toBe(6);
    expect(home.todayProfitPaise).toBe(200_000);
    expect(home.todayProfitUnknownItems).toBe(0);

    softDeleteProduct(db, b.productId, T0);
    expect(stockValues(db).unknownCostPieces).toBe(0);
  });
});
