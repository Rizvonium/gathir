/** Product soft delete, restore, purge after 30 days, and the Recently deleted list. */
import { and, desc, eq, inArray, isNotNull, isNull, lt } from 'drizzle-orm';

import { colours, photos, products, stockMoves } from '../schema';
import { applyMove } from '../stock';
import type { DbOrTx } from '../types';
import { chunk, DAY_MS, RECENTLY_DELETED_DAYS } from './constants';
import { RepoError } from './errors';
import { deleteNote, parseDeleteNote } from './moveNotes';
import { liveColours, restoreDeletedPieces, unreferencedFiles } from './productWrites';

export type DeletedProductRow = {
  id: string;
  code: string;
  name: string;
  deletedAt: number;
  /** When the product will be purged for good. */
  purgeAt: number;
  piecesDeleted: number;
  coverThumb: string | null;
};

/**
 * Hides a product (Recently deleted) and writes 'deleted' moves so its counts go to 0.
 * The pieces removed are recorded in each move's note so restoreProduct can re-add them.
 * Doing it twice is a no-op.
 */
export function softDeleteProduct(db: DbOrTx, productId: string, now: number = Date.now()): void {
  db.transaction((tx) => {
    const product = tx.select().from(products).where(eq(products.id, productId)).get();
    if (!product) throw new RepoError('Product not found', 'not_found');
    if (product.deletedAt !== null) return;
    for (const c of liveColours(tx, productId)) {
      if (c.pieces > 0) {
        applyMove(tx, { colourId: c.id, delta: -c.pieces, reason: 'deleted', note: deleteNote('product', c.pieces), at: now });
      }
    }
    tx.update(products).set({ deletedAt: now, updatedAt: now }).where(eq(products.id, productId)).run();
  });
}

/** Brings a deleted product back with the pieces it had ('restored' moves). No-op if not deleted. */
export function restoreProduct(db: DbOrTx, productId: string, now: number = Date.now()): void {
  db.transaction((tx) => {
    const product = tx.select().from(products).where(eq(products.id, productId)).get();
    if (!product) throw new RepoError('Product not found', 'not_found');
    if (product.deletedAt === null) return;
    const ids = liveColours(tx, productId).map((c) => c.id);
    restoreDeletedPieces(tx, ids, 'product', product.deletedAt, now);
    tx.update(products).set({ deletedAt: null, updatedAt: now }).where(eq(products.id, productId)).run();
  });
}

/**
 * Permanently removes products deleted more than `days` ago (with their colours, photos
 * and stock moves; sale items keep their snapshots). Returns the purged ids and the photo
 * file names that are no longer referenced and can be deleted from disk.
 */
export function purgeDeletedOlderThan(
  db: DbOrTx,
  now: number = Date.now(),
  days: number = RECENTLY_DELETED_DAYS,
): { productIds: string[]; files: string[] } {
  const cutoff = now - days * DAY_MS;
  return db.transaction((tx) => {
    const old = tx
      .select({ id: products.id })
      .from(products)
      .where(and(isNotNull(products.deletedAt), lt(products.deletedAt, cutoff)))
      .all()
      .map((p) => p.id);
    if (old.length === 0) return { productIds: [], files: [] };
    const files: string[] = [];
    for (const ids of chunk(old, 200)) {
      const ph = tx.select().from(photos).where(inArray(photos.productId, ids)).all();
      files.push(...ph.flatMap((p) => [p.fileName, p.thumbName]));
      tx.delete(stockMoves).where(inArray(stockMoves.productId, ids)).run();
      tx.delete(colours).where(inArray(colours.productId, ids)).run();
      tx.delete(photos).where(inArray(photos.productId, ids)).run();
      tx.delete(products).where(inArray(products.id, ids)).run();
    }
    return { productIds: old, files: unreferencedFiles(tx, files) };
  });
}

/** Deleted products, most recently deleted first. */
export function listRecentlyDeleted(db: DbOrTx, days: number = RECENTLY_DELETED_DAYS): DeletedProductRow[] {
  const rows = db
    .select({
      id: products.id,
      code: products.code,
      name: products.name,
      deletedAt: products.deletedAt,
      coverThumb: photos.thumbName,
    })
    .from(products)
    .leftJoin(photos, eq(photos.id, products.coverPhotoId))
    .where(isNotNull(products.deletedAt))
    .orderBy(desc(products.deletedAt))
    .all();
  return rows.map((r) => {
    const deletedAt = r.deletedAt ?? 0;
    const moves = db
      .select({ note: stockMoves.note })
      .from(stockMoves)
      .innerJoin(colours, eq(colours.id, stockMoves.colourId))
      .where(
        and(
          eq(stockMoves.productId, r.id),
          eq(stockMoves.reason, 'deleted'),
          eq(stockMoves.createdAt, deletedAt),
          isNull(colours.deletedAt),
        ),
      )
      .all();
    const piecesDeleted = moves.reduce((s, m) => {
      const meta = parseDeleteNote(m.note);
      return meta?.scope === 'product' ? s + meta.deletedPieces : s;
    }, 0);
    return { ...r, deletedAt, purgeAt: deletedAt + days * DAY_MS, piecesDeleted, coverThumb: r.coverThumb ?? null };
  });
}
