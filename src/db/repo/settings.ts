/** Shop settings (single row, id = 1) and the number sequences stored on it. */
import { eq } from 'drizzle-orm';

import { billNumber, productCode } from '@/lib/ids';

import { products, shopSettings, type ShopSettings } from '../schema';
import type { DbOrTx } from '../types';

const SETTINGS_ID = 1;
/** billSeq stores `year * BILL_YEAR_FACTOR + sequence` so numbering restarts every year. */
const BILL_YEAR_FACTOR = 100_000;

export type SettingsPatch = Partial<
  Omit<ShopSettings, 'id' | 'createdAt' | 'updatedAt' | 'productSeq' | 'billSeq' | 'reportSeq'>
>;

/** Returns the settings row, creating it with defaults if it is missing. */
export function getSettings(db: DbOrTx, now: number = Date.now()): ShopSettings {
  const row = db.select().from(shopSettings).where(eq(shopSettings.id, SETTINGS_ID)).get();
  if (row) return row;
  db.insert(shopSettings).values({ id: SETTINGS_ID, createdAt: now, updatedAt: now }).onConflictDoNothing().run();
  const created = db.select().from(shopSettings).where(eq(shopSettings.id, SETTINGS_ID)).get();
  if (!created) throw new Error('Settings row could not be created');
  return created;
}

/** Low-stock level without writing anything (safe during render). Defaults to 1. */
export function getLowStockLevel(db: DbOrTx): number {
  const row = db
    .select({ level: shopSettings.lowStockLevel })
    .from(shopSettings)
    .where(eq(shopSettings.id, SETTINGS_ID))
    .get();
  return row?.level ?? 1;
}

/** Updates any editable settings fields. Returns the updated row. */
export function updateSettings(db: DbOrTx, patch: SettingsPatch, now: number = Date.now()): ShopSettings {
  return db.transaction((tx) => {
    getSettings(tx, now);
    tx.update(shopSettings)
      .set({ ...patch, updatedAt: now })
      .where(eq(shopSettings.id, SETTINGS_ID))
      .run();
    return getSettings(tx, now);
  });
}

/** Records that first-launch onboarding finished. */
export function markOnboarded(db: DbOrTx, now: number = Date.now()): void {
  updateSettings(db, { onboardedAt: now }, now);
}

/** Reserves and returns the next unused product code, e.g. "GTH-0042". */
export function nextProductCode(db: DbOrTx, now: number = Date.now()): string {
  return db.transaction((tx) => {
    let seq = getSettings(tx, now).productSeq;
    let code: string;
    do {
      seq += 1;
      code = productCode(seq);
    } while (tx.select({ id: products.id }).from(products).where(eq(products.code, code)).get());
    tx.update(shopSettings).set({ productSeq: seq, updatedAt: now }).where(eq(shopSettings.id, SETTINGS_ID)).run();
    return code;
  });
}

/** Reserves and returns the next bill number for the year of `now`, e.g. "B-2026-0007". */
export function nextBillNo(db: DbOrTx, now: number = Date.now()): string {
  return db.transaction((tx) => {
    const year = new Date(now).getFullYear();
    const stored = getSettings(tx, now).billSeq;
    const storedYear = Math.floor(stored / BILL_YEAR_FACTOR);
    const seq = storedYear === year ? (stored % BILL_YEAR_FACTOR) + 1 : 1;
    tx.update(shopSettings)
      .set({ billSeq: year * BILL_YEAR_FACTOR + seq, updatedAt: now })
      .where(eq(shopSettings.id, SETTINGS_ID))
      .run();
    return billNumber(year, seq);
  });
}

/** The number the next owner report will get, without reserving it. */
export function peekNextReportNumber(db: DbOrTx): number {
  return getSettings(db).reportSeq + 1;
}

/** Reserves and returns the next owner-report number (1, 2, 3…). */
export function nextReportNumber(db: DbOrTx, now: number = Date.now()): number {
  return db.transaction((tx) => {
    const seq = getSettings(tx, now).reportSeq + 1;
    tx.update(shopSettings).set({ reportSeq: seq, updatedAt: now }).where(eq(shopSettings.id, SETTINGS_ID)).run();
    return seq;
  });
}
