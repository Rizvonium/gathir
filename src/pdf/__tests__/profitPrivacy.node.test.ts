/**
 * Buying prices and profit are seller-only (PLAN §3). They appear in the owner report only when the
 * seller turns "report includes profit" on, and never in catalogues, bills or product cards.
 */
import { addTestProduct, T0 } from '@/db/__tests__/fixtures';
import { addToCustomerCatalogue, buildCustomerCatalogueData } from '@/db/repo/customerCatalogue';
import { createCustomer } from '@/db/repo/customers';
import { buildCatalogueData, buildOwnerReportData } from '@/db/repo/reports';
import { createSale, getSale } from '@/db/repo/sales';
import { updateSettings } from '@/db/repo/settings';
import { getShopInfo } from '@/db/repo/shopInfo';
import { colours, products } from '@/db/schema';
import { insertSampleData } from '@/db/sampleData';
import type { DbOrTx } from '@/db/types';
import { buildFlowData } from '@/features/catalogue/logic/flowData';
import { formatINR } from '@/lib/money';
import type { ProductCardData } from '@/share/productCard';
import { createTestDb } from '@/test/testDb';
import { eq } from 'drizzle-orm';

import { billDocFromSale, catalogueDocFromData, ownerReportDocFromData } from '../adapters';
import { renderBillHtml } from '../templates/bill';
import { renderCatalogueHtml } from '../templates/catalogue';
import { renderOwnerReportHtml } from '../templates/ownerReport';
import { billMessage, catalogueMessage, ownerReportMessage } from '../text';

// A buying price no other figure in these documents can match by chance.
const COST = 412_300;
const COST_TEXT = '₹4,123';
const PROFIT_WORDS = /profit|buying price|bought at/i;
/** The printed part of an HTML document (the shared stylesheet may name classes freely). */
const body = (html: string) => html.replace(/<style>[\s\S]*?<\/style>/g, '');

function shop() {
  const db = createTestDb();
  const p = addTestProduct(db, { name: 'Sozni stole', ratePaise: 650_000, costPaise: COST });
  const shah = createCustomer(db, { name: 'Mrs. Shah', phone: '9876543210' }, T0);
  addToCustomerCatalogue(db, { customerId: shah, productId: p.productId, specialRatePaise: 600_000 }, T0);
  const sale = createSale(db, { items: [{ colourId: p.colourIds[0], qty: 2, ratePaise: 650_000 }], discountPaise: 10_000, customerId: shah }, T0);
  return { db, shah, saleId: sale.saleId };
}

function ownerDoc(db: DbOrTx) {
  const data = buildOwnerReportData(db, { from: T0 - 1, to: T0 + 1, includeCustomerPhones: true, now: T0 + 2 });
  return { data, doc: ownerReportDocFromData(data, { appVersion: '1.0.0', fingerprint: 'AB12' }, new Map()) };
}

function customerFacing(db: DbOrTx, shah: string, saleId: string): string[] {
  const layout = { style: 'bazaar' as const, columns: 2 as const, showOnlyLeft: true };
  const options = { hideSoldOut: false, showRates: true, showCounts: true };
  const general = catalogueDocFromData(buildCatalogueData(db, 'all', options, T0), { title: '', layout }, new Map());
  const personal = catalogueDocFromData(buildCustomerCatalogueData(db, shah, options, T0), { title: '', layout }, new Map());
  const detail = getSale(db, saleId);
  if (!detail) throw new Error('sale missing');
  const bill = billDocFromSale(detail, getShopInfo(db));
  return [
    JSON.stringify(general),
    renderCatalogueHtml(general),
    catalogueMessage(general),
    JSON.stringify(personal),
    renderCatalogueHtml(personal),
    catalogueMessage(personal),
    JSON.stringify(bill),
    renderBillHtml(bill),
    billMessage(bill),
  ];
}

describe('profit privacy', () => {
  it('owner report has no buying price or profit while the setting is off (default)', () => {
    const { db } = shop();
    const { data, doc } = ownerDoc(db);
    expect(data.includeProfit).toBe(false);
    expect(data.profit).toBeNull();
    const { includeProfit, profit, ...rest } = data;
    void [includeProfit, profit];
    expect(JSON.stringify(rest)).not.toMatch(/cost|profit/i);
    expect(doc.profit).toBeNull();
    expect(JSON.stringify({ ...doc, profit: undefined })).not.toMatch(/cost|profit/i);
    const html = renderOwnerReportHtml(doc);
    expect(body(html)).not.toMatch(PROFIT_WORDS);
    expect(html).not.toContain(COST_TEXT);
    expect(ownerReportMessage(doc)).not.toMatch(/profit/i);
  });

  it('owner report shows buying price and profit when the seller turns it on', () => {
    const { db } = shop();
    updateSettings(db, { reportIncludesProfit: true }, T0);
    const { data, doc } = ownerDoc(db);
    expect(data.includeProfit).toBe(true);
    // (6,500 − 4,123) × 2 − 100 = ₹4,654
    expect(data.profit?.summary.profitPaise).toBe(465_400);
    expect(data.sales[0]).toMatchObject({ profitPaise: 465_400, items: [{ costPaise: COST, profitPaise: 465_400 }] });
    expect(doc.profit).toMatchObject({ profitPaise: 465_400, unknownCostItems: 0 });
    const html = renderOwnerReportHtml(doc);
    expect(html).toContain('Buying price and profit');
    expect(html).toContain('₹4,654');
    expect(html).toContain(`Bought at ${COST_TEXT}`);
    expect(html.indexOf('Buying price and profit')).toBeGreaterThan(html.indexOf('Summary'));
    expect(html.indexOf('Buying price and profit')).toBeLessThan(html.indexOf('Every sale'));
    const msg = ownerReportMessage(doc).split('\n');
    expect(msg[3]).toBe('Profit: ₹4,654 (36.1%)');
    expect(msg).toHaveLength(6);
  });

  it.each([false, true])('catalogues, their catalogue and bills never show buying price or profit (report profit %s)', (on) => {
    const { db, shah, saleId } = shop();
    updateSettings(db, { reportIncludesProfit: on }, T0);
    for (const text of customerFacing(db, shah, saleId)) {
      expect(text).not.toMatch(/cost|profit|bought at|buying/i);
      expect(text).not.toContain(COST_TEXT);
      expect(text).not.toContain(String(COST));
    }
  });

  it('the product card data type has no place for a buying price or profit', () => {
    type Leaky = Extract<keyof ProductCardData, `${string}ost${string}` | `${string}rofit${string}`>;
    const none: [Leaky] extends [never] ? true : false = true;
    expect(none).toBe(true);
  });

  it('their catalogue shows the special rate with a "Special price for you" tag, only when rates are shown', () => {
    const { db, shah } = shop();
    const layout = { style: 'ivory' as const, columns: 3 as const, showOnlyLeft: true };
    const withRates = catalogueDocFromData(buildCustomerCatalogueData(db, shah, { hideSoldOut: true, showRates: true, showCounts: false }, T0), { title: '', layout }, new Map());
    expect(withRates.customerName).toBe('Mrs. Shah');
    expect(withRates.items[0]).toMatchObject({ ratePaise: 600_000, specialPrice: true });
    const html = renderCatalogueHtml(withRates);
    expect(html).toContain('₹6,000');
    expect(html).not.toContain('₹6,500');
    expect(html).toContain('Special price for you');
    expect(html).toContain('Prepared for Mrs. Shah');

    const noRates = catalogueDocFromData(buildCustomerCatalogueData(db, shah, { hideSoldOut: true, showRates: false, showCounts: false }, T0), { title: '', layout }, new Map());
    expect(renderCatalogueHtml(noRates)).not.toContain('Special price');
    expect(renderCatalogueHtml(noRates)).not.toContain('₹');
  });

  it.each([false, true])('the whole sample shop, with a buying price on every design and colour, leaks none to customers (report profit %s)', (on) => {
    const db = createTestDb();
    const now = T0;
    const { productIds, saleIds } = insertSampleData(db, now);
    updateSettings(db, { reportIncludesProfit: on }, now);
    // Odd rupee amounts no rate or total in the sample shop uses.
    const costs = new Set<number>();
    productIds.forEach((id, i) => {
      const cost = 413_700 + i * 1_100;
      costs.add(cost);
      db.update(products).set({ costPaise: cost }).where(eq(products.id, id)).run();
      db.select({ id: colours.id }).from(colours).where(eq(colours.productId, id)).all().forEach((c, j) => {
        const colourCost = cost + 300 + j * 100;
        costs.add(colourCost);
        db.update(colours).set({ costPaise: colourCost }).where(eq(colours.id, c.id)).run();
      });
    });
    const shah = createCustomer(db, { name: 'Mrs. Shah', phone: '9876543210' }, now);
    productIds.forEach((productId, i) =>
      addToCustomerCatalogue(db, { customerId: shah, productId, specialRatePaise: i % 2 ? 555_500 : null, note: 'Wedding' }, now),
    );
    const firstColour = db.select({ id: colours.id }).from(colours).where(eq(colours.productId, productIds[0])).all()[0].id;
    const sale = createSale(db, { items: [{ colourId: firstColour, qty: 1, ratePaise: 999_900 }], customerId: shah }, now);

    const layout = { style: 'bazaar' as const, columns: 2 as const, showOnlyLeft: true };
    const options = { hideSoldOut: false, showRates: true, showCounts: true };
    const datas = [buildFlowData(db, 'all', options, now), buildFlowData(db, { customerCatalogue: shah }, options, now)];
    const texts: string[] = [];
    for (const data of datas) {
      const doc = catalogueDocFromData(data, { title: '', layout }, new Map());
      texts.push(JSON.stringify(data), JSON.stringify(doc), renderCatalogueHtml(doc), catalogueMessage(doc));
    }
    for (const id of [...saleIds, sale.saleId]) {
      const detail = getSale(db, id);
      if (!detail) continue;
      const bill = billDocFromSale(detail, getShopInfo(db));
      texts.push(JSON.stringify(bill), renderBillHtml(bill), billMessage(bill));
    }
    expect(texts.length).toBeGreaterThan(8);
    for (const text of texts) {
      expect(body(text)).not.toMatch(/cost|profit|bought at|buying|margin/i);
      for (const cost of costs) {
        expect(text).not.toContain(formatINR(cost));
        expect(text).not.toContain(String(cost));
      }
    }
  });
});
