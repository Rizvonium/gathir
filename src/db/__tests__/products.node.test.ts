import { eq } from 'drizzle-orm';

import {
  addColour,
  createProduct,
  getProductDetail,
  hasAnyProduct,
  listProducts,
  listRecentlyDeleted,
  purgeDeletedOlderThan,
  removeColour,
  renameColour,
  restoreColour,
  restoreProduct,
  setPhotos,
  softDeleteProduct,
  stockHistory,
  updateProduct,
} from '@/db/repo/products';
import { createSale } from '@/db/repo/sales';
import { RepoError } from '@/db/repo/errors';
import { colours, photos, products, stockMoves } from '@/db/schema';
import { productPieces, recordCorrection, recordReduction, recordRestock, StockError } from '@/db/stock';
import { createTestDb } from '@/test/testDb';

import { addTestProduct, DAY, expectNoDrift, T0 } from './fixtures';

describe('products', () => {
  it('hasAnyProduct: false for a new shop, true with a live product, false once it is deleted', () => {
    const db = createTestDb();
    expect(hasAnyProduct(db)).toBe(false);
    const { productId } = addTestProduct(db);
    expect(hasAnyProduct(db)).toBe(true);
    softDeleteProduct(db, productId, T0 + DAY);
    expect(hasAnyProduct(db)).toBe(false);
    restoreProduct(db, productId);
    expect(hasAnyProduct(db)).toBe(true);
  });

  it('creates product, colours, photos and opening moves in one go', () => {
    const db = createTestDb();
    const { productId, code } = addTestProduct(db, { photos: 2 });
    expect(code).toBe('GTH-0001');
    const d = getProductDetail(db, productId);
    expect(d?.totalPieces).toBe(6);
    expect(d?.photos).toHaveLength(2);
    expect(d?.product.coverPhotoId).toBe(d?.photos[0].id);
    const moves = db.select().from(stockMoves).all();
    expect(moves.map((m) => m.reason)).toEqual(['opening', 'opening']);
    expectNoDrift(db);
  });

  it('skips opening moves for zero-piece colours and rolls back on invalid input', () => {
    const db = createTestDb();
    addTestProduct(db, { colours: [{ name: 'Red', hex: '#C0262D', pieces: 0 }] });
    expect(db.select().from(stockMoves).all()).toHaveLength(0);
    expect(() =>
      createProduct(db, { fields: { name: 'X', ratePaise: 100 }, colours: [{ name: 'Bad', hex: 'red', pieces: 1 }], photos: [] }),
    ).toThrow(RepoError);
    expect(() => createProduct(db, { fields: { name: ' ', ratePaise: 100 }, colours: [], photos: [] })).toThrow(RepoError);
    expect(db.select().from(products).all()).toHaveLength(1);
  });

  it('gives sequential codes and refuses duplicate codes', () => {
    const db = createTestDb();
    expect(addTestProduct(db).code).toBe('GTH-0001');
    expect(addTestProduct(db).code).toBe('GTH-0002');
    expect(() =>
      createProduct(db, { fields: { name: 'Y', ratePaise: 1, code: 'GTH-0001' }, colours: [{ name: 'R', hex: '#000000', pieces: 1 }], photos: [] }),
    ).toThrow(/already used/);
  });

  it('edits details and replaces photos keeping ids, returning freed files', () => {
    const db = createTestDb();
    const { productId } = addTestProduct(db, { name: 'shawl', photos: 3 });
    updateProduct(db, productId, { name: 'Kani shawl', ratePaise: 900_000 });
    const before = getProductDetail(db, productId);
    expect(before?.product.name).toBe('Kani shawl');
    const [p0, p1, p2] = before?.photos ?? [];
    const freed = setPhotos(db, productId, [p2, p0].map(({ fileName, thumbName, width, height }) => ({ fileName, thumbName, width, height })));
    expect(freed.sort()).toEqual([p1.fileName, p1.thumbName].sort());
    const after = getProductDetail(db, productId);
    expect(after?.photos.map((p) => p.id)).toEqual([p2.id, p0.id]);
    expect(after?.product.coverPhotoId).toBe(p2.id);
  });

  it('adds, renames, removes and restores colours through moves', () => {
    const db = createTestDb();
    const { productId, colourIds } = addTestProduct(db);
    const green = addColour(db, productId, { name: 'Green', hex: '#2E7D4F', pieces: 3 });
    renameColour(db, green, { name: 'Bottle green' });
    expect(productPieces(db, productId)).toBe(9);
    removeColour(db, colourIds[0], T0 + 1000);
    expect(productPieces(db, productId)).toBe(5);
    restoreColour(db, colourIds[0], T0 + 2000);
    expect(productPieces(db, productId)).toBe(9);
    expect(getProductDetail(db, productId)?.colours.map((c) => c.name)).toEqual(['Red', 'Beige', 'Bottle green']);
    expectNoDrift(db);
  });

  it('soft delete zeroes counts, restore brings exact pieces back, both idempotent', () => {
    const db = createTestDb();
    const { productId, colourIds } = addTestProduct(db);
    recordReduction(db, colourIds[0], 1, 'damaged', 'torn edge', T0 + 10);
    softDeleteProduct(db, productId, T0 + DAY);
    softDeleteProduct(db, productId, T0 + DAY + 5);
    expect(productPieces(db, productId)).toBe(0);
    expect(listProducts(db)).toHaveLength(0);
    const deleted = listRecentlyDeleted(db);
    expect(deleted[0].piecesDeleted).toBe(5);
    expect(deleted[0].purgeAt).toBe(T0 + DAY + 30 * DAY);
    restoreProduct(db, productId, T0 + 2 * DAY);
    restoreProduct(db, productId, T0 + 2 * DAY);
    expect(productPieces(db, productId)).toBe(5);
    expect(listProducts(db)).toHaveLength(1);
    const reasons = stockHistory(db, productId).map((h) => h.reason);
    expect(reasons.filter((r) => r === 'restored')).toHaveLength(2);
    expect(stockHistory(db, productId).every((h) => !h.note.startsWith('{'))).toBe(true);
    expectNoDrift(db);
  });

  it('purges only old deletions and keeps photos used by sale snapshots', () => {
    const db = createTestDb();
    const a = addTestProduct(db, { name: 'a', photos: 2 });
    const b = addTestProduct(db, { name: 'b', photos: 1 });
    createSale(db, { items: [{ colourId: a.colourIds[0], qty: 1, ratePaise: 100 }] }, T0 + 1);
    softDeleteProduct(db, a.productId, T0);
    softDeleteProduct(db, b.productId, T0 + 29 * DAY);
    const res = purgeDeletedOlderThan(db, T0 + 31 * DAY);
    expect(res.productIds).toEqual([a.productId]);
    expect(res.files.sort()).toEqual(['a-0.jpg', 'a-1-t.jpg', 'a-1.jpg']);
    expect(db.select().from(products).where(eq(products.id, a.productId)).get()).toBeUndefined();
    expect(db.select().from(colours).where(eq(colours.productId, a.productId)).all()).toHaveLength(0);
    expect(db.select().from(photos).where(eq(photos.productId, a.productId)).all()).toHaveLength(0);
    expect(listRecentlyDeleted(db).map((r) => r.id)).toEqual([b.productId]);
    expectNoDrift(db);
  });

  it('lists with search, filters and sorts', () => {
    const db = createTestDb();
    addTestProduct(db, { name: 'Kani shawl', craft: 'Kani', ratePaise: 5_000_000, colours: [{ name: 'Maroon', hex: '#6D1A24', pieces: 1 }], at: T0 });
    addTestProduct(db, { name: 'Aari stole', craft: 'Aari', ratePaise: 200_000, colours: [{ name: 'Blue', hex: '#2F5DA8', pieces: 0 }], at: T0 + 1 });
    addTestProduct(db, { name: 'Sozni stole', ratePaise: 650_000, at: T0 + 2 });
    expect(listProducts(db).map((p) => p.name)).toEqual(['Sozni stole', 'Aari stole', 'Kani shawl']);
    expect(listProducts(db, { search: 'maroon' }).map((p) => p.name)).toEqual(['Kani shawl']);
    expect(listProducts(db, { search: 'GTH-0002' }).map((p) => p.name)).toEqual(['Aari stole']);
    expect(listProducts(db, { filter: 'out' }).map((p) => p.name)).toEqual(['Aari stole']);
    expect(listProducts(db, { filter: 'low' }).map((p) => p.name)).toEqual(['Kani shawl']);
    expect(listProducts(db, { filter: 'in' })).toHaveLength(2);
    expect(listProducts(db, { sort: 'rate_high' })[0].name).toBe('Kani shawl');
    expect(listProducts(db, { sort: 'most' })[0].name).toBe('Sozni stole');
    expect(listProducts(db, { sort: 'name' }).map((p) => p.name)).toEqual(['Aari stole', 'Kani shawl', 'Sozni stole']);
    const row = listProducts(db, { search: 'sozni' })[0];
    expect(row.colours).toEqual([
      expect.objectContaining({ name: 'Red', pieces: 4 }),
      expect.objectContaining({ name: 'Beige', pieces: 2 }),
    ]);
    expect(row).not.toHaveProperty('costPaise');
  });

  it('records restock, reductions and corrections with reasons', () => {
    const db = createTestDb();
    const { productId, colourIds } = addTestProduct(db);
    expect(recordRestock(db, colourIds[0], 3, '', T0 + 1)).toBe(7);
    expect(recordReduction(db, colourIds[0], 1, 'sample', 'gift', T0 + 2)).toBe(6);
    expect(recordCorrection(db, colourIds[0], 10, '', T0 + 3)).toBe(10);
    expect(recordCorrection(db, colourIds[0], 10, '', T0 + 4)).toBe(10);
    expect(() => recordReduction(db, colourIds[1], 5, 'damaged')).toThrow(StockError);
    expect(() => recordRestock(db, colourIds[1], 0)).toThrow(StockError);
    const history = stockHistory(db, productId);
    expect(history.slice(0, 3).map((h) => [h.reason, h.delta])).toEqual([
      ['correction', 4],
      ['sample', -1],
      ['added', 3],
    ]);
    expect(history[0].colourName).toBe('Red');
    expectNoDrift(db);
  });
});
