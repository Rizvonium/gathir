/** The DB side of the app lock: only the "PIN is set" flag. Pure drizzle (runs in Node tests). */
import { eq } from 'drizzle-orm';

import { shopSettings } from '@/db/schema';
import type { DbOrTx } from '@/db/types';

/** Reads `settings.pinHashSet` without creating the row (safe during render). */
export function readPinFlag(db: DbOrTx): boolean {
  const row = db.select({ on: shopSettings.pinHashSet }).from(shopSettings).where(eq(shopSettings.id, 1)).get();
  return row?.on ?? false;
}
