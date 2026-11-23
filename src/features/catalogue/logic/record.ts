/**
 * What gets written after a send returns from WhatsApp (PLAN §6 "The send is logged on that
 * customer's timeline"). Sync repo calls only, so it runs in Node tests with createTestDb().
 */
import { createCustomer } from '@/db/repo/customers';
import { DuplicateCustomerError } from '@/db/repo/errors';
import { logCardSent, logCatalogueSent, logLikedItem, type CatalogueSentItem } from '@/db/repo/events';
import { createReportRecord, markSent } from '@/db/repo/reports';
import type { DbOrTx } from '@/db/types';
import { formatPhone } from '@/lib/phone';

export type CatalogueSendRecord = {
  customerId: string | null;
  productIds: string[];
  fileName: string;
  title: string;
  parts: number;
  /** Rates offered (kept on the customer's "Versions sent"); `personal` = their own catalogue. */
  snapshot?: { items: CatalogueSentItem[]; personal: boolean };
};

/** Report record (kind 'catalogue', marked sent) + the customer's timeline event. Returns the report id. */
export function recordCatalogueSent(db: DbOrTx, input: CatalogueSendRecord, now: number = Date.now()): string {
  const { id } = createReportRecord(
    db,
    {
      kind: 'catalogue',
      fileName: input.fileName,
      customerId: input.customerId,
      summary: { items: input.productIds.length, parts: input.parts, title: input.title, ...(input.snapshot?.personal ? { personal: true } : {}) },
    },
    now,
  );
  markSent(db, id, now);
  if (input.customerId) {
    const snapshot = input.snapshot ? { items: input.snapshot.items, personal: input.snapshot.personal, title: input.title } : undefined;
    logCatalogueSent(db, input.customerId, id, input.productIds, now, snapshot);
  }
  return id;
}

/** Product card sent: logged on the customer's timeline when a saved customer was chosen. */
export function recordCardSent(db: DbOrTx, customerId: string | null, productId: string, now: number = Date.now()): void {
  if (customerId) logCardSent(db, customerId, productId, now);
}

/** Showroom "Send me this": every liked item goes on the customer's profile once. */
export function recordLikedItems(db: DbOrTx, customerId: string, productIds: readonly string[], now: number = Date.now()): void {
  for (const id of new Set(productIds)) logLikedItem(db, customerId, id, now);
}

/**
 * One-step "add customer" from a phone number (and an optional name). A number that is already
 * saved reuses that customer instead of failing. Returns the customer id and the name to greet.
 */
export function quickAddCustomer(db: DbOrTx, input: { name: string; phone: string }, now: number = Date.now()): { id: string; name: string } {
  const name = input.name.trim() || formatPhone(input.phone);
  try {
    // Added from "Send me this": the customer asked for this shawl to be sent, which is their yes.
    return { id: createCustomer(db, { name, phone: input.phone, whatsappOk: true }, now), name };
  } catch (e) {
    if (e instanceof DuplicateCustomerError) return { id: e.existingId, name: e.existingName };
    throw e;
  }
}
