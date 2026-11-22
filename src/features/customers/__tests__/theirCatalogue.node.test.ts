import { addTestProduct, T0 } from '@/db/__tests__/fixtures';
import { addToCustomerCatalogue, catalogueVersions, listCustomerCatalogue, updateCatalogueItem } from '@/db/repo/customerCatalogue';
import type { CatalogueVersion, CustomerCatalogueRow } from '@/db/repo/customerCatalogue';
import { createCustomer } from '@/db/repo/customers';
import { recordCorrection } from '@/db/stock';
import { buildFlowData, isPersonalData, sentSnapshot } from '@/features/catalogue/logic/flowData';
import { recordCatalogueSent } from '@/features/catalogue/logic/record';
import { initialSource, isCustomerCatalogue, selectionKey, toSelection } from '@/features/catalogue/logic/selection';
import { createTestDb } from '@/test/testDb';

import {
  filterPickerProducts,
  idsToAdd,
  itemAvailability,
  moveItem,
  specialRateOffPct,
  specialRateToSave,
  theirCatalogueCounts,
  versionCounts,
} from '../logic/theirCatalogue';

function row(o: Partial<CustomerCatalogueRow> = {}): CustomerCatalogueRow {
  return {
    id: 'i1',
    productId: 'p1',
    code: 'GTH-0001',
    name: 'Kani shawl',
    craft: 'Kani',
    material: '',
    categoryName: null,
    coverThumb: null,
    coverFile: null,
    normalRatePaise: 1_000_000,
    specialRatePaise: null,
    ratePaise: 1_000_000,
    note: '',
    sortOrder: 0,
    addedAt: 0,
    colours: [],
    totalPieces: 3,
    status: 'in',
    soldOut: false,
    productDeleted: false,
    ...o,
  };
}

describe('their catalogue logic', () => {
  it('moves an item up or down and ignores moves past the ends', () => {
    expect(moveItem(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c']);
    expect(moveItem(['a', 'b', 'c'], 'b', 1)).toEqual(['a', 'c', 'b']);
    expect(moveItem(['a', 'b', 'c'], 'a', -1)).toEqual(['a', 'b', 'c']);
    expect(moveItem(['a', 'b', 'c'], 'c', 1)).toEqual(['a', 'b', 'c']);
    expect(moveItem(['a', 'b'], 'x', 1)).toEqual(['a', 'b']);
  });

  it('counts sold-out and deleted pieces apart from the ones that go in the PDF', () => {
    const rows = [
      row({ id: 'a', specialRatePaise: 900_000 }),
      row({ id: 'b', soldOut: true, totalPieces: 0, status: 'out' }),
      row({ id: 'c', productDeleted: true, soldOut: true, totalPieces: 0 }),
    ];
    expect(theirCatalogueCounts(rows)).toEqual({ total: 3, soldOut: 1, deleted: 1, withSpecialRate: 1, sendable: 1, sendableWithSoldOut: 2 });
    expect(rows.map(itemAvailability)).toEqual(['in', 'out', 'deleted']);
    expect(itemAvailability(row({ status: 'low' }))).toBe('low');
  });

  it('works out the discount and what special rate to save', () => {
    expect(specialRateOffPct(1_000_000, 900_000)).toBe(10);
    expect(specialRateOffPct(1_000_000, 1_100_000)).toBe(-10);
    expect(specialRateOffPct(1_000_000, null)).toBeNull();
    expect(specialRateOffPct(0, 500)).toBeNull();
    expect(specialRateToSave(1_000_000, 900_000)).toBe(900_000);
    expect(specialRateToSave(1_000_000, 1_000_000)).toBeNull();
    expect(specialRateToSave(1_000_000, null)).toBeNull();
    expect(specialRateToSave(1_000_000, 0)).toBeNull();
  });

  it('filters the picker by category and text, and skips designs already added', () => {
    const products = [
      { id: 'p1', name: 'Maroon Kani', code: 'GTH-0001', craft: 'Kani', categoryId: 'shawls' },
      { id: 'p2', name: 'Blue stole', code: 'GTH-0002', craft: 'Sozni', categoryId: 'stoles' },
    ];
    expect(filterPickerProducts(products, { search: 'kani', categoryId: null }).map((p) => p.id)).toEqual(['p1']);
    expect(filterPickerProducts(products, { search: '0002', categoryId: null }).map((p) => p.id)).toEqual(['p2']);
    expect(filterPickerProducts(products, { search: '', categoryId: 'stoles' }).map((p) => p.id)).toEqual(['p2']);
    expect(filterPickerProducts(products, { search: 'sozni', categoryId: 'shawls' })).toEqual([]);
    expect(idsToAdd(['p2', 'p1', 'p2'], new Set(['p1']))).toEqual(['p2']);
  });

  it('counts the designs of a sent version, falling back to ids for older sends', () => {
    const v: CatalogueVersion = {
      eventId: 'e',
      sentAt: 0,
      reportId: null,
      personal: true,
      title: '',
      productIds: ['a', 'b'],
      items: [
        { productId: 'a', name: 'A', ratePaise: 1, specialPrice: true },
        { productId: 'b', name: 'B', ratePaise: 2, specialPrice: false },
      ],
    };
    expect(versionCounts(v)).toEqual({ items: 2, special: 1 });
    expect(versionCounts({ ...v, items: [] })).toEqual({ items: 2, special: 0 });
  });
});

describe('catalogue flow: their catalogue', () => {
  it('opens on the customer catalogue only with mode=customer and a customer', () => {
    expect(initialSource({ customerId: 'c1', mode: 'customer' }).kind).toBe('customer');
    expect(initialSource({ mode: 'customer' }).kind).toBe('all');
    expect(initialSource({ customerId: 'c1' }).kind).toBe('suggested');
    const source = initialSource({ customerId: 'c1', mode: 'customer' });
    expect(toSelection(source, [], 'c1')).toEqual({ customerCatalogue: 'c1' });
    expect(toSelection(source, [], null)).toBeNull();
    expect(isCustomerCatalogue({ customerCatalogue: 'c1' })).toBe(true);
    expect(isCustomerCatalogue('all')).toBe(false);
    expect(selectionKey({ customerCatalogue: 'c1' })).not.toBe(selectionKey({ productIds: ['c1'] }));
  });

  it('builds the PDF data with their rates, leaves sold-out out by default, and logs the version sent', () => {
    const db = createTestDb();
    const customerId = createCustomer(db, { name: 'Mrs Shah', phone: '+919876543210' }, T0);
    const a = addTestProduct(db, { name: 'Maroon Kani', ratePaise: 1_000_000 });
    const b = addTestProduct(db, { name: 'Blue stole', ratePaise: 500_000 });
    const sold = addTestProduct(db, { name: 'Gone shawl', colours: [{ name: 'Red', hex: '#C0262D', pieces: 1 }] });
    const itemA = addToCustomerCatalogue(db, { customerId, productId: a.productId }, T0);
    addToCustomerCatalogue(db, { customerId, productId: b.productId }, T0);
    addToCustomerCatalogue(db, { customerId, productId: sold.productId }, T0);
    updateCatalogueItem(db, itemA, { specialRatePaise: 900_000 });
    recordCorrection(db, sold.colourIds[0], 0);

    const rows = listCustomerCatalogue(db, customerId);
    expect(theirCatalogueCounts(rows)).toMatchObject({ total: 3, soldOut: 1, sendable: 2 });

    const options = { hideSoldOut: true, showRates: true, showCounts: false };
    const data = buildFlowData(db, { customerCatalogue: customerId }, options, T0);
    expect(isPersonalData(data)).toBe(true);
    expect(data.preparedFor).toBe('Mrs Shah');
    expect(data.products.map((p) => [p.name, p.ratePaise, p.specialPrice])).toEqual([
      ['Maroon Kani', 900_000, true],
      ['Blue stole', 500_000, false],
    ]);
    // The sold-out piece can be included with the toggle.
    expect(buildFlowData(db, { customerCatalogue: customerId }, { ...options, hideSoldOut: false }, T0).products).toHaveLength(3);
    // A plain selection never becomes personal.
    expect(isPersonalData(buildFlowData(db, { productIds: [a.productId] }, options, T0))).toBe(false);

    const sentIds = data.products.map((p) => p.id);
    recordCatalogueSent(
      db,
      { customerId, productIds: sentIds, fileName: 'c.pdf', title: 'Chosen for you', parts: 1, snapshot: { items: sentSnapshot(data, sentIds), personal: true } },
      T0 + 1,
    );
    const [version] = catalogueVersions(db, customerId);
    expect(version).toMatchObject({ personal: true, title: 'Chosen for you', productIds: sentIds });
    expect(version.items).toEqual([
      { productId: a.productId, name: 'Maroon Kani', ratePaise: 900_000, specialPrice: true },
      { productId: b.productId, name: 'Blue stole', ratePaise: 500_000, specialPrice: false },
    ]);
  });

  it('keeps only the designs actually sent in the snapshot, in sent order', () => {
    const db = createTestDb();
    const customerId = createCustomer(db, { name: 'Rafiq' }, T0);
    const a = addTestProduct(db, { name: 'A' });
    const b = addTestProduct(db, { name: 'B' });
    addToCustomerCatalogue(db, { customerId, productId: a.productId }, T0);
    addToCustomerCatalogue(db, { customerId, productId: b.productId }, T0);
    const data = buildFlowData(db, { customerCatalogue: customerId }, { hideSoldOut: true, showRates: true, showCounts: false }, T0);
    expect(sentSnapshot(data, [b.productId, 'missing']).map((i) => i.name)).toEqual(['B']);
  });
});
