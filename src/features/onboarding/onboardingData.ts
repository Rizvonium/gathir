/**
 * First-launch reads and writes. Pure drizzle on `DbOrTx` (no expo imports) so it runs in
 * Node tests. Reads never create the settings row, so they are safe during render.
 */
import { eq } from 'drizzle-orm';

import { markOnboarded, updateSettings } from '@/db/repo/settings';
import { hasSampleData, insertSampleData } from '@/db/sampleData';
import { shopSettings } from '@/db/schema';
import type { DbOrTx } from '@/db/types';

/** True once onboarding finished (or a restored backup says so). Missing row → false. */
export function readOnboarded(db: DbOrTx): boolean {
  const row = db.select({ at: shopSettings.onboardedAt }).from(shopSettings).where(eq(shopSettings.id, 1)).get();
  return row?.at != null;
}

export type OnboardingDraft = {
  shopName: string;
  sellerName: string;
  phone: string;
  address: string;
  upiId: string;
  ownerWhatsapp: string;
  language: string;
  pinSet: boolean;
};

const EMPTY: OnboardingDraft = { shopName: '', sellerName: '', phone: '', address: '', upiId: '', ownerWhatsapp: '', language: 'en', pinSet: false };

/** What was saved so far (to pre-fill a step when the seller comes back to it). */
export function readOnboardingDraft(db: DbOrTx): OnboardingDraft {
  const s = db.select().from(shopSettings).where(eq(shopSettings.id, 1)).get();
  if (!s) return EMPTY;
  return {
    shopName: s.shopName,
    sellerName: s.sellerName,
    phone: s.phone,
    address: s.address,
    upiId: s.upiId,
    ownerWhatsapp: s.ownerWhatsapp,
    language: s.language,
    pinSet: s.pinHashSet,
  };
}

export function saveLanguage(db: DbOrTx, language: string, now: number = Date.now()): void {
  updateSettings(db, { language }, now);
}

export function saveShop(
  db: DbOrTx,
  patch: { shopName: string; sellerName: string; phone: string; address: string; upiId: string },
  now: number = Date.now(),
): void {
  updateSettings(db, patch, now);
}

export function saveOwnerWhatsapp(db: DbOrTx, e164: string, now: number = Date.now()): void {
  updateSettings(db, { ownerWhatsapp: e164 }, now);
}

/**
 * Last step. With `sample`, inserts the demo shop first (once: a second tap after a crash
 * does not duplicate it). All in one transaction so a failure leaves onboarding unfinished.
 */
export function finishOnboarding(db: DbOrTx, opts: { sample: boolean }, now: number = Date.now()): void {
  db.transaction((tx) => {
    if (opts.sample && !hasSampleData(tx)) insertSampleData(tx, now);
    markOnboarded(tx, now);
  });
}
