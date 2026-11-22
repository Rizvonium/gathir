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
