/**
 * "Try with sample products": realistic demo stock, customers and sales that can be
 * cleared with one tap. Sample products have isSample = true, sample customers have ids
 * starting with SAMPLE_ID_PREFIX, and sample sales use "S-" bill numbers.
 */
import { eq, inArray, like } from 'drizzle-orm';

import { addDays } from '@/lib/dates';
import { newId } from '@/lib/ids';

import { createCustomer, eraseCustomers } from './repo/customerWrites';
import { addFollowUp, addNote } from './repo/events';
import { createProduct, type ColourInput } from './repo/productWrites';
import { cancelSale, createSale } from './repo/saleWrites';
import { categories, colours, customerCatalogueItems, customers, photos, products, saleItems, sales, stockMoves, type CustomerTag, type PaymentMethod } from './schema';
import { applyMove } from './stock';
import type { DbOrTx } from './types';

export const SAMPLE_ID_PREFIX = 'sample_';
const HOUR = 3_600_000;

type SampleProduct = {
  name: string;
  category: string;
  craft: string;
  material: string;
  size: string;
  rupees: number;
  colours: [name: string, hex: string, pieces: number][];
  oneOfAKind?: boolean;
};

const PRODUCTS: SampleProduct[] = [
  { name: 'Sozni Pashmina Stole', category: 'Stoles', craft: 'Sozni', material: 'Pashmina', size: 'Stole (70×200)', rupees: 6500, colours: [['Maroon', '#6D1A24', 4], ['Beige', '#D8C3A5', 3], ['Black', '#1B1B1B', 2]] },
  { name: 'Kani Jamawar Shawl', category: 'Kani', craft: 'Kani', material: 'Pashmina', size: 'Shawl (100×200)', rupees: 85000, colours: [['Multicolour', 'multi', 1]], oneOfAKind: true },
  { name: 'Aari Embroidered Wool Shawl', category: 'Aari', craft: 'Aari', material: 'Wool', size: 'Shawl (100×200)', rupees: 3200, colours: [['Grey', '#8E8E93', 5], ['Navy', '#1F2A56', 4], ['Red', '#C0262D', 3], ['Cream', '#F3E9D2', 2]] },
  { name: 'Tilla Pheran', category: 'Pherans', craft: 'Tilla', material: 'Wool', size: 'Free size', rupees: 7800, colours: [['Maroon', '#6D1A24', 2], ['Teal', '#0B6E77', 1]] },
  { name: 'Plain Pashmina Shawl', category: 'Pashmina', craft: 'Plain', material: 'Pashmina', size: 'Shawl (100×200)', rupees: 18500, colours: [['Beige', '#D8C3A5', 3], ['Brown', '#6F4E37', 2], ['White', '#FAFAF7', 1]] },
  { name: 'Sozni Border Shawl', category: 'Sozni', craft: 'Sozni', material: 'Pashmina', size: 'Shawl (100×200)', rupees: 32000, colours: [['Black', '#1B1B1B', 2], ['Mustard', '#D4A017', 1]] },
  { name: 'Raffal Aari Stole', category: 'Stoles', craft: 'Aari', material: 'Raffal', size: 'Stole (70×200)', rupees: 1800, colours: [['Pink', '#E38AAE', 6], ['Blue', '#2F5DA8', 5], ['Green', '#2E7D4F', 4]] },
  { name: 'Papier-mâché Jewellery Box', category: 'Papier-mâché', craft: 'Papier-mâché', material: 'Other', size: 'Other', rupees: 2400, colours: [['Rani pink', '#C2185B', 3], ['Navy', '#1F2A56', 2]] },
  { name: 'Silk Kani Stole', category: 'Kani', craft: 'Kani', material: 'Silk', size: 'Stole (70×200)', rupees: 12500, colours: [['Purple', '#5E3A8C', 2], ['Orange', '#E4572E', 1]] },
  { name: 'Jamawar Wool Shawl', category: 'Shawls', craft: 'Jamawar', material: 'Wool', size: 'Large (140×280)', rupees: 9800, colours: [['Red', '#C0262D', 2], ['Green', '#2E7D4F', 2], ['Black', '#1B1B1B', 1]] },
  { name: 'Printed Cotton Stole', category: 'Stoles', craft: 'Printed', material: 'Cotton', size: 'Stole (70×200)', rupees: 1900, colours: [['Mustard', '#D4A017', 4], ['Teal', '#0B6E77', 3]] },
  { name: 'Pashmina Muffler', category: 'Pashmina', craft: 'Plain', material: 'Pashmina', size: 'Muffler', rupees: 4500, colours: [['Grey', '#8E8E93', 1]] },
];

const CUSTOMERS: { name: string; phone: string; city: string; tag: CustomerTag; crafts: string[]; colours: string[] }[] = [
  { name: 'Mrs. Shah', phone: '+919906000101', city: 'Srinagar', tag: 'regular', crafts: ['Sozni'], colours: ['maroon'] },
  { name: 'Rahul Mehta', phone: '+919906000102', city: 'Delhi', tag: 'tourist', crafts: [], colours: [] },
  { name: 'Valley Crafts (dealer)', phone: '+919906000103', city: 'Jammu', tag: 'wholesale', crafts: ['Aari'], colours: [] },
  { name: 'Anita Kaul', phone: '+919906000104', city: 'Mumbai', tag: 'regular', crafts: ['Kani'], colours: ['beige'] },
];

/** [daysAgo, hour, product index, colour index, qty, customer index | null, payment, discount ₹] */
const SALES: [number, number, number, number, number, number | null, PaymentMethod, number][] = [
  [13, 11, 0, 0, 1, 0, 'upi', 0],
  [12, 16, 2, 0, 2, null, 'cash', 200],
  [11, 13, 6, 0, 3, 1, 'cash', 0],
  [10, 12, 4, 0, 1, 3, 'upi', 500],
  [9, 18, 2, 1, 4, 2, 'upi', 800],
  [8, 15, 0, 1, 1, null, 'card', 0],
  [7, 11, 7, 0, 1, 1, 'cash', 0],
  [6, 17, 9, 0, 1, 0, 'upi', 0],
  [5, 14, 10, 0, 2, null, 'cash', 0],
  [4, 12, 3, 0, 1, 3, 'card', 0],
  [3, 16, 6, 1, 2, null, 'upi', 0],
  [2, 13, 5, 0, 1, 0, 'upi', 2000],
  [1, 11, 11, 0, 1, null, 'cash', 0],
  [1, 17, 8, 0, 1, 3, 'upi', 0],
  [0, 10, 0, 2, 1, null, 'cash', 0],
];
/** Index into SALES of the sale that is later returned. */
const RETURNED_SALE = 5;

/** Inserts sample products, customers and ~15 sales over the past two weeks (one returned). */
export function insertSampleData(db: DbOrTx, now: number = Date.now()): { productIds: string[]; customerIds: string[]; saleIds: string[] } {
  return db.transaction((tx) => {
    const catByName = new Map(
      tx
        .select({ id: categories.id, name: categories.name })
        .from(categories)
        .all()
        .map((c) => [c.name, c.id]),
    );
    const created = addDays(now, -20);
    const productRefs = PRODUCTS.map((p, i) => {
      const cols: ColourInput[] = p.colours.map(([name, hex, pieces]) => ({ name, hex, pieces }));
      const { productId } = createProduct(
        tx,
        {
          fields: {
            name: p.name,
            categoryId: catByName.get(p.category) ?? null,
            craft: p.craft,
            material: p.material,
            size: p.size,
            ratePaise: p.rupees * 100,
            oneOfAKind: p.oneOfAKind ?? false,
            isSample: true,
            code: `SMP-${String(i + 1).padStart(3, '0')}`,
          },
          colours: cols,
          photos: [],
        },
        created + i * HOUR,
      );
      const colourIds = tx
        .select({ id: colours.id })
        .from(colours)
        .where(eq(colours.productId, productId))
        .orderBy(colours.sortOrder)
        .all()
        .map((c) => c.id);
      return { productId, colourIds, ratePaise: p.rupees * 100 };
    });

    const customerIds = CUSTOMERS.map((c, i) =>
      createCustomer(
        tx,
        { name: c.name, phone: c.phone, whatsappOk: true, city: c.city, tag: c.tag, likes: { colours: c.colours, crafts: c.crafts } },
        addDays(now, -18) + i * HOUR,
        { id: `${SAMPLE_ID_PREFIX}${newId()}` },
      ),
    );

    const saleIds = SALES.map(([daysAgo, hour, pi, ci, qty, cust, payment, discount], i) => {
      const day = new Date(addDays(now, -daysAgo));
      day.setHours(hour, 0, 0, 0);
      const at = Math.min(day.getTime(), now - (SALES.length - i) * 60_000);
      const ref = productRefs[pi];
      return createSale(
        tx,
        {
          items: [{ colourId: ref.colourIds[ci], qty, ratePaise: ref.ratePaise }],
          payment,
          discountPaise: discount * 100,
          customerId: cust === null ? null : customerIds[cust],
          billNo: `S-${String(i + 1).padStart(4, '0')}`,
        },
        at,
      ).saleId;
    });
    cancelSale(tx, saleIds[RETURNED_SALE], addDays(now, -7));

    addNote(tx, customerIds[0], 'Prefers deep reds. Visits before Eid.', addDays(now, -10));
    addFollowUp(tx, { customerId: customerIds[3], dueAt: now, note: 'New Kani arrived: tell her' }, addDays(now, -3));
    return { productIds: productRefs.map((p) => p.productId), customerIds, saleIds };
  });
}

/** True when any sample product exists (to show "Clear sample data"). */
export function hasSampleData(db: DbOrTx): boolean {
  return !!db.select({ id: products.id }).from(products).where(eq(products.isSample, true)).get();
}

/**
 * Removes all sample data in one transaction: sample products (with colours, photos and
 * moves), every sale containing a sample product, and sample customers with their events.
 * Real products in a removed mixed sale get their pieces back with a 'correction' move;
 * real-product sales to sample customers stay (only the customer is erased).
 */
export function clearSampleData(db: DbOrTx): { products: number; sales: number; customers: number } {
  return db.transaction((tx) => {
    const productIds = tx
      .select({ id: products.id })
      .from(products)
      .where(eq(products.isSample, true))
      .all()
      .map((p) => p.id);
    const customerIds = tx
      .select({ id: customers.id })
      .from(customers)
      .where(like(customers.id, `${SAMPLE_ID_PREFIX}%`))
      .all()
      .map((c) => c.id);
    const sampleSet = new Set(productIds);
    const saleIds =
      productIds.length === 0
        ? []
        : [
            ...new Set(
              tx
                .select({ id: saleItems.saleId })
                .from(saleItems)
                .where(inArray(saleItems.productId, productIds))
                .all()
                .map((r) => r.id),
            ),
          ];
    if (saleIds.length > 0) {
      const realMoves = tx
        .select()
        .from(stockMoves)
        .where(inArray(stockMoves.saleId, saleIds))
        .all()
        .filter((m) => !sampleSet.has(m.productId));
      const net = new Map<string, number>();
      for (const m of realMoves) net.set(m.colourId, (net.get(m.colourId) ?? 0) + m.delta);
      for (const [colourId, delta] of net) {
        if (delta !== 0) applyMove(tx, { colourId, delta: -delta, reason: 'correction', note: 'Sample sale cleared' });
      }
      tx.update(stockMoves).set({ saleId: null }).where(inArray(stockMoves.saleId, saleIds)).run();
      tx.delete(saleItems).where(inArray(saleItems.saleId, saleIds)).run();
      tx.delete(sales).where(inArray(sales.id, saleIds)).run();
    }
    eraseCustomers(tx, customerIds);
    if (productIds.length > 0) {
      tx.delete(stockMoves).where(inArray(stockMoves.productId, productIds)).run();
      tx.delete(customerCatalogueItems).where(inArray(customerCatalogueItems.productId, productIds)).run();
      tx.delete(colours).where(inArray(colours.productId, productIds)).run();
      tx.delete(photos).where(inArray(photos.productId, productIds)).run();
      tx.delete(products).where(inArray(products.id, productIds)).run();
    }
    return { products: productIds.length, sales: saleIds.length, customers: customerIds.length };
  });
}
