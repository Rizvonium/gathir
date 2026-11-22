/**
 * A customer's personal catalogue (PLAN §3 Customer book, §4.8 "Their catalogue"): a saved
 * shortlist of designs, each with an optional special rate for this customer and a note.
 * Removal is soft (`removed_at`) with Undo; at most one ACTIVE row per (customer, product).
 * Never exposes buying prices.
 */
import { and, asc, desc, eq, inArray, isNull, max } from 'drizzle-orm';

import { newId } from '@/lib/ids';

import { categories, colours, customerCatalogueItems, customerEvents, customers, photos, products, type CustomerCatalogueItem, type CustomerEvent } from '../schema';
import type { DbOrTx } from '../types';
import { buildCatalogueData, type CatalogueData, type CatalogueOptions } from './catalogueData';
import { stockStatus, type StockStatus } from './constants';
import { assertWhole, RepoError } from './errors';
import { catalogueProductIds, catalogueSentItems, logLikedItem, type CatalogueSentItem } from './events';
import type { ColourSummary } from './productQueries';
import { getLowStockLevel } from './settings';

export type AddToCatalogueInput = {
  customerId: string;
  productId: string;
  /** Omit to keep the current special rate; null clears it. */
  specialRatePaise?: number | null;
  /** Omit to keep the current note. */
  note?: string;
};

export type CustomerCatalogueRow = {
  /** Catalogue item id (use for update / remove / reorder). */
  id: string;
  productId: string;
  code: string;
  name: string;
  craft: string;
  material: string;
  categoryName: string | null;
  coverThumb: string | null;
  coverFile: string | null;
  /** The product's normal selling rate. */
  normalRatePaise: number;
  /** This customer's special rate, or null. */
  specialRatePaise: number | null;
  /** Rate to show / send: special ?? normal. */
  ratePaise: number;
  note: string;
  sortOrder: number;
  addedAt: number;
  /** Live colours with their piece counts (empty for a deleted design). */
  colours: ColourSummary[];
  totalPieces: number;
  status: StockStatus;
  soldOut: boolean;
  /** The design was deleted (in Recently deleted): it is left out of catalogues sent. */
  productDeleted: boolean;
};

export type CatalogueVersion = {
  eventId: string;
  sentAt: number;
  reportId: string | null;
  /** True for a "their catalogue" send (special rates); false for an ordinary catalogue. */
  personal: boolean;
  title: string;
  productIds: string[];
  /** Rates offered, per design (empty for sends logged before rates were kept). */
  items: CatalogueSentItem[];
};

function requireLiveCustomer(db: DbOrTx, customerId: string): { id: string; name: string } {
  const c = db
    .select({ id: customers.id, name: customers.name })
    .from(customers)
    .where(and(eq(customers.id, customerId), isNull(customers.deletedAt)))
    .get();
  if (!c) throw new RepoError('Customer not found', 'not_found');
  return c;
}

function checkRate(rate: number | null | undefined): void {
  if (rate !== undefined && rate !== null) assertWhole(rate, 'Special rate');
}

function nextSortOrder(db: DbOrTx, customerId: string): number {
  const row = db
    .select({ m: max(customerCatalogueItems.sortOrder) })
    .from(customerCatalogueItems)
    .where(and(eq(customerCatalogueItems.customerId, customerId), isNull(customerCatalogueItems.removedAt)))
    .get();
  return (row?.m ?? -1) + 1;
}

function activeItem(db: DbOrTx, customerId: string, productId: string): CustomerCatalogueItem | undefined {
  return db
    .select()
    .from(customerCatalogueItems)
    .where(
      and(
        eq(customerCatalogueItems.customerId, customerId),
        eq(customerCatalogueItems.productId, productId),
        isNull(customerCatalogueItems.removedAt),
      ),
    )
    .get();
}

/**
 * Adds a design to the customer's catalogue (at the end) and returns the item id. Idempotent: an
 * active item is reused (given fields are updated); a removed one is brought back.
 * Throws RepoError('not_found') for a missing/deleted customer or design.
 */
export function addToCustomerCatalogue(db: DbOrTx, input: AddToCatalogueInput, now: number = Date.now()): string {
  checkRate(input.specialRatePaise);
  return db.transaction((tx) => {
    requireLiveCustomer(tx, input.customerId);
    const product = tx
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.id, input.productId), isNull(products.deletedAt)))
      .get();
    if (!product) throw new RepoError('Design not found', 'not_found');

    const patch = {
      ...(input.specialRatePaise !== undefined ? { specialRatePaise: input.specialRatePaise } : {}),
      ...(input.note !== undefined ? { note: input.note.trim() } : {}),
    };
    const active = activeItem(tx, input.customerId, input.productId);
    if (active) {
      if (Object.keys(patch).length > 0) tx.update(customerCatalogueItems).set(patch).where(eq(customerCatalogueItems.id, active.id)).run();
      return active.id;
    }
    const removed = tx
      .select()
      .from(customerCatalogueItems)
      .where(and(eq(customerCatalogueItems.customerId, input.customerId), eq(customerCatalogueItems.productId, input.productId)))
      .orderBy(desc(customerCatalogueItems.removedAt))
      .get();
    const sortOrder = nextSortOrder(tx, input.customerId);
    if (removed) {
      tx.update(customerCatalogueItems)
        .set({ ...patch, removedAt: null, sortOrder, addedAt: now })
        .where(eq(customerCatalogueItems.id, removed.id))
        .run();
      return removed.id;
    }
    const id = newId();
    tx.insert(customerCatalogueItems)
      .values({
        id,
        customerId: input.customerId,
        productId: input.productId,
        specialRatePaise: input.specialRatePaise ?? null,
        note: input.note?.trim() ?? '',
        sortOrder,
        addedAt: now,
      })
      .run();
    return id;
  });
}

/** Soft-removes an item (Undo: restoreCustomerCatalogueItem). Returns false when already removed. */
export function removeFromCustomerCatalogue(db: DbOrTx, itemId: string, now: number = Date.now()): boolean {
  const item = db.select().from(customerCatalogueItems).where(eq(customerCatalogueItems.id, itemId)).get();
  if (!item) throw new RepoError('Catalogue item not found', 'not_found');
  if (item.removedAt !== null) return false;
  db.update(customerCatalogueItems).set({ removedAt: now }).where(eq(customerCatalogueItems.id, itemId)).run();
  return true;
}

/**
 * Undo for removeFromCustomerCatalogue: the item comes back in its old place. Returns false (and
 * changes nothing) when it is not removed, or the design was added again meanwhile.
 */
export function restoreCustomerCatalogueItem(db: DbOrTx, itemId: string): boolean {
  return db.transaction((tx) => {
    const item = tx.select().from(customerCatalogueItems).where(eq(customerCatalogueItems.id, itemId)).get();
    if (!item) throw new RepoError('Catalogue item not found', 'not_found');
    if (item.removedAt === null) return false;
    if (activeItem(tx, item.customerId, item.productId)) return false;
    tx.update(customerCatalogueItems).set({ removedAt: null }).where(eq(customerCatalogueItems.id, itemId)).run();
    return true;
  });
}

/** Changes the special rate (null clears it) and/or the note of an item. */
export function updateCatalogueItem(db: DbOrTx, itemId: string, patch: { specialRatePaise?: number | null; note?: string }): void {
  checkRate(patch.specialRatePaise);
  const set = {
    ...(patch.specialRatePaise !== undefined ? { specialRatePaise: patch.specialRatePaise } : {}),
    ...(patch.note !== undefined ? { note: patch.note.trim() } : {}),
  };
  const exists = db.select({ id: customerCatalogueItems.id }).from(customerCatalogueItems).where(eq(customerCatalogueItems.id, itemId)).get();
  if (!exists) throw new RepoError('Catalogue item not found', 'not_found');
  if (Object.keys(set).length > 0) db.update(customerCatalogueItems).set(set).where(eq(customerCatalogueItems.id, itemId)).run();
}

/** Saves a new order (item ids, first = top). Ids of other customers are ignored. */
export function reorderCustomerCatalogue(db: DbOrTx, customerId: string, orderedItemIds: string[]): void {
  db.transaction((tx) => {
    orderedItemIds.forEach((id, i) => {
      tx.update(customerCatalogueItems)
        .set({ sortOrder: i })
        .where(and(eq(customerCatalogueItems.id, id), eq(customerCatalogueItems.customerId, customerId)))
        .run();
    });
  });
}

/** Active items in the customer's order, with design, cover, rates and availability. */
export function listCustomerCatalogue(db: DbOrTx, customerId: string, lowStockLevel: number = getLowStockLevel(db)): CustomerCatalogueRow[] {
  const items = db
    .select()
    .from(customerCatalogueItems)
    .where(and(eq(customerCatalogueItems.customerId, customerId), isNull(customerCatalogueItems.removedAt)))
    .orderBy(asc(customerCatalogueItems.sortOrder), asc(customerCatalogueItems.addedAt))
    .all();
  if (items.length === 0) return [];
  const ids = [...new Set(items.map((i) => i.productId))];
  const prodRows = db
    .select({
      id: products.id,
      code: products.code,
      name: products.name,
      craft: products.craft,
      material: products.material,
      ratePaise: products.ratePaise,
      deletedAt: products.deletedAt,
      categoryName: categories.name,
      coverThumb: photos.thumbName,
      coverFile: photos.fileName,
    })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .leftJoin(photos, eq(photos.id, products.coverPhotoId))
    .where(inArray(products.id, ids))
    .all();
  const byId = new Map(prodRows.map((p) => [p.id, p]));
  const colourRows = db
    .select({ id: colours.id, productId: colours.productId, name: colours.name, hex: colours.hex, pieces: colours.pieces })
    .from(colours)
    .where(and(inArray(colours.productId, ids), isNull(colours.deletedAt)))
    .orderBy(asc(colours.sortOrder))
    .all();
  const coloursBy = new Map<string, ColourSummary[]>();
  for (const c of colourRows) coloursBy.set(c.productId, [...(coloursBy.get(c.productId) ?? []), { id: c.id, name: c.name, hex: c.hex, pieces: c.pieces }]);

  return items.flatMap((item): CustomerCatalogueRow[] => {
    const p = byId.get(item.productId);
    if (!p) return [];
    const deleted = p.deletedAt !== null;
    const cols = deleted ? [] : (coloursBy.get(p.id) ?? []);
    const totalPieces = cols.reduce((s, c) => s + c.pieces, 0);
    return [
      {
        id: item.id,
        productId: p.id,
        code: p.code,
        name: p.name,
        craft: p.craft,
        material: p.material,
        categoryName: p.categoryName ?? null,
        coverThumb: p.coverThumb ?? null,
        coverFile: p.coverFile ?? null,
        normalRatePaise: p.ratePaise,
        specialRatePaise: item.specialRatePaise,
        ratePaise: item.specialRatePaise ?? p.ratePaise,
        note: item.note,
        sortOrder: item.sortOrder,
        addedAt: item.addedAt,
        colours: cols,
        totalPieces,
        status: stockStatus(totalPieces, lowStockLevel),
        soldOut: totalPieces <= 0,
        productDeleted: deleted,
      },
    ];
  });
}

/** Product ids of the customer's active catalogue items, in order (deleted designs included). */
export function customerCatalogueProductIds(db: DbOrTx, customerId: string): string[] {
  return db
    .select({ productId: customerCatalogueItems.productId })
    .from(customerCatalogueItems)
    .where(and(eq(customerCatalogueItems.customerId, customerId), isNull(customerCatalogueItems.removedAt)))
    .orderBy(asc(customerCatalogueItems.sortOrder), asc(customerCatalogueItems.addedAt))
    .all()
    .map((r) => r.productId);
}

/**
 * CatalogueData for "Send their catalogue": the customer's designs in their order (deleted designs
 * left out, sold-out ones per `options.hideSoldOut`), with the special rate shown instead of the
 * normal rate where set (`specialPrice: true`), and `preparedFor` = the customer's name.
 */
export function buildCustomerCatalogueData(db: DbOrTx, customerId: string, options: CatalogueOptions, now: number = Date.now()): CatalogueData {
  const customer = requireLiveCustomer(db, customerId);
  const items = db
    .select()
    .from(customerCatalogueItems)
    .where(and(eq(customerCatalogueItems.customerId, customerId), isNull(customerCatalogueItems.removedAt)))
    .orderBy(asc(customerCatalogueItems.sortOrder), asc(customerCatalogueItems.addedAt))
    .all();
  const special = new Map(items.map((i) => [i.productId, i.specialRatePaise]));
  const data = buildCatalogueData(db, { productIds: items.map((i) => i.productId) }, options, now);
  return {
    ...data,
    preparedFor: customer.name,
    customerId: customer.id,
    products: data.products.map((p) => {
      const rate = special.get(p.id) ?? null;
      if (!options.showRates || rate === null) return { ...p, specialPrice: false };
      return { ...p, ratePaise: rate, specialPrice: true };
    }),
  };
}

/** What a sent catalogue offered (pass to logCatalogueSent's `snapshot.items`). */
export function catalogueSnapshot(data: CatalogueData): CatalogueSentItem[] {
  return data.products.map((p) => ({ productId: p.id, name: p.name, ratePaise: p.ratePaise, specialPrice: p.specialPrice === true }));
}

/** Every catalogue sent to this customer, newest first, with the rates offered when known. */
export function catalogueVersions(db: DbOrTx, customerId: string): CatalogueVersion[] {
  const events: CustomerEvent[] = db
    .select()
    .from(customerEvents)
    .where(and(eq(customerEvents.customerId, customerId), eq(customerEvents.kind, 'catalogue_sent')))
    .orderBy(desc(customerEvents.createdAt))
    .all();
  return events.map((e) => {
    let personal = false;
    let title = '';
    try {
      const v = JSON.parse(e.note) as { personal?: unknown; title?: unknown };
      personal = v.personal === true;
      title = typeof v.title === 'string' ? v.title : '';
    } catch {
      // older or damaged note: ids only
    }
    return {
      eventId: e.id,
      sentAt: e.createdAt,
      reportId: e.refId,
      personal,
      title,
      productIds: catalogueProductIds(e),
      items: catalogueSentItems(e),
    };
  });
}

/**
 * Showroom "they liked this": logs a liked_item event AND adds the design to the customer's
 * catalogue, in one transaction. Undo: deleteEvent(eventId) and, when `added`,
 * removeFromCustomerCatalogue(itemId).
 */
export function likeAndAddToCatalogue(
  db: DbOrTx,
  customerId: string,
  productId: string,
  now: number = Date.now(),
): { eventId: string; itemId: string; added: boolean } {
  return db.transaction((tx) => {
    const wasActive = !!activeItem(tx, customerId, productId);
    const itemId = addToCustomerCatalogue(tx, { customerId, productId }, now);
    const eventId = logLikedItem(tx, customerId, productId, now);
    return { eventId, itemId, added: !wasActive };
  });
}
