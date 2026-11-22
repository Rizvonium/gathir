/**
 * "Their catalogue" on the customer profile (PLAN §3 Customer book, §4.8). Pure: no React, no expo.
 * Never handles buying prices: rows come from listCustomerCatalogue, which carries none.
 */
import type { CatalogueVersion, CustomerCatalogueRow } from '@/db/repo/customerCatalogue';

/** Moves one id up (-1) or down (+1). Returns the same order when the move is not possible. */
export function moveItem(ids: readonly string[], id: string, dir: -1 | 1): string[] {
  const from = ids.indexOf(id);
  const to = from + dir;
  if (from < 0 || to < 0 || to >= ids.length) return [...ids];
  const out = [...ids];
  out[from] = ids[to];
  out[to] = id;
  return out;
}

export type TheirCatalogueCounts = {
  /** Every active item. */
  total: number;
  soldOut: number;
  /** Designs in Recently deleted: never sent. */
  deleted: number;
  withSpecialRate: number;
  /** Items that go in the PDF with sold-out ones left out (the default). */
  sendable: number;
  /** Items that go in the PDF when sold-out ones are included. */
  sendableWithSoldOut: number;
};

export function theirCatalogueCounts(rows: readonly CustomerCatalogueRow[]): TheirCatalogueCounts {
  const deleted = rows.filter((r) => r.productDeleted).length;
  const soldOut = rows.filter((r) => !r.productDeleted && r.soldOut).length;
  return {
    total: rows.length,
    soldOut,
    deleted,
    withSpecialRate: rows.filter((r) => r.specialRatePaise !== null).length,
    sendable: rows.length - deleted - soldOut,
    sendableWithSoldOut: rows.length - deleted,
  };
}

export type ItemAvailability = 'deleted' | 'out' | 'low' | 'in';

export function itemAvailability(row: Pick<CustomerCatalogueRow, 'productDeleted' | 'soldOut' | 'status'>): ItemAvailability {
  if (row.productDeleted) return 'deleted';
  if (row.soldOut) return 'out';
  return row.status === 'low' ? 'low' : 'in';
}

/**
 * Whole percent the special rate is below the normal rate (e.g. 10 for ₹9,000 vs ₹10,000).
 * Negative when the special rate is higher; null without a special rate or a normal rate.
 */
export function specialRateOffPct(normalRatePaise: number, specialRatePaise: number | null): number | null {
  if (specialRatePaise === null || normalRatePaise <= 0) return null;
  return Math.round(((normalRatePaise - specialRatePaise) / normalRatePaise) * 100);
}

/** The special rate to save from the edit sheet: empty, zero or the normal rate itself = no special rate. */
export function specialRateToSave(normalRatePaise: number, input: number | null): number | null {
  if (input === null || input <= 0) return null;
  if (input === normalRatePaise) return null;
  return input;
}

export type PickerFilter = { search: string; categoryId: string | null };

type PickerProduct = { id: string; name: string; code: string; craft: string; categoryId: string | null };

/** Product picker filter: by category, then by name / code / craft (case-insensitive). */
export function filterPickerProducts<T extends PickerProduct>(products: readonly T[], filter: PickerFilter): T[] {
  const q = filter.search.trim().toLowerCase();
  return products.filter((p) => {
    if (filter.categoryId && p.categoryId !== filter.categoryId) return false;
    if (!q) return true;
    return p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || p.craft.toLowerCase().includes(q);
  });
}

/** Ids to add from the picker: picked ones that are not already in their catalogue, in picking order. */
export function idsToAdd(picked: readonly string[], already: ReadonlySet<string>): string[] {
  return [...new Set(picked)].filter((id) => !already.has(id));
}

/** One sent version, ready for a row: how many designs and how many at a special rate. */
export function versionCounts(v: CatalogueVersion): { items: number; special: number } {
  const items = v.items.length > 0 ? v.items.length : v.productIds.length;
  return { items, special: v.items.filter((i) => i.specialPrice).length };
}
