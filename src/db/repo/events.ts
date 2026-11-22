/** Customer timeline events: notes, catalogues/cards sent, liked items and follow-ups. */
import { and, asc, eq, isNotNull, isNull, lte } from 'drizzle-orm';

import { endOfDay } from '@/lib/dates';
import { newId } from '@/lib/ids';

import { customerEvents, customers, type CustomerEvent, type CustomerEventKind } from '../schema';
import type { DbOrTx } from '../types';
import { RepoError, requireText } from './errors';

export type DueFollowUp = {
  eventId: string;
  customerId: string;
  customerName: string;
  phone: string | null;
  whatsappOk: boolean;
  dueAt: number;
  note: string;
  notificationId: string | null;
};

function insertEvent(
  db: DbOrTx,
  customerId: string,
  kind: CustomerEventKind,
  fields: { refId?: string | null; note?: string; dueAt?: number | null; notificationId?: string | null },
  now: number,
): string {
  const c = db.select({ id: customers.id }).from(customers).where(eq(customers.id, customerId)).get();
  if (!c) throw new RepoError('Customer not found', 'not_found');
  const id = newId();
  db.insert(customerEvents)
    .values({
      id,
      customerId,
      kind,
      refId: fields.refId ?? null,
      note: fields.note ?? '',
      dueAt: fields.dueAt ?? null,
      notificationId: fields.notificationId ?? null,
      createdAt: now,
    })
    .run();
  return id;
}

/** Adds a free-text note to a customer's timeline. Returns the event id. */
export function addNote(db: DbOrTx, customerId: string, note: string, now: number = Date.now()): string {
  return insertEvent(db, customerId, 'note', { note: requireText(note, 'Note') }, now);
}

/** Logs that a catalogue (report record `reportId`) with these products was sent. */
export function logCatalogueSent(
  db: DbOrTx,
  customerId: string,
  reportId: string | null,
  productIds: string[],
  now: number = Date.now(),
): string {
  return insertEvent(db, customerId, 'catalogue_sent', { refId: reportId, note: JSON.stringify({ productIds }) }, now);
}

/** Logs that a single product card was sent. */
export function logCardSent(db: DbOrTx, customerId: string, productId: string, now: number = Date.now()): string {
  return insertEvent(db, customerId, 'card_sent', { refId: productId }, now);
}

/** Logs an item the customer liked (Showroom "Send me this"). */
export function logLikedItem(db: DbOrTx, customerId: string, productId: string, now: number = Date.now()): string {
  return insertEvent(db, customerId, 'liked_item', { refId: productId }, now);
}

/** Product ids recorded on a catalogue_sent event (empty for other events). */
export function catalogueProductIds(event: CustomerEvent): string[] {
  if (event.kind !== 'catalogue_sent') return [];
  try {
    const v = JSON.parse(event.note) as { productIds?: unknown };
    return Array.isArray(v.productIds) ? v.productIds.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** Schedules a follow-up. `notificationId` is the local notification to cancel when done. */
export function addFollowUp(
  db: DbOrTx,
  input: { customerId: string; dueAt: number; note?: string; notificationId?: string | null },
  now: number = Date.now(),
): string {
  return insertEvent(db, input.customerId, 'follow_up', { dueAt: input.dueAt, note: input.note ?? '', notificationId: input.notificationId }, now);
}

/** Stores the notification id after scheduling it. */
export function setFollowUpNotification(db: DbOrTx, eventId: string, notificationId: string | null): void {
  db.update(customerEvents).set({ notificationId }).where(eq(customerEvents.id, eventId)).run();
}

/** Marks a follow-up done. Returns its notification id (to cancel), or null. */
export function completeFollowUp(db: DbOrTx, eventId: string, now: number = Date.now()): string | null {
  const e = db.select().from(customerEvents).where(eq(customerEvents.id, eventId)).get();
  if (!e || e.kind !== 'follow_up') throw new RepoError('Follow-up not found', 'not_found');
  if (e.doneAt === null) db.update(customerEvents).set({ doneAt: now }).where(eq(customerEvents.id, eventId)).run();
  return e.notificationId;
}

/** Undo for completeFollowUp. */
export function reopenFollowUp(db: DbOrTx, eventId: string): void {
  db.update(customerEvents).set({ doneAt: null }).where(eq(customerEvents.id, eventId)).run();
}

/** Removes a timeline event (Undo right after adding a note or follow-up). */
export function deleteEvent(db: DbOrTx, eventId: string): void {
  db.delete(customerEvents).where(eq(customerEvents.id, eventId)).run();
}

/** Open follow-ups due by the end of today (overdue first) for live customers. */
export function dueFollowUps(db: DbOrTx, now: number = Date.now()): DueFollowUp[] {
  return db
    .select({
      eventId: customerEvents.id,
      customerId: customers.id,
      customerName: customers.name,
      phone: customers.phone,
      whatsappOk: customers.whatsappOk,
      dueAt: customerEvents.dueAt,
      note: customerEvents.note,
      notificationId: customerEvents.notificationId,
    })
    .from(customerEvents)
    .innerJoin(customers, eq(customers.id, customerEvents.customerId))
    .where(
      and(
        eq(customerEvents.kind, 'follow_up'),
        isNull(customerEvents.doneAt),
        isNotNull(customerEvents.dueAt),
        lte(customerEvents.dueAt, endOfDay(now)),
        isNull(customers.deletedAt),
      ),
    )
    .orderBy(asc(customerEvents.dueAt))
    .all()
    .map((r) => ({ ...r, dueAt: r.dueAt ?? 0 }));
}
