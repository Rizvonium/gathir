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

export const deletedHref = () => href('/deleted');
