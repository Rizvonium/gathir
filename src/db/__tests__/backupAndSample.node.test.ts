import { sql } from 'drizzle-orm';

import { exportAllTables, importAllTables } from '@/db/repo/backup';
import { createCategory, deleteCategory, listCategories, renameCategory, reorderCategories } from '@/db/repo/categories';
import { RepoError } from '@/db/repo/errors';
import { listProducts } from '@/db/repo/products';
import { listSales } from '@/db/repo/sales';
import { getSettings, markOnboarded, nextProductCode } from '@/db/repo/settings';
import { clearSampleData, hasSampleData, insertSampleData } from '@/db/sampleData';
import { products, sales } from '@/db/schema';
import { createTestDb } from '@/test/testDb';
import type { DbOrTx } from '@/db/types';

import { addTestProduct, DAY, expectNoDrift, T0 } from './fixtures';

function orphanCount(db: DbOrTx): number {
  const q = (s: string) => db.get<{ n: number }>(sql.raw(s))?.n ?? 0;
  return (
    q('select count(*) as n from colours where product_id not in (select id from products)') +
    q('select count(*) as n from photos where product_id not in (select id from products)') +
    q('select count(*) as n from stock_moves where colour_id not in (select id from colours)') +
    q('select count(*) as n from sale_items where sale_id not in (select id from sales)') +
    q('select count(*) as n from customer_events where customer_id not in (select id from customers)') +
    q('select count(*) as n from sales where customer_id is not null and customer_id not in (select id from customers)')
  );
}

describe('sample data', () => {
  it('inserts realistic data and clears it without orphans', () => {
    const db = createTestDb();
    const real = addTestProduct(db, { name: 'Real shawl' });
    const before = exportAllTables(db, 0);
    const res = insertSampleData(db, T0);
    expect(res.productIds).toHaveLength(12);
    expect(res.saleIds).toHaveLength(15);
    expect(hasSampleData(db)).toBe(true);
    const rows = listProducts(db);
    expect(rows.filter((r) => r.isSample).every((r) => r.ratePaise >= 180_000 && r.ratePaise <= 8_500_000)).toBe(true);
    const sampleSales = listSales(db, { from: T0 - 15 * DAY, to: T0 });
    expect(sampleSales).toHaveLength(15);
    expect(sampleSales.filter((s) => s.cancelledAt !== null)).toHaveLength(1);
    expectNoDrift(db);

    const cleared = clearSampleData(db);
    expect(cleared).toEqual({ products: 12, sales: 15, customers: 4 });
    expect(hasSampleData(db)).toBe(false);
    expect(orphanCount(db)).toBe(0);
    expectNoDrift(db);
    expect(listProducts(db).map((p) => p.id)).toEqual([real.productId]);
    const after = exportAllTables(db, 0);
    expect(after.tables.stock_moves).toEqual(before.tables.stock_moves);
    expect(after.tables.sales).toEqual([]);
  });
});

describe('backup', () => {
  it('round-trips every table exactly', () => {
    const db = createTestDb();
    insertSampleData(db, T0);
    const exported = JSON.parse(JSON.stringify(exportAllTables(db, T0)));
    const fresh = createTestDb({ seed: false });
    importAllTables(fresh, exported);
    expect(exportAllTables(fresh, T0)).toEqual(exportAllTables(db, T0));
    expectNoDrift(fresh);
    expect(orphanCount(fresh)).toBe(0);
    // Import replaces existing data.
    importAllTables(db, exported);
    expect(db.select().from(products).all()).toHaveLength(12);
    expect(db.select().from(sales).all()).toHaveLength(15);
  });

  it('rejects bad backups and leaves data untouched', () => {
    const db = createTestDb();
    addTestProduct(db);
    expect(() => importAllTables(db, { format: 'nope' })).toThrow(RepoError);
    expect(() => importAllTables(db, { format: 'gathir-backup', version: 99, tables: {} })).toThrow(/newer/);
    const bad = exportAllTables(db);
    bad.tables.colours = [{ id: 'x', productId: 'missing', name: 'r', hex: '#000000', pieces: 1, sortOrder: 0, createdAt: 1, updatedAt: 1 }];
    expect(() => importAllTables(db, bad)).toThrow();
    expect(db.select().from(products).all()).toHaveLength(1);
  });
});

describe('settings and categories', () => {
  it('manages sequences and onboarding', () => {
    const db = createTestDb();
    expect(nextProductCode(db)).toBe('GTH-0001');
    expect(nextProductCode(db)).toBe('GTH-0002');
    markOnboarded(db, T0);
    expect(getSettings(db).onboardedAt).toBe(T0);
    const empty = createTestDb({ seed: false });
    expect(getSettings(empty, T0).lowStockLevel).toBe(1);
  });

  it('creates, renames, reorders and deletes only unused categories', () => {
    const db = createTestDb();
    const id = createCategory(db, { name: 'Gifts' }, T0);
    renameCategory(db, id, 'Gift sets');
    const all = listCategories(db);
    expect(all[all.length - 1].name).toBe('Gift sets');
    reorderCategories(db, [id]);
    expect(listCategories(db)[0].id).toBe(id);
    addTestProduct(db, { categoryId: id });
    expect(() => deleteCategory(db, id)).toThrow(/used by 1/);
    const unused = createCategory(db, { name: 'Tmp' });
    deleteCategory(db, unused);
    expect(listCategories(db).some((c) => c.id === unused)).toBe(false);
    expect(() => createCategory(db, { name: '  ' })).toThrow(RepoError);
  });
});
