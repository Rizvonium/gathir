/** Route builders for the customers feature (ROUTE CONTRACT paths only). */
import type { Href } from 'expo-router';

const href = (pathname: string, params?: Record<string, string>): Href =>
  (params ? { pathname, params } : pathname) as unknown as Href;

/** Drops empty values so URLs stay clean. */
function clean(params: Record<string, string | null | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) if (v) out[k] = v;
  return out;
}

export const customerHref = (id: string) => href('/customer/[id]', { id });
export const editCustomerHref = (id: string) => href('/customer/[id]/edit', { id });

/** Add customer, optionally pre-filled (from contacts, or from the Sell sheet). */
export function newCustomerHref(opts: { name?: string | null; phone?: string | null; returnTo?: string | null } = {}): Href {
  const params = clean(opts);
  return href('/customer/new', Object.keys(params).length ? params : undefined);
}

export const sellToHref = (customerId: string) => href('/sell', { customerId });
export const saleHref = (saleId: string) => href('/sale/[id]', { id: saleId });
export const productHref = (productId: string) => href('/product/[id]', { id: productId });

/** Catalogue flow for this customer, with products pre-picked when given. */
export function catalogueHref(customerId: string, productIds: readonly string[] = []): Href {
  return href('/catalogue', clean({ customerId, productIds: productIds.join(',') }));
}

/** "Send their catalogue": the catalogue flow opened on this customer's personal catalogue. */
export const theirCatalogueHref = (customerId: string) => href('/catalogue', { customerId, mode: 'customer' });

/** Product picker that adds designs to this customer's catalogue. */
export const addPiecesHref = (customerId: string) => href('/customer/[id]/add-pieces', { id: customerId });

export const editProductHref = (productId: string) => href('/product/[id]/edit', { id: productId });

export const deletedHref = () => href('/deleted');

/** What a link into the Customers tab turns on ("See all" on Home's follow-ups). */
export type CustomerListSeed = { key: string; followUpDue: boolean };

/**
 * Customers tab with "Follow-up due" on. `at` makes every tap a new link, so the filter is
 * turned on again even when the tab is already open with these params.
 */
export const dueCustomersHref = (at: number = Date.now()) => href('/customers', { filter: 'due', at: String(at) });

/** Reads the Customers tab's link params (null when there is nothing to turn on). */
export function customerListSeed(params: { filter?: string | string[]; at?: string | string[] }): CustomerListSeed | null {
  const filter = Array.isArray(params.filter) ? params.filter[0] : params.filter;
  const at = Array.isArray(params.at) ? params.at[0] : params.at;
  if (filter !== 'due') return null;
  return { key: `${filter}:${at ?? ''}`, followUpDue: true };
}
