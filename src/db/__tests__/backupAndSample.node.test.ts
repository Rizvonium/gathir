import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import { BACKUP_VERSION, exportAllTables, importAllTables } from '@/db/repo/backup';
import { addToCustomerCatalogue, listCustomerCatalogue } from '@/db/repo/customerCatalogue';
import { createCustomer } from '@/db/repo/customers';
import { profitSummary } from '@/db/repo/profit';
import { createCategory, deleteCategory, listCategories, renameCategory, reorderCategories } from '@/db/repo/categories';
import { RepoError } from '@/db/repo/errors';
import { listProducts, renameColour } from '@/db/repo/products';
import { createSale, listSales } from '@/db/repo/sales';
import { getSettings, markOnboarded, nextProductCode, updateSettings } from '@/db/repo/settings';
import { clearSampleData, hasSampleData, insertSampleData } from '@/db/sampleData';
import * as schema from '@/db/schema';
import { colours, customerCatalogueItems, products, saleItems, sales } from '@/db/schema';
import { CURRENT_SCHEMA_VERSION } from '@/features/backup/schemaVersion';
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
    q('select count(*) as n from customer_catalogue_items where customer_id not in (select id from customers)') +
    q('select count(*) as n from customer_catalogue_items where product_id not in (select id from products)') +
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

describe('profit & personal catalogue data in backups and migrations', () => {
  function shopWithNewData(db: DbOrTx) {
    const p = addTestProduct(db, { name: 'Sozni stole', costPaise: 400_000 });
    renameColour(db, p.colourIds[1], { costPaise: 450_000 }, T0);
    const shah = createCustomer(db, { name: 'Mrs. Shah', phone: '9876543210' }, T0);
    addToCustomerCatalogue(db, { customerId: shah, productId: p.productId, specialRatePaise: 600_000, note: 'Wedding' }, T0);
    createSale(db, { items: [{ colourId: p.colourIds[1], qty: 1, ratePaise: 650_000 }], customerId: shah }, T0);
    updateSettings(db, { reportIncludesProfit: true }, T0);
    return { ...p, shah };
  }

  it('round-trips the new table and columns', () => {
    const db = createTestDb();
    const { shah } = shopWithNewData(db);
    const exported = JSON.parse(JSON.stringify(exportAllTables(db, T0)));
    expect(exported.version).toBe(BACKUP_VERSION);
    expect(exported.tables.customer_catalogue_items).toHaveLength(1);
    const fresh = createTestDb({ seed: false });
    importAllTables(fresh, exported);
    expect(exportAllTables(fresh, T0)).toEqual(exportAllTables(db, T0));
    expect(listCustomerCatalogue(fresh, shah)[0]).toMatchObject({ specialRatePaise: 600_000, note: 'Wedding' });
    expect(getSettings(fresh).reportIncludesProfit).toBe(true);
    expect(profitSummary(fresh, { from: T0, to: T0 }).profitPaise).toBe(200_000);
  });

  it('restores an older (version 1) backup without the new table or columns, filling defaults', () => {
    const db = createTestDb();
    const { productId, shah } = shopWithNewData(db);
    const v1 = JSON.parse(JSON.stringify(exportAllTables(db, T0)));
    v1.version = 1;
    delete v1.tables.customer_catalogue_items;
    for (const row of v1.tables.colours) delete row.costPaise;
    for (const row of v1.tables.sale_items) delete row.costPaiseSnapshot;
    for (const row of v1.tables.shop_settings) delete row.reportIncludesProfit;

    const fresh = createTestDb();
    importAllTables(fresh, v1);
    expect(getSettings(fresh).reportIncludesProfit).toBe(false);
    expect(fresh.select().from(colours).all().every((c) => c.costPaise === null)).toBe(true);
    expect(listCustomerCatalogue(fresh, shah)).toEqual([]);
    expect(listProducts(fresh).map((p) => p.id)).toEqual([productId]);
    // Old sales had no buying-price snapshot: their profit is unknown, not 100 %.
    expect(profitSummary(fresh, { from: T0, to: T0 })).toMatchObject({ profitPaise: 0, unknownCostItems: 1, revenuePaise: 650_000 });
    expectNoDrift(fresh);
    expect(orphanCount(fresh)).toBe(0);
  });

  it('the profit_catalogues migration upgrades a version-1 database in place', () => {
    const dir = path.join(__dirname, '../../../drizzle');
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort();
    expect(files.length).toBe(CURRENT_SCHEMA_VERSION);
    const run = (sqlite: Database.Database, file: string) => {
      for (const stmt of fs.readFileSync(path.join(dir, file), 'utf8').split('--> statement-breakpoint')) if (stmt.trim()) sqlite.exec(stmt);
    };
    const sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');
    run(sqlite, files[0]);
    sqlite.exec(`insert into shop_settings (id, created_at, updated_at) values (1, 1, 1)`);
    sqlite.exec(`insert into products (id, code, name, rate_paise, cost_paise, created_at, updated_at) values ('p1', 'GTH-0001', 'Stole', 650000, 400000, 1, 1)`);
    sqlite.exec(`insert into colours (id, product_id, name, hex, pieces, created_at, updated_at) values ('c1', 'p1', 'Red', '#C0262D', 0, 1, 1)`);
    sqlite.exec(`insert into sales (id, bill_no, total_paise, created_at) values ('s1', 'B-2026-0001', 650000, 1)`);
    sqlite.exec(
      `insert into sale_items (id, sale_id, product_id, colour_id, product_name_snapshot, colour_name_snapshot, qty, rate_paise) values ('i1', 's1', 'p1', 'c1', 'Stole', 'Red', 1, 650000)`,
    );
    for (const f of files.slice(1)) run(sqlite, f);
    const db = drizzle(sqlite, { schema });
    expect(getSettings(db).reportIncludesProfit).toBe(false);
    expect(db.select().from(colours).get()?.costPaise).toBeNull();
    expect(db.select().from(saleItems).get()?.costPaiseSnapshot).toBeNull();
    expect(db.select().from(customerCatalogueItems).all()).toEqual([]);
    // New writes work on the upgraded database.
    const shah = createCustomer(db, { name: 'Mrs. Shah' }, T0);
    addToCustomerCatalogue(db, { customerId: shah, productId: 'p1' }, T0);
    expect(listCustomerCatalogue(db, shah)).toHaveLength(1);
  });
});
