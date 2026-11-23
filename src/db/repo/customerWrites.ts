/** Customer book writes: create (with duplicate-phone guard), edit, soft delete, restore, purge. */
import { and, eq, inArray, isNotNull, isNull, lt, ne } from 'drizzle-orm';

import { newId } from '@/lib/ids';
import { toE164 } from '@/lib/phone';

import { customerCatalogueItems, customerEvents, customers, reports, sales, type Customer, type CustomerLikes, type CustomerTag } from '../schema';
import type { DbOrTx } from '../types';
import { chunk, DAY_MS, RECENTLY_DELETED_DAYS } from './constants';
import { DuplicateCustomerError, RepoError, requireText } from './errors';

export type CustomerInput = {
  name: string;
  phone?: string | null;
  whatsappOk?: boolean;
  city?: string;
  address?: string;
  tag?: CustomerTag;
  notes?: string;
  likes?: CustomerLikes;
};

const EMPTY_LIKES: CustomerLikes = { colours: [], crafts: [] };

/**
 * Normalises a phone number to E.164 where the shape is obvious (Indian 10-digit
 * numbers get +91). Returns null for blank input.
 */
export function normalizePhone(phone: string | null | undefined): string | null {
  const raw = (phone ?? '').replace(/[\s\-().]/g, '');
  if (!raw) return null;
  // Valid numbers: libphonenumber's E.164 (same as PhoneInput stores). Others: keep a best guess.
  const e164 = toE164(raw);
  if (e164) return e164;
  if (raw.startsWith('+')) return raw;
  if (/^0\d{10}$/.test(raw)) return `+91${raw.slice(1)}`;
  if (/^\d{10}$/.test(raw)) return `+91${raw}`;
  if (/^91\d{10}$/.test(raw)) return `+${raw}`;
  if (raw.startsWith('00')) return `+${raw.slice(2)}`;
  return raw;
}

/** Parses likes_json defensively (bad JSON gives empty likes). */
export function parseLikes(json: string): CustomerLikes {
  try {
    const v = JSON.parse(json) as Partial<CustomerLikes> | null;
    if (!v || typeof v !== 'object') return { ...EMPTY_LIKES };
    const strings = (a: unknown): string[] => (Array.isArray(a) ? a.filter((x): x is string => typeof x === 'string') : []);
    const likes: CustomerLikes = { colours: strings(v.colours), crafts: strings(v.crafts) };
    if (typeof v.budgetMinPaise === 'number') likes.budgetMinPaise = v.budgetMinPaise;
    if (typeof v.budgetMaxPaise === 'number') likes.budgetMaxPaise = v.budgetMaxPaise;
    return likes;
  } catch {
    return { ...EMPTY_LIKES };
  }
}

/** Live (not deleted) customer with this phone, or null. */
export function findByPhone(db: DbOrTx, phone: string | null | undefined): Customer | null {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  return (
    db
      .select()
      .from(customers)
      .where(and(eq(customers.phone, normalized), isNull(customers.deletedAt)))
      .get() ?? null
  );
}

/**
 * Adds a customer. Throws DuplicateCustomerError (with the existing id and name) when a
 * live customer already has this phone. Returns the new id.
 */
export function createCustomer(db: DbOrTx, input: CustomerInput, now: number = Date.now(), opts: { id?: string } = {}): string {
  const name = requireText(input.name, 'Name');
  const phone = normalizePhone(input.phone);
  return db.transaction((tx) => {
    const existing = findByPhone(tx, phone);
    if (existing) throw new DuplicateCustomerError(existing.id, existing.name);
    const id = opts.id ?? newId();
    tx.insert(customers)
      .values({
        id,
        name,
        phone,
        // Consent to catalogues is never assumed (PLAN §15): only an explicit yes counts.
        whatsappOk: input.whatsappOk ?? false,
        city: input.city ?? '',
        address: input.address ?? '',
        tag: input.tag ?? 'regular',
        notes: input.notes ?? '',
        likesJson: JSON.stringify(input.likes ?? EMPTY_LIKES),
        createdAt: now,
        updatedAt: now,
      })
      .run();
    return id;
  });
}

/** Edits a customer. Changing the phone to another live customer's number throws DuplicateCustomerError. */
export function updateCustomer(db: DbOrTx, id: string, patch: Partial<CustomerInput>, now: number = Date.now()): void {
  db.transaction((tx) => {
    const current = tx.select().from(customers).where(eq(customers.id, id)).get();
    if (!current) throw new RepoError('Customer not found', 'not_found');
    const set: Partial<typeof customers.$inferInsert> = { updatedAt: now };
    if (patch.name !== undefined) set.name = requireText(patch.name, 'Name');
    if (patch.phone !== undefined) {
      const phone = normalizePhone(patch.phone);
      if (phone) {
        const other = tx
          .select()
          .from(customers)
          .where(and(eq(customers.phone, phone), isNull(customers.deletedAt), ne(customers.id, id)))
          .get();
        if (other) throw new DuplicateCustomerError(other.id, other.name);
      }
      set.phone = phone;
    }
    if (patch.whatsappOk !== undefined) set.whatsappOk = patch.whatsappOk;
    if (patch.city !== undefined) set.city = patch.city;
    if (patch.address !== undefined) set.address = patch.address;
    if (patch.tag !== undefined) set.tag = patch.tag;
    if (patch.notes !== undefined) set.notes = patch.notes;
    if (patch.likes !== undefined) set.likesJson = JSON.stringify(patch.likes);
    tx.update(customers).set(set).where(eq(customers.id, id)).run();
  });
}

/** Moves a customer to Recently deleted. Their sales keep name/phone so Undo is exact. */
export function softDeleteCustomer(db: DbOrTx, id: string, now: number = Date.now()): void {
  const res = db
    .update(customers)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(customers.id, id), isNull(customers.deletedAt)))
    .run();
  if (res.changes === 0 && !db.select({ id: customers.id }).from(customers).where(eq(customers.id, id)).get()) {
    throw new RepoError('Customer not found', 'not_found');
  }
}

/** Brings a deleted customer back. Throws DuplicateCustomerError if their phone now belongs to someone else. */
export function restoreCustomer(db: DbOrTx, id: string, now: number = Date.now()): void {
  db.transaction((tx) => {
    const c = tx.select().from(customers).where(eq(customers.id, id)).get();
    if (!c) throw new RepoError('Customer not found', 'not_found');
    if (c.deletedAt === null) return;
    const clash = findByPhone(tx, c.phone);
    if (clash) throw new DuplicateCustomerError(clash.id, clash.name);
    tx.update(customers).set({ deletedAt: null, updatedAt: now }).where(eq(customers.id, id)).run();
  });
}

/**
 * Permanently removes customers deleted more than `days` ago: clears the name/phone
 * snapshots and link on their sales (amounts stay), deletes their timeline events.
 * Returns the purged ids.
 */
export function purgeDeletedCustomers(db: DbOrTx, now: number = Date.now(), days: number = RECENTLY_DELETED_DAYS): string[] {
  const cutoff = now - days * DAY_MS;
  return db.transaction((tx) => {
    const ids = tx
      .select({ id: customers.id })
      .from(customers)
      .where(and(isNotNull(customers.deletedAt), lt(customers.deletedAt, cutoff)))
      .all()
      .map((c) => c.id);
    for (const part of chunk(ids, 200)) eraseCustomers(tx, part);
    return ids;
  });
}

/** Erases customers right away (used by purge and by clearing sample data). */
export function eraseCustomers(tx: DbOrTx, ids: string[]): void {
  if (ids.length === 0) return;
  tx.update(sales)
    .set({ customerId: null, customerNameSnapshot: null, customerPhoneSnapshot: null })
    .where(inArray(sales.customerId, ids))
    .run();
  tx.update(reports).set({ customerId: null }).where(inArray(reports.customerId, ids)).run();
  tx.delete(customerEvents).where(inArray(customerEvents.customerId, ids)).run();
  tx.delete(customerCatalogueItems).where(inArray(customerCatalogueItems.customerId, ids)).run();
  tx.delete(customers).where(inArray(customers.id, ids)).run();
}
