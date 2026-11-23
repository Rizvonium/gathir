/**
 * Builds the catalogue data for a flow selection: a plain selection goes through
 * buildCatalogueData; a customer's personal catalogue through buildCustomerCatalogueData (special
 * rates, "Prepared for <name>"). Sync repo calls only, so it runs in Node tests. Never carries cost.
 */
import { buildCustomerCatalogueData, catalogueSnapshot } from '@/db/repo/customerCatalogue';
import type { CatalogueSentItem } from '@/db/repo/events';
import { buildCatalogueData, type CatalogueData, type CatalogueOptions } from '@/db/repo/reports';
import type { DbOrTx } from '@/db/types';

import type { Recipient } from './recipient';
import { isCustomerCatalogue, type FlowSelection } from './selection';

export function buildFlowData(db: DbOrTx, selection: FlowSelection, options: CatalogueOptions, now: number = Date.now()): CatalogueData {
  return isCustomerCatalogue(selection)
    ? buildCustomerCatalogueData(db, selection.customerCatalogue, options, now)
    : buildCatalogueData(db, selection, options, now);
}

/** True for data made from a customer's personal catalogue. */
export function isPersonalData(data: CatalogueData): boolean {
  return !!data.customerId;
}

/** The customer a personal catalogue belongs to (and may only be sent to); null for a plain one. */
export function personalOwner(data: CatalogueData): string | null {
  return data.customerId || null;
}

/**
 * Whether this catalogue may go to this recipient. A personal catalogue carries that customer's
 * special rates, so it goes only to them: never to another customer, a typed number or a chat.
 */
export function mayReceive(data: CatalogueData, recipient: Recipient): boolean {
  const owner = personalOwner(data);
  return !owner || (recipient.kind === 'customer' && recipient.id === owner);
}

/** Rates offered in what was actually sent (only the given product ids, in that order). */
export function sentSnapshot(data: CatalogueData, sentIds: readonly string[]): CatalogueSentItem[] {
  const byId = new Map(catalogueSnapshot(data).map((i) => [i.productId, i]));
  return sentIds.flatMap((id) => {
    const item = byId.get(id);
    return item ? [item] : [];
  });
}
