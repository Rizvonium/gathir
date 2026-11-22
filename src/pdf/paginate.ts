/**
 * Deterministic catalogue pagination. Android's print engine does not reliably support CSS page
 * counters, so pages are laid out in TypeScript: a fixed number of cards per A4 page, and every
 * page gets its own footer with "Page n of N".
 */
import { chunk } from './html';
import type { CatalogueAvailability, CatalogueColumns, CatalogueDocOptions } from './types';

/** Cards per product page: 2 columns → 2×2, 3 columns → 3×2 (cards are sized to fit exactly). */
export function itemsPerPage(columns: CatalogueColumns): number {
  return columns === 3 ? 6 : 4;
}

export type CataloguePage<T> =
  | { kind: 'cover'; pageNumber: number }
  | { kind: 'products'; pageNumber: number; items: T[] }
  | { kind: 'order'; pageNumber: number };

/** Cover, then product pages, then the "How to order" page. Page numbers start at 1. */
export function paginateCatalogue<T>(items: readonly T[], columns: CatalogueColumns): { pages: CataloguePage<T>[]; total: number } {
  const groups = chunk(items, itemsPerPage(columns));
  const pages: CataloguePage<T>[] = [{ kind: 'cover', pageNumber: 1 }];
  groups.forEach((g, i) => pages.push({ kind: 'products', pageNumber: i + 2, items: g }));
  pages.push({ kind: 'order', pageNumber: pages.length + 1 });
  return { pages, total: pages.length };
}

/** Applies "Hide sold-out" to a catalogue's items. */
export function visibleCatalogueItems<T extends { availability: CatalogueAvailability }>(
  items: readonly T[],
  options: Pick<CatalogueDocOptions, 'hideSoldOut'>,
): T[] {
  return options.hideSoldOut ? items.filter((i) => i.availability.kind !== 'sold_out') : [...items];
}
