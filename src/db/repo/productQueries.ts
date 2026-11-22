/** Product reads for Stock, Product detail and other screens. */
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';

import { categories, colours, photos, products, sales, stockMoves, type Category, type Colour, type Photo, type Product, type StockReason } from '../schema';
import type { DbOrTx } from '../types';
import { stockStatus, type StockStatus } from './constants';
import { displayNote } from './moveNotes';
import { liveColours } from './productWrites';

export type ColourSummary = { id: string; name: string; hex: string; pieces: number };

/** One product in a list. Never includes cost price. */
export type ProductListRow = {
  id: string;
  code: string;
  name: string;
  categoryId: string | null;
  categoryName: string | null;
  craft: string;
  material: string;
  size: string;
  ratePaise: number;
  oneOfAKind: boolean;
  isSample: boolean;
  createdAt: number;
  totalPieces: number;
  status: StockStatus;
  colours: ColourSummary[];
  coverThumb: string | null;
  coverFile: string | null;
};

export type ProductFilter = 'all' | 'low' | 'out' | 'in';
export type ProductSort = 'newest' | 'most' | 'least' | 'rate_high' | 'rate_low' | 'name';
export type ProductListFilters = {
  search?: string;
  categoryId?: string | null;
  filter?: ProductFilter;
  sort?: ProductSort;
  /** Defaults to 1 (shop_settings.low_stock_level). */
  lowStockLevel?: number;
};

export type ProductDetail = {
  product: Product;
  category: Category | null;
  colours: Colour[];
  photos: Photo[];
  totalPieces: number;
  status: StockStatus;
};

export type StockHistoryRow = {
  id: string;
  at: number;
  delta: number;
  reason: StockReason;
  note: string;
  colourId: string;
  colourName: string;
  colourHex: string;
  saleId: string | null;
  billNo: string | null;
};

/** Product with category, live colours, photos (cover first) and total pieces, or null. */
export function getProductDetail(db: DbOrTx, productId: string, lowStockLevel = 1): ProductDetail | null {
  const product = db.select().from(products).where(eq(products.id, productId)).get();
  if (!product) return null;
  const category = product.categoryId
    ? (db.select().from(categories).where(eq(categories.id, product.categoryId)).get() ?? null)
    : null;
  const cols = liveColours(db, productId);
  const ph = db.select().from(photos).where(eq(photos.productId, productId)).orderBy(asc(photos.sortOrder)).all();
  const totalPieces = cols.reduce((s, c) => s + c.pieces, 0);
  return { product, category, colours: cols, photos: ph, totalPieces, status: stockStatus(totalPieces, lowStockLevel) };
}

/** Every live (not deleted) product as a list row, newest first. Building block for other queries. */
export function loadLiveProducts(db: DbOrTx, lowStockLevel = 1): ProductListRow[] {
  const rows = db
    .select({
      id: products.id,
      code: products.code,
      name: products.name,
      categoryId: products.categoryId,
      categoryName: categories.name,
      craft: products.craft,
      material: products.material,
      size: products.size,
      ratePaise: products.ratePaise,
      oneOfAKind: products.oneOfAKind,
      isSample: products.isSample,
      createdAt: products.createdAt,
      coverThumb: photos.thumbName,
      coverFile: photos.fileName,
    })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .leftJoin(photos, eq(photos.id, products.coverPhotoId))
    .where(isNull(products.deletedAt))
    .orderBy(desc(products.createdAt), asc(products.name))
    .all();
  const colourRows = db
    .select({ id: colours.id, productId: colours.productId, name: colours.name, hex: colours.hex, pieces: colours.pieces })
    .from(colours)
    .innerJoin(products, eq(products.id, colours.productId))
    .where(and(isNull(colours.deletedAt), isNull(products.deletedAt)))
    .orderBy(asc(colours.sortOrder))
    .all();
  const byProduct = new Map<string, ColourSummary[]>();
  for (const c of colourRows) {
    const list = byProduct.get(c.productId) ?? [];
    list.push({ id: c.id, name: c.name, hex: c.hex, pieces: c.pieces });
    byProduct.set(c.productId, list);
  }
  return rows.map((r) => {
    const cols = byProduct.get(r.id) ?? [];
    const totalPieces = cols.reduce((s, c) => s + c.pieces, 0);
    return {
      ...r,
      coverThumb: r.coverThumb ?? null,
      coverFile: r.coverFile ?? null,
      totalPieces,
      status: stockStatus(totalPieces, lowStockLevel),
      colours: cols,
    };
  });
}

function matchesSearch(row: ProductListRow, q: string): boolean {
  const hay = [row.name, row.code, row.craft, row.material, row.size, row.categoryName ?? '', ...row.colours.map((c) => c.name)]
    .join(' ')
    .toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => hay.includes(word));
}

const SORTERS: Record<ProductSort, (a: ProductListRow, b: ProductListRow) => number> = {
  newest: (a, b) => b.createdAt - a.createdAt,
  most: (a, b) => b.totalPieces - a.totalPieces,
  least: (a, b) => a.totalPieces - b.totalPieces,
  rate_high: (a, b) => b.ratePaise - a.ratePaise,
  rate_low: (a, b) => a.ratePaise - b.ratePaise,
  name: () => 0,
};

/**
 * Stock list: search (name, code, craft, material, colour, category), category chip,
 * filter ('in' = has pieces, 'low', 'out') and sort.
 */
export function listProducts(db: DbOrTx, filters: ProductListFilters = {}): ProductListRow[] {
  const { search = '', categoryId, filter = 'all', sort = 'newest', lowStockLevel = 1 } = filters;
  const q = search.trim();
  return loadLiveProducts(db, lowStockLevel)
    .filter((r) => !categoryId || r.categoryId === categoryId)
    .filter((r) => {
      if (filter === 'all') return true;
      if (filter === 'in') return r.totalPieces > 0;
      return r.status === filter;
    })
    .filter((r) => !q || matchesSearch(r, q))
    .sort((a, b) => SORTERS[sort](a, b) || a.name.localeCompare(b.name));
}

/** Every stock change for a product, newest first, with colour names and bill numbers. */
export function stockHistory(db: DbOrTx, productId: string): StockHistoryRow[] {
  return db
    .select({
      id: stockMoves.id,
      at: stockMoves.createdAt,
      delta: stockMoves.delta,
      reason: stockMoves.reason,
      note: stockMoves.note,
      colourId: stockMoves.colourId,
      colourName: colours.name,
      colourHex: colours.hex,
      saleId: stockMoves.saleId,
      billNo: sales.billNo,
    })
    .from(stockMoves)
    .innerJoin(colours, eq(colours.id, stockMoves.colourId))
    .leftJoin(sales, eq(sales.id, stockMoves.saleId))
    .where(eq(stockMoves.productId, productId))
    .orderBy(desc(stockMoves.createdAt), sql`"stock_moves"."rowid" desc`)
    .all()
    // A voided sale no longer exists: keep the move, drop the dead link.
    .map((r) => ({ ...r, note: displayNote(r.note), billNo: r.billNo ?? null, saleId: r.billNo ? r.saleId : null }));
}
