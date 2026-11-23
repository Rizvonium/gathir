/** Recently deleted housekeeping: remove products and customers deleted more than 30 days ago. */
import { purgeDeletedCustomers } from '@/db/repo/customers';
import { purgeDeletedOlderThan } from '@/db/repo/products';
import type { DbOrTx } from '@/db/types';

/** Purges both lists; returns photo files that can now be deleted from disk. */
export function purgeExpired(db: DbOrTx, now: number = Date.now()): { products: number; customers: number; files: string[] } {
  const p = purgeDeletedOlderThan(db, now);
  const c = purgeDeletedCustomers(db, now);
  return { products: p.productIds.length, customers: c.length, files: p.files };
}

/**
 * Once per launch, after migrations (PLAN §15: a deleted customer is really removed after 30
 * days, whether or not the seller ever opens Recently deleted). Deletes the freed photo files
 * through `deleteFiles`. Housekeeping only: never throws; the next launch tries again.
 */
export function purgeExpiredOnLaunch(db: DbOrTx, deleteFiles: (files: string[]) => void, now: number = Date.now()): boolean {
  try {
    const { files } = purgeExpired(db, now);
    try {
      deleteFiles(files);
    } catch {
      // Orphan photo files are also cleared by the storage check; the rows are gone either way.
    }
    return true;
  } catch {
    return false;
  }
}
