/** Product writes: create, edit, photos and colours. Counts change only via stock moves. */
import { and, asc, eq, isNull, max } from 'drizzle-orm';

import { newId } from '@/lib/ids';

import { colours, photos, products, saleItems, stockMoves, type Colour } from '../schema';
import { applyMove } from '../stock';
import type { DbOrTx } from '../types';
import { assertWhole, RepoError, requireText } from './errors';
import { deleteNote, parseDeleteNote } from './moveNotes';
import { nextProductCode } from './settings';

export const MAX_PHOTOS = 8;

export type ProductFields = {
  name: string;
  categoryId?: string | null;
  craft?: string;
  material?: string;
  size?: string;
  ratePaise: number;
  costPaise?: number | null;
  notes?: string;
  oneOfAKind?: boolean;
  /** Sample products are removed by clearSampleData. */
  isSample?: boolean;
  /** Leave empty to get the next GTH-#### code. */
  code?: string;
};
export type ProductUpdate = Partial<Omit<ProductFields, 'isSample' | 'code'>> & {
  /** Per-colour buying price overrides of this product's colours: colourId → paise (null = use the product's). */
  colourCosts?: Record<string, number | null>;
};
/** `costPaise`: this colour's own buying price (null/omitted = the product's buying price). Seller-only. */
export type ColourInput = { name: string; hex: string; pieces: number; costPaise?: number | null };
export type PhotoInput = { fileName: string; thumbName: string; width: number; height: number };
export type CreateProductInput = { fields: ProductFields; colours: ColourInput[]; photos: PhotoInput[] };

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function validateColour(c: ColourInput): void {
  requireText(c.name, 'Colour name');
  if (c.hex !== 'multi' && !HEX_RE.test(c.hex)) throw new RepoError('Colour must be #RRGGBB or multi', 'invalid');
  assertWhole(c.pieces, 'Pieces');
  if (c.costPaise !== undefined && c.costPaise !== null) assertWhole(c.costPaise, 'Colour cost');
}

function validateMoney(fields: ProductUpdate): void {
  if (fields.ratePaise !== undefined) assertWhole(fields.ratePaise, 'Rate');
  if (fields.costPaise !== undefined && fields.costPaise !== null) assertWhole(fields.costPaise, 'Cost');
}

function validatePhotos(list: PhotoInput[]): void {
  if (list.length > MAX_PHOTOS) throw new RepoError(`At most ${MAX_PHOTOS} photos`, 'invalid');
  for (const p of list) {
    requireText(p.fileName, 'Photo file');
    requireText(p.thumbName, 'Thumbnail file');
  }
}

/**
 * Creates a product with its colours and photos, and one 'opening' stock move per colour
 * with pieces > 0, all in one transaction. Returns the new id and code.
 */
export function createProduct(
  db: DbOrTx,
  input: CreateProductInput,
  now: number = Date.now(),
): { productId: string; code: string } {
  const name = requireText(input.fields.name, 'Name');
  validateMoney(input.fields);
  if (input.colours.length === 0) throw new RepoError('Add at least one colour', 'invalid');
  input.colours.forEach(validateColour);
  validatePhotos(input.photos);
  const total = input.colours.reduce((s, c) => s + c.pieces, 0);
  if (input.fields.oneOfAKind && total > 1) throw new RepoError('A one-of-a-kind piece has at most 1 piece', 'invalid');

  return db.transaction((tx) => {
    const code = input.fields.code?.trim() || nextProductCode(tx, now);
    if (tx.select({ id: products.id }).from(products).where(eq(products.code, code)).get()) {
      throw new RepoError(`Code ${code} is already used`, 'duplicate');
    }
    const productId = newId();
    const photoRows = input.photos.map((p, i) => ({ id: newId(), productId, ...p, sortOrder: i, createdAt: now }));
    tx.insert(products)
      .values({
        id: productId,
        code,
        name,
        categoryId: input.fields.categoryId ?? null,
        craft: input.fields.craft ?? '',
        material: input.fields.material ?? '',
        size: input.fields.size ?? '',
        ratePaise: input.fields.ratePaise,
        costPaise: input.fields.costPaise ?? null,
        notes: input.fields.notes ?? '',
        oneOfAKind: input.fields.oneOfAKind ?? false,
        isSample: input.fields.isSample ?? false,
        coverPhotoId: photoRows[0]?.id ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    input.colours.forEach((c, i) => {
      const colourId = newId();
      tx.insert(colours)
        .values({
          id: colourId,
          productId,
          name: c.name.trim(),
          hex: c.hex,
          costPaise: c.costPaise ?? null,
          pieces: 0,
          sortOrder: i,
          createdAt: now,
          updatedAt: now,
        })
        .run();
      if (c.pieces > 0) applyMove(tx, { colourId, delta: c.pieces, reason: 'opening', at: now });
    });
    if (photoRows.length > 0) tx.insert(photos).values(photoRows).run();
    return { productId, code };
  });
}

/** Edits product details and buying prices (not counts, colours or photos). */
export function updateProduct(db: DbOrTx, productId: string, fields: ProductUpdate, now: number = Date.now()): void {
  validateMoney(fields);
  const { colourCosts, ...patch } = fields;
  if (fields.name !== undefined) patch.name = requireText(fields.name, 'Name');
  for (const cost of Object.values(colourCosts ?? {})) if (cost !== null) assertWhole(cost, 'Colour cost');
  db.transaction((tx) => {
    const res = tx
      .update(products)
      .set({ ...patch, updatedAt: now })
      .where(eq(products.id, productId))
      .run();
    if (res.changes === 0) throw new RepoError('Product not found', 'not_found');
    for (const [colourId, costPaise] of Object.entries(colourCosts ?? {})) {
      const done = tx
        .update(colours)
        .set({ costPaise, updatedAt: now })
        .where(and(eq(colours.id, colourId), eq(colours.productId, productId)))
        .run();
      if (done.changes === 0) throw new RepoError('Colour not found', 'not_found');
    }
  });
}

/** File names (photo + thumb) no longer referenced by any photo row or sale snapshot. */
export function unreferencedFiles(db: DbOrTx, candidates: string[]): string[] {
  return [...new Set(candidates)].filter((name) => {
    const inPhotos =
      db.select({ id: photos.id }).from(photos).where(eq(photos.fileName, name)).get() ??
      db.select({ id: photos.id }).from(photos).where(eq(photos.thumbName, name)).get();
    const inSales = db.select({ id: saleItems.id }).from(saleItems).where(eq(saleItems.photoSnapshotName, name)).get();
    return !inPhotos && !inSales;
  });
}

/**
 * Replaces the product's photo list in the given order (first = cover). Rows whose
 * fileName is unchanged keep their id. Returns file names that can now be deleted from disk.
 */
export function setPhotos(db: DbOrTx, productId: string, list: PhotoInput[], now: number = Date.now()): string[] {
  validatePhotos(list);
  return db.transaction((tx) => {
    const product = tx.select({ id: products.id }).from(products).where(eq(products.id, productId)).get();
    if (!product) throw new RepoError('Product not found', 'not_found');
    const existing = tx.select().from(photos).where(eq(photos.productId, productId)).all();
    const byFile = new Map(existing.map((p) => [p.fileName, p]));
    tx.delete(photos).where(eq(photos.productId, productId)).run();
    const rows = list.map((p, i) => ({
      id: byFile.get(p.fileName)?.id ?? newId(),
      productId,
      ...p,
      sortOrder: i,
      createdAt: byFile.get(p.fileName)?.createdAt ?? now,
    }));
    if (rows.length > 0) tx.insert(photos).values(rows).run();
    tx.update(products)
      .set({ coverPhotoId: rows[0]?.id ?? null, updatedAt: now })
      .where(eq(products.id, productId))
      .run();
    const dropped = existing.flatMap((p) => [p.fileName, p.thumbName]);
    return unreferencedFiles(tx, dropped);
  });
}

/** Adds a colour to a product; its pieces are logged as an 'added' move. Returns the colour id. */
export function addColour(db: DbOrTx, productId: string, input: ColourInput, now: number = Date.now()): string {
  validateColour(input);
  return db.transaction((tx) => {
    const product = tx.select({ id: products.id }).from(products).where(eq(products.id, productId)).get();
    if (!product) throw new RepoError('Product not found', 'not_found');
    const last = tx.select({ m: max(colours.sortOrder) }).from(colours).where(eq(colours.productId, productId)).get();
    const colourId = newId();
    tx.insert(colours)
      .values({
        id: colourId,
        productId,
        name: input.name.trim(),
        hex: input.hex,
        costPaise: input.costPaise ?? null,
        pieces: 0,
        sortOrder: (last?.m ?? -1) + 1,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    if (input.pieces > 0) applyMove(tx, { colourId, delta: input.pieces, reason: 'added', at: now });
    return colourId;
  });
}

/** Renames a colour, changes its swatch and/or its own buying price (`costPaise: null` = use the product's). */
export function renameColour(
  db: DbOrTx,
  colourId: string,
  patch: { name?: string; hex?: string; costPaise?: number | null },
  now: number = Date.now(),
): void {
  const name = patch.name !== undefined ? requireText(patch.name, 'Colour name') : undefined;
  if (patch.hex !== undefined && patch.hex !== 'multi' && !HEX_RE.test(patch.hex)) {
    throw new RepoError('Colour must be #RRGGBB or multi', 'invalid');
  }
  if (patch.costPaise !== undefined && patch.costPaise !== null) assertWhole(patch.costPaise, 'Colour cost');
  const res = db
    .update(colours)
    .set({
      ...(name ? { name } : {}),
      ...(patch.hex ? { hex: patch.hex } : {}),
      ...(patch.costPaise !== undefined ? { costPaise: patch.costPaise } : {}),
      updatedAt: now,
    })
    .where(eq(colours.id, colourId))
    .run();
  if (res.changes === 0) throw new RepoError('Colour not found', 'not_found');
}

/** Soft-removes a colour; remaining pieces are written off with a 'deleted' move (undo: restoreColour). */
export function removeColour(db: DbOrTx, colourId: string, now: number = Date.now()): void {
  db.transaction((tx) => {
    const colour = tx.select().from(colours).where(eq(colours.id, colourId)).get();
    if (!colour) throw new RepoError('Colour not found', 'not_found');
    if (colour.deletedAt !== null) return;
    if (colour.pieces > 0) {
      applyMove(tx, { colourId, delta: -colour.pieces, reason: 'deleted', note: deleteNote('colour', colour.pieces), at: now });
    }
    tx.update(colours).set({ deletedAt: now, updatedAt: now }).where(eq(colours.id, colourId)).run();
  });
}

/** Undoes removeColour: brings the colour back with the pieces it had. */
export function restoreColour(db: DbOrTx, colourId: string, now: number = Date.now()): void {
  db.transaction((tx) => {
    const colour = tx.select().from(colours).where(eq(colours.id, colourId)).get();
    if (!colour) throw new RepoError('Colour not found', 'not_found');
    if (colour.deletedAt === null) return;
    restoreDeletedPieces(tx, [colourId], 'colour', colour.deletedAt, now);
    tx.update(colours).set({ deletedAt: null, updatedAt: now }).where(eq(colours.id, colourId)).run();
  });
}

/**
 * Re-adds pieces written off by a delete of `scope` at exactly `deletedAt`, as 'restored' moves.
 * Shared by colour and product restore.
 */
export function restoreDeletedPieces(
  tx: DbOrTx,
  colourIds: string[],
  scope: 'product' | 'colour',
  deletedAt: number,
  now: number,
): void {
  for (const colourId of colourIds) {
    const moves = tx
      .select()
      .from(stockMoves)
      .where(and(eq(stockMoves.colourId, colourId), eq(stockMoves.reason, 'deleted'), eq(stockMoves.createdAt, deletedAt)))
      .all();
    for (const m of moves) {
      const meta = parseDeleteNote(m.note);
      if (meta?.scope === scope && meta.deletedPieces > 0) {
        applyMove(tx, { colourId, delta: meta.deletedPieces, reason: 'restored', at: now });
      }
    }
  }
}

/** Live colours of a product in display order. */
export function liveColours(db: DbOrTx, productId: string): Colour[] {
  return db
    .select()
    .from(colours)
    .where(and(eq(colours.productId, productId), isNull(colours.deletedAt)))
    .orderBy(asc(colours.sortOrder))
    .all();
}
