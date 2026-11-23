/**
 * Writes a product draft to the database in one transaction. Pure data code (no React, no
 * expo imports) so it runs in Node tests with createTestDb(). Photo files are not touched
 * here: the caller deletes the returned `filesToDelete` after the write succeeded.
 */
import { RepoError } from '@/db/repo/errors';
import {
  addColour,
  createProduct,
  getProductDetail,
  removeColour,
  renameColour,
  setPhotos,
  unreferencedFiles,
  updateProduct,
} from '@/db/repo/products';
import { recordReduction, recordRestock } from '@/db/stock';
import type { DbOrTx } from '@/db/types';

import { changedProductFields, rebaseEditDraft, type DraftColour, type ProductDraft } from './draft';

export type SaveResult = { productId: string; created: boolean; filesToDelete: string[] };

function fieldsOf(d: ProductDraft, name: string) {
  return {
    name,
    categoryId: d.categoryId,
    craft: d.craft,
    material: d.material,
    size: d.size,
    ratePaise: d.ratePaise ?? 0,
    costPaise: d.costPaise,
    notes: d.notes.trim(),
    oneOfAKind: d.oneOfAKind,
  };
}

function saveColour(tx: DbOrTx, productId: string, c: DraftColour, now: number): void {
  const cost = c.costPaise ?? null;
  if (!c.id || !c.original) {
    addColour(tx, productId, { name: c.name, hex: c.hex, pieces: c.pieces, costPaise: cost }, now);
    return;
  }
  const patch: { name?: string; hex?: string; costPaise?: number | null } = {};
  if (c.name.trim() !== c.original.name) patch.name = c.name;
  if (c.hex !== c.original.hex) patch.hex = c.hex;
  if (cost !== (c.original.costPaise ?? null)) patch.costPaise = cost;
  if (patch.name !== undefined || patch.hex !== undefined || patch.costPaise !== undefined) renameColour(tx, c.id, patch, now);
  // Counts change only through stock moves: more = restock, fewer = "counted wrong".
  const delta = c.pieces - c.original.pieces;
  if (delta > 0) recordRestock(tx, c.id, delta, '', now);
  if (delta < 0) recordReduction(tx, c.id, -delta, 'correction', '', now);
}

/**
 * Creates or updates the product. `name` is the resolved name (typed or suggested).
 * Throws RepoError / StockError unchanged (the caller maps codes to messages); nothing is
 * written when it throws.
 */
export function saveDraft(db: DbOrTx, draft: ProductDraft, name: string, now: number = Date.now()): SaveResult {
  return db.transaction((tx) => {
    if (draft.mode === 'new' || !draft.productId) {
      const { productId } = createProduct(
        tx,
        {
          fields: fieldsOf(draft, name),
          colours: draft.colours.map((c) => ({ name: c.name, hex: c.hex, pieces: c.pieces, costPaise: c.costPaise ?? null })),
          photos: draft.photos,
        },
        now,
      );
      return { productId, created: true, filesToDelete: unreferencedFiles(tx, draft.discardedFiles) };
    }

    const productId = draft.productId;
    // The draft may be older than the saved product (kept in memory while the seller sold or
    // restocked elsewhere): re-base it on what is saved now, then write only the seller's changes.
    const detail = getProductDetail(tx, productId);
    if (!detail) throw new RepoError('Product not found', 'not_found');
    const current = rebaseEditDraft(draft, detail);
    const patch = changedProductFields(fieldsOf(current, name), current.originalFields);
    if (Object.keys(patch).length > 0) updateProduct(tx, productId, patch, now);
    const dropped = setPhotos(tx, productId, current.photos, now);
    const removed = new Set(current.removedColourIds);
    // Saved colours put aside by One-of-a-kind are removed too.
    for (const c of current.stashedColours) if (c.id) removed.add(c.id);
    for (const id of removed) removeColour(tx, id, now);
    for (const c of current.colours) saveColour(tx, productId, c, now);
    const filesToDelete = [...new Set([...dropped, ...unreferencedFiles(tx, draft.discardedFiles)])];
    return { productId, created: false, filesToDelete };
  });
}

/** Files a discarded draft leaves behind (saved in this draft, never stored in a product). */
export function filesOfDiscardedDraft(db: DbOrTx, draft: ProductDraft): string[] {
  const all = [...draft.discardedFiles, ...draft.photos.flatMap((p) => [p.fileName, p.thumbName])];
  return unreferencedFiles(db, all);
}
