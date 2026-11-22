import { eq } from 'drizzle-orm';

import { colours, products, stockMoves } from '@/db/schema';
import { adjustStock, applyMove, findCountDrift, productPieces, StockError } from '@/db/stock';
import { newId } from '@/lib/ids';
import { createTestDb } from '@/test/testDb';

function makeProduct(db: ReturnType<typeof createTestDb>) {
  const now = 1_700_000_000_000;
  const productId = newId();
  db.insert(products).values({ id: productId, code: 'GTH-0001', name: 'Sozni stole', createdAt: now, updatedAt: now }).run();
  const red = newId();
  const beige = newId();
  db.insert(colours)
    .values([
      { id: red, productId, name: 'Red', hex: '#C0262D', createdAt: now, updatedAt: now },
      { id: beige, productId, name: 'Beige', hex: '#D8C3A5', createdAt: now, updatedAt: now },
    ])
    .run();
  return { productId, red, beige };
}

describe('stock moves', () => {
  it('keeps cached counts equal to the ledger', () => {
    const db = createTestDb();
    const { productId, red, beige } = makeProduct(db);
    adjustStock(db, { colourId: red, delta: 4, reason: 'opening' });
    adjustStock(db, { colourId: beige, delta: 2, reason: 'opening' });
    adjustStock(db, { colourId: red, delta: -1, reason: 'sold' });
    expect(productPieces(db, productId)).toBe(5);
    expect(db.select().from(stockMoves).all()).toHaveLength(3);
    expect(findCountDrift(db)).toEqual([]);
  });

  it('refuses to go below zero and rolls back', () => {
    const db = createTestDb();
    const { red } = makeProduct(db);
    adjustStock(db, { colourId: red, delta: 1, reason: 'opening' });
    expect(() => adjustStock(db, { colourId: red, delta: -2, reason: 'sold' })).toThrow(StockError);
    expect(db.select().from(colours).where(eq(colours.id, red)).get()?.pieces).toBe(1);
    expect(db.select().from(stockMoves).all()).toHaveLength(1);
  });

  it('rolls back every move in a failed multi-move transaction', () => {
    const db = createTestDb();
    const { red, beige } = makeProduct(db);
    adjustStock(db, { colourId: red, delta: 3, reason: 'opening' });
    expect(() =>
      db.transaction((tx) => {
        applyMove(tx, { colourId: red, delta: -1, reason: 'sold' });
        applyMove(tx, { colourId: beige, delta: -1, reason: 'sold' }); // beige has 0
      }),
    ).toThrow(StockError);
    expect(db.select().from(colours).where(eq(colours.id, red)).get()?.pieces).toBe(3);
    expect(findCountDrift(db)).toEqual([]);
  });

  it('rejects zero and fractional deltas', () => {
    const db = createTestDb();
    const { red } = makeProduct(db);
    expect(() => adjustStock(db, { colourId: red, delta: 0, reason: 'added' })).toThrow(StockError);
    expect(() => adjustStock(db, { colourId: red, delta: 1.5, reason: 'added' })).toThrow(StockError);
  });
});
