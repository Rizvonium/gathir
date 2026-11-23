/** Route builders for links out of the stock feature (ROUTE CONTRACT paths only). */
import type { Href } from 'expo-router';

import type { ProductFilter, ProductSort } from '@/db/repo/productQueries';

type ColourLike = { id: string; pieces: number };

/**
 * Sell sheet for a product. Pre-picks the colour when exactly one colour has pieces left
 * (one tap fewer); otherwise the sheet asks. `qty` (> 1) starts the sheet on that many pieces.
 */
export function sellHref(productId: string, colours: readonly ColourLike[], colourId?: string, qty?: number): Href {
  const inStock = colours.filter((c) => c.pieces > 0);
  const picked = colourId ?? (inStock.length === 1 ? inStock[0].id : undefined);
  const params: Record<string, string> = picked ? { productId, colourId: picked } : { productId };
  // A quantity already chosen (e.g. "Sold" for 3 in the reduce sheet) carries over.
  if (picked && qty && qty > 1) params.qty = String(Math.round(qty));
  return { pathname: '/sell', params } as unknown as Href;
}

/** Catalogue flow with these products pre-picked. */
export function catalogueHref(productIds: readonly string[]): Href {
  return { pathname: '/catalogue', params: { productIds: productIds.join(',') } } as unknown as Href;
}

/** Product card image for one product. */
export function productCardHref(productId: string): Href {
  return { pathname: '/catalogue/card', params: { productId } } as unknown as Href;
}

export function productHref(productId: string): Href {
  return { pathname: '/product/[id]', params: { id: productId } } as unknown as Href;
}

export function editProductHref(productId: string): Href {
  return { pathname: '/product/[id]/edit', params: { id: productId } } as unknown as Href;
}

export function saleHref(saleId: string): Href {
  return { pathname: '/sale/[id]', params: { id: saleId } } as unknown as Href;
}

/** What a link into the Stock tab turns on ("See all" on Home's Needs attention). */
export type StockListSeed = { key: string; filter: ProductFilter; sort: ProductSort };

const FILTERS: readonly ProductFilter[] = ['all', 'low', 'out', 'in'];
const SORTS: readonly ProductSort[] = ['newest', 'most', 'least', 'rate_high', 'rate_low', 'name'];

/**
 * Stock tab opened on a filter and sort. `at` makes every tap a new link, so the filter is
 * applied again even when the tab is already open with these params.
 */
export function stockListHref(filter: ProductFilter, sort: ProductSort, at: number = Date.now()): Href {
  return { pathname: '/stock', params: { filter, sort, at: String(at) } } as unknown as Href;
}

/**
 * Needs attention → Stock: sold-out and low designs (sold-out listed first). One kind only: that
 * chip. Both: every design, fewest pieces first, so sold-out then low come at the top. `more`:
 * the strip was cut short, so after a sold-out row there may still be low ones.
 */
export function attentionStockHref(statuses: readonly ('out' | 'low')[], more = false, at: number = Date.now()): Href {
  const kinds = new Set(statuses);
  if (more && statuses[statuses.length - 1] === 'out') kinds.add('low');
  const filter: ProductFilter = kinds.size === 1 ? [...kinds][0] : 'all';
  return stockListHref(filter, 'least', at);
}

/** Reads the Stock tab's link params (null when there is nothing to apply). */
export function stockListSeed(params: { filter?: string | string[]; sort?: string | string[]; at?: string | string[] }): StockListSeed | null {
  const one = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v);
  const filter = one(params.filter);
  const sort = one(params.sort);
  if (!filter && !sort) return null;
  return {
    key: `${filter ?? ''}:${sort ?? ''}:${one(params.at) ?? ''}`,
    filter: FILTERS.includes(filter as ProductFilter) ? (filter as ProductFilter) : 'all',
    sort: SORTS.includes(sort as ProductSort) ? (sort as ProductSort) : 'newest',
  };
}
