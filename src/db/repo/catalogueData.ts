/** View model for the customer catalogue PDF and Showroom (docs/PLAN.md §6). Never includes cost. */
import { asc, eq, inArray } from 'drizzle-orm';

import { categories, photos } from '../schema';
import type { DbOrTx } from '../types';
import { loadLiveProducts } from './productQueries';
import { getSettings } from './settings';
import { getShopInfo, type ShopInfo } from './shopInfo';

export type CatalogueSelection = 'all' | { productIds: string[] } | { categoryId: string };
export type CatalogueOptions = { hideSoldOut: boolean; showRates: boolean; showCounts: boolean };

/** 'few' = show "Only n left" (count is always given for 'few'). */
export type Availability = { kind: 'available' } | { kind: 'few'; count: number } | { kind: 'sold_out' };

export type CatalogueProduct = {
  id: string;
  code: string;
  name: string;
  categoryName: string | null;
  craft: string;
  material: string;
  size: string;
  /** Null when rates are hidden. */
  ratePaise: number | null;
  /** Null unless exact counts are shown. */
  totalPieces: number | null;
  availability: Availability;
  /** Only colours with pieces > 0. `pieces` is null unless exact counts are shown. */
  colours: { name: string; hex: string; pieces: number | null }[];
  cover: { fileName: string; thumbName: string } | null;
  /** All photo file names in order (cover first). */
  photoFileNames: string[];
};

export type CatalogueData = {
  shop: ShopInfo;
  generatedAt: number;
  options: CatalogueOptions;
  products: CatalogueProduct[];
};

/** Up to this many pieces counts as "Only n left". */
export function fewThreshold(lowStockLevel: number): number {
  return Math.max(2, lowStockLevel);
}

/**
 * Builds catalogue data for all stock, one category or hand-picked products (kept in the
 * picked order; otherwise category order then newest). Deleted products never appear.
 */
export function buildCatalogueData(
  db: DbOrTx,
  selection: CatalogueSelection,
  options: CatalogueOptions,
  now: number = Date.now(),
): CatalogueData {
  const level = getSettings(db).lowStockLevel;
  const few = fewThreshold(level);
  let rows = loadLiveProducts(db, level);
  if (selection !== 'all' && 'productIds' in selection) {
    const order = new Map(selection.productIds.map((id, i) => [id, i]));
    rows = rows.filter((r) => order.has(r.id)).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  } else {
    if (selection !== 'all') rows = rows.filter((r) => r.categoryId === selection.categoryId);
    const catOrder = new Map(
      db
        .select({ id: categories.id })
        .from(categories)
        .orderBy(asc(categories.sortOrder))
        .all()
        .map((c, i) => [c.id, i]),
    );
    const pos = (id: string | null) => (id ? (catOrder.get(id) ?? 999) : 1000);
    rows = [...rows].sort((a, b) => pos(a.categoryId) - pos(b.categoryId) || b.createdAt - a.createdAt);
  }
  if (options.hideSoldOut) rows = rows.filter((r) => r.totalPieces > 0);

  const photoRows =
    rows.length === 0
      ? []
      : db
          .select({ productId: photos.productId, fileName: photos.fileName })
          .from(photos)
          .where(
            inArray(
              photos.productId,
              rows.map((r) => r.id),
            ),
          )
          .orderBy(asc(photos.sortOrder))
          .all();
  const filesBy = new Map<string, string[]>();
  for (const p of photoRows) filesBy.set(p.productId, [...(filesBy.get(p.productId) ?? []), p.fileName]);

  const products: CatalogueProduct[] = rows.map((r) => {
    const availability: Availability =
      r.totalPieces <= 0 ? { kind: 'sold_out' } : r.totalPieces <= few ? { kind: 'few', count: r.totalPieces } : { kind: 'available' };
    return {
      id: r.id,
      code: r.code,
      name: r.name,
      categoryName: r.categoryName,
      craft: r.craft,
      material: r.material,
      size: r.size,
      ratePaise: options.showRates ? r.ratePaise : null,
      totalPieces: options.showCounts ? r.totalPieces : null,
      availability,
      colours: r.colours
        .filter((c) => c.pieces > 0)
        .map((c) => ({ name: c.name, hex: c.hex, pieces: options.showCounts ? c.pieces : null })),
      cover: r.coverFile && r.coverThumb ? { fileName: r.coverFile, thumbName: r.coverThumb } : null,
      photoFileNames: filesBy.get(r.id) ?? [],
    };
  });
  return { shop: getShopInfo(db), generatedAt: now, options, products };
}

/** Category name lookup, for catalogue titles. */
export function categoryName(db: DbOrTx, categoryId: string): string | null {
  return db.select({ name: categories.name }).from(categories).where(eq(categories.id, categoryId)).get()?.name ?? null;
}
