/** Product categories: list, create, rename, reorder, delete (only when unused). */
import { asc, count, eq, isNull, max } from 'drizzle-orm';

import { newId } from '@/lib/ids';

import { categories, products, type Category } from '../schema';
import type { DbOrTx } from '../types';
import { RepoError, requireText } from './errors';

export type CategoryWithCount = Category & { productCount: number };

/** All categories in display order. */
export function listCategories(db: DbOrTx): Category[] {
  return db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name)).all();
}

/** Categories in display order with the number of live (not deleted) products in each. */
export function listCategoriesWithCounts(db: DbOrTx): CategoryWithCount[] {
  const counts = db
    .select({ categoryId: products.categoryId, n: count() })
    .from(products)
    .where(isNull(products.deletedAt))
    .groupBy(products.categoryId)
    .all();
  const byId = new Map(counts.map((c) => [c.categoryId, c.n]));
  return listCategories(db).map((c) => ({ ...c, productCount: byId.get(c.id) ?? 0 }));
}

/** Adds a category at the end of the list. Returns its id. */
export function createCategory(db: DbOrTx, input: { name: string; icon?: string }, now: number = Date.now()): string {
  const name = requireText(input.name, 'Category name');
  return db.transaction((tx) => {
    const last = tx.select({ m: max(categories.sortOrder) }).from(categories).get();
    const id = newId();
    tx.insert(categories)
      .values({ id, name, icon: input.icon ?? 'category', sortOrder: (last?.m ?? -1) + 1, createdAt: now, updatedAt: now })
      .run();
    return id;
  });
}

/** Renames a category (and optionally changes its icon). */
export function renameCategory(db: DbOrTx, id: string, name: string, icon?: string, now: number = Date.now()): void {
  const trimmed = requireText(name, 'Category name');
  const res = db
    .update(categories)
    .set({ name: trimmed, ...(icon ? { icon } : {}), updatedAt: now })
    .where(eq(categories.id, id))
    .run();
  if (res.changes === 0) throw new RepoError('Category not found', 'not_found');
}

/** Sets the display order to match `orderedIds` (ids not listed keep their place after them). */
export function reorderCategories(db: DbOrTx, orderedIds: string[], now: number = Date.now()): void {
  db.transaction((tx) => {
    const rest = listCategories(tx).filter((c) => !orderedIds.includes(c.id));
    [...orderedIds, ...rest.map((c) => c.id)].forEach((id, i) => {
      tx.update(categories).set({ sortOrder: i, updatedAt: now }).where(eq(categories.id, id)).run();
    });
  });
}

/**
 * Deletes a category. Throws RepoError('in_use') when any product (including ones in
 * Recently deleted) still uses it: move those products first.
 */
export function deleteCategory(db: DbOrTx, id: string): void {
  db.transaction((tx) => {
    const used = tx.select({ n: count() }).from(products).where(eq(products.categoryId, id)).get();
    if ((used?.n ?? 0) > 0) throw new RepoError(`Category is used by ${used?.n} product(s)`, 'in_use');
    const res = tx.delete(categories).where(eq(categories.id, id)).run();
    if (res.changes === 0) throw new RepoError('Category not found', 'not_found');
  });
}
