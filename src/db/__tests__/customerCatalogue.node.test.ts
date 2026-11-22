import { and, eq } from 'drizzle-orm';

import {
  addToCustomerCatalogue,
  buildCustomerCatalogueData,
  catalogueSnapshot,
  catalogueVersions,
  customerCatalogueProductIds,
  likeAndAddToCatalogue,
  listCustomerCatalogue,
  removeFromCustomerCatalogue,
  reorderCustomerCatalogue,
  restoreCustomerCatalogueItem,
  updateCatalogueItem,
} from '@/db/repo/customerCatalogue';
import { createCustomer, purgeDeletedCustomers, softDeleteCustomer } from '@/db/repo/customers';
import { RepoError } from '@/db/repo/errors';
import { logCatalogueSent } from '@/db/repo/events';
import { purgeDeletedOlderThan, softDeleteProduct } from '@/db/repo/products';
import { createSale } from '@/db/repo/sales';
import { customerCatalogueItems, customerEvents } from '@/db/schema';
import { createTestDb } from '@/test/testDb';

import { addTestProduct, DAY, T0 } from './fixtures';

const OPTIONS = { hideSoldOut: false, showRates: true, showCounts: false };

function setup() {
  const db = createTestDb();
  const stole = addTestProduct(db, { name: 'Sozni stole', ratePaise: 650_000 });
  const shawl = addTestProduct(db, { name: 'Kani shawl', ratePaise: 1_000_000, colours: [{ name: 'Multi', hex: 'multi', pieces: 1 }] });
  const wrap = addTestProduct(db, { name: 'Aari wrap', ratePaise: 320_000 });
  const shah = createCustomer(db, { name: 'Mrs. Shah', phone: '9876543210' }, T0);
  return { db, stole, shawl, wrap, shah };
}

describe('customer catalogue', () => {
  it('adds idempotently, keeps one active row per design, and re-activates a removed one', () => {
    const { db, stole, shah } = setup();
    const id = addToCustomerCatalogue(db, { customerId: shah, productId: stole.productId, specialRatePaise: 600_000, note: ' Her favourite ' }, T0);
    expect(addToCustomerCatalogue(db, { customerId: shah, productId: stole.productId }, T0 + 1)).toBe(id);
    let rows = listCustomerCatalogue(db, shah);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id, normalRatePaise: 650_000, specialRatePaise: 600_000, ratePaise: 600_000, note: 'Her favourite' });

    expect(removeFromCustomerCatalogue(db, id, T0 + 2)).toBe(true);
    expect(removeFromCustomerCatalogue(db, id, T0 + 3)).toBe(false);
    expect(listCustomerCatalogue(db, shah)).toEqual([]);
    expect(addToCustomerCatalogue(db, { customerId: shah, productId: stole.productId }, T0 + 4)).toBe(id);
    rows = listCustomerCatalogue(db, shah);
    expect(rows[0]).toMatchObject({ id, specialRatePaise: 600_000, addedAt: T0 + 4 });
    const all = db
      .select()
      .from(customerCatalogueItems)
      .where(and(eq(customerCatalogueItems.customerId, shah), eq(customerCatalogueItems.productId, stole.productId)))
      .all();
    expect(all).toHaveLength(1);
  });

  it('remove is undoable in place; restore is a no-op once the design was added again', () => {
    const { db, stole, shawl, shah } = setup();
    const a = addToCustomerCatalogue(db, { customerId: shah, productId: stole.productId }, T0);
    addToCustomerCatalogue(db, { customerId: shah, productId: shawl.productId }, T0);
    removeFromCustomerCatalogue(db, a, T0 + 1);
    expect(restoreCustomerCatalogueItem(db, a)).toBe(true);
    expect(listCustomerCatalogue(db, shah).map((r) => r.name)).toEqual(['Sozni stole', 'Kani shawl']);
    expect(restoreCustomerCatalogueItem(db, a)).toBe(false);
  });

  it('validates customers, designs and rates', () => {
    const { db, stole, shah } = setup();
    expect(() => addToCustomerCatalogue(db, { customerId: 'nope', productId: stole.productId })).toThrow(RepoError);
    expect(() => addToCustomerCatalogue(db, { customerId: shah, productId: 'nope' })).toThrow(RepoError);
    expect(() => addToCustomerCatalogue(db, { customerId: shah, productId: stole.productId, specialRatePaise: -1 })).toThrow(RepoError);
    softDeleteProduct(db, stole.productId, T0);
    expect(() => addToCustomerCatalogue(db, { customerId: shah, productId: stole.productId })).toThrow(RepoError);
    expect(() => updateCatalogueItem(db, 'nope', { note: 'x' })).toThrow(RepoError);
  });

  it('updates special rate and note, reorders, and flags sold-out and deleted designs', () => {
    const { db, stole, shawl, wrap, shah } = setup();
    const a = addToCustomerCatalogue(db, { customerId: shah, productId: stole.productId }, T0);
    const b = addToCustomerCatalogue(db, { customerId: shah, productId: shawl.productId }, T0);
    const c = addToCustomerCatalogue(db, { customerId: shah, productId: wrap.productId }, T0);
    updateCatalogueItem(db, b, { specialRatePaise: 900_000, note: 'Wholesale' });
    reorderCustomerCatalogue(db, shah, [c, b, a]);
    createSale(db, { items: [{ colourId: shawl.colourIds[0], qty: 1, ratePaise: 1_000_000 }] }, T0);
    softDeleteProduct(db, wrap.productId, T0);

    const rows = listCustomerCatalogue(db, shah);
    expect(rows.map((r) => r.name)).toEqual(['Aari wrap', 'Kani shawl', 'Sozni stole']);
    expect(rows[0]).toMatchObject({ productDeleted: true, colours: [] });
    expect(rows[1]).toMatchObject({ soldOut: true, status: 'out', ratePaise: 900_000, note: 'Wholesale', totalPieces: 0 });
    expect(rows[2]).toMatchObject({ soldOut: false, totalPieces: 6, ratePaise: 650_000, specialRatePaise: null });
    expect(rows[2].colours.map((col) => col.pieces)).toEqual([4, 2]);
    expect(rows.every((r) => !('costPaise' in r))).toBe(true);

    updateCatalogueItem(db, b, { specialRatePaise: null });
    expect(listCustomerCatalogue(db, shah)[1].ratePaise).toBe(1_000_000);
    expect(customerCatalogueProductIds(db, shah)).toEqual([wrap.productId, shawl.productId, stole.productId]);
  });

  it('builds "their catalogue": special rates substituted and flagged, prepared for them, deleted designs left out', () => {
    const { db, stole, shawl, wrap, shah } = setup();
    addToCustomerCatalogue(db, { customerId: shah, productId: shawl.productId, specialRatePaise: 900_000 }, T0);
    addToCustomerCatalogue(db, { customerId: shah, productId: stole.productId }, T0);
    addToCustomerCatalogue(db, { customerId: shah, productId: wrap.productId }, T0);
    softDeleteProduct(db, wrap.productId, T0);

    const data = buildCustomerCatalogueData(db, shah, OPTIONS, T0);
    expect(data.preparedFor).toBe('Mrs. Shah');
    expect(data.customerId).toBe(shah);
    expect(data.products.map((p) => [p.name, p.ratePaise, p.specialPrice])).toEqual([
      ['Kani shawl', 900_000, true],
      ['Sozni stole', 650_000, false],
    ]);
    expect(JSON.stringify(data)).not.toMatch(/cost/i);

    const hidden = buildCustomerCatalogueData(db, shah, { ...OPTIONS, showRates: false }, T0);
    expect(hidden.products.every((p) => p.ratePaise === null && p.specialPrice === false)).toBe(true);

    createSale(db, { items: [{ colourId: shawl.colourIds[0], qty: 1, ratePaise: 900_000 }] }, T0);
    expect(buildCustomerCatalogueData(db, shah, { ...OPTIONS, hideSoldOut: true }, T0).products.map((p) => p.name)).toEqual(['Sozni stole']);

    softDeleteCustomer(db, shah, T0);
    expect(() => buildCustomerCatalogueData(db, shah, OPTIONS, T0)).toThrow(RepoError);
  });

  it('keeps every version sent with the rates offered', () => {
    const { db, stole, shawl, shah } = setup();
    addToCustomerCatalogue(db, { customerId: shah, productId: shawl.productId, specialRatePaise: 900_000 }, T0);
    const v1 = buildCustomerCatalogueData(db, shah, OPTIONS, T0);
    logCatalogueSent(db, shah, null, v1.products.map((p) => p.id), T0, { items: catalogueSnapshot(v1), personal: true, title: 'For you' });

    addToCustomerCatalogue(db, { customerId: shah, productId: stole.productId, specialRatePaise: 600_000 }, T0 + DAY);
    const v2 = buildCustomerCatalogueData(db, shah, OPTIONS, T0 + DAY);
    logCatalogueSent(db, shah, 'r2', v2.products.map((p) => p.id), T0 + DAY, { items: catalogueSnapshot(v2), personal: true });
    // An ordinary catalogue logged the old way (ids only).
    logCatalogueSent(db, shah, null, [stole.productId], T0 + 2 * DAY);

    const versions = catalogueVersions(db, shah);
    expect(versions.map((v) => v.sentAt)).toEqual([T0 + 2 * DAY, T0 + DAY, T0]);
    expect(versions[0]).toMatchObject({ personal: false, items: [], productIds: [stole.productId] });
    expect(versions[1]).toMatchObject({ personal: true, reportId: 'r2' });
    expect(versions[1].items.map((i) => [i.name, i.ratePaise, i.specialPrice])).toEqual([
      ['Kani shawl', 900_000, true],
      ['Sozni stole', 600_000, true],
    ]);
    expect(versions[2]).toMatchObject({ title: 'For you', items: [{ productId: shawl.productId, name: 'Kani shawl', ratePaise: 900_000, specialPrice: true }] });
  });

  it('Showroom "liked" adds to their catalogue and logs the like in one go', () => {
    const { db, stole, shah } = setup();
    const r = likeAndAddToCatalogue(db, shah, stole.productId, T0);
    expect(r.added).toBe(true);
    expect(listCustomerCatalogue(db, shah).map((x) => x.id)).toEqual([r.itemId]);
    expect(db.select().from(customerEvents).where(eq(customerEvents.id, r.eventId)).get()).toMatchObject({ kind: 'liked_item', refId: stole.productId });
    const again = likeAndAddToCatalogue(db, shah, stole.productId, T0 + 1);
    expect(again).toMatchObject({ itemId: r.itemId, added: false });
  });

  it('purging a customer or a design removes their catalogue rows (no orphans)', () => {
    const { db, stole, shawl, shah } = setup();
    addToCustomerCatalogue(db, { customerId: shah, productId: stole.productId }, T0);
    addToCustomerCatalogue(db, { customerId: shah, productId: shawl.productId }, T0);
    softDeleteProduct(db, stole.productId, T0);
    purgeDeletedOlderThan(db, T0 + 31 * DAY);
    expect(db.select().from(customerCatalogueItems).all().map((r) => r.productId)).toEqual([shawl.productId]);
    softDeleteCustomer(db, shah, T0);
    purgeDeletedCustomers(db, T0 + 31 * DAY);
    expect(db.select().from(customerCatalogueItems).all()).toEqual([]);
  });
});
