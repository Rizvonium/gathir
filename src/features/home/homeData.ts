/** Home reads that the platform summary does not cover. Pure drizzle, safe during render. */
import { and, eq, isNull, sql } from 'drizzle-orm';

import { products, shopSettings } from '@/db/schema';
import type { DbOrTx } from '@/db/types';

export type HomeExtras = {
  shopName: string;
  lastBackupAt: number | null;
  /** Any sample product present (live or deleted). */
  hasSample: boolean;
  /** Live products the seller added themselves. */
  realProducts: number;
};

export function readHomeExtras(db: DbOrTx): HomeExtras {
  const s = db
    .select({ shopName: shopSettings.shopName, lastBackupAt: shopSettings.lastBackupAt })
    .from(shopSettings)
    .where(eq(shopSettings.id, 1))
    .get();
  const sample = db.select({ id: products.id }).from(products).where(eq(products.isSample, true)).limit(1).get();
  const real = db
    .select({ n: sql<number>`count(*)` })
    .from(products)
    .where(and(eq(products.isSample, false), isNull(products.deletedAt)))
    .get();
  return {
    shopName: s?.shopName ?? '',
    lastBackupAt: s?.lastBackupAt ?? null,
    hasSample: !!sample,
    realProducts: Number(real?.n ?? 0),
  };
}
