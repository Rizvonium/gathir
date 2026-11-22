/**
 * Reads for the More tab and settings screens. Pure drizzle on DbOrTx (Node-testable): never
 * creates the settings row during render.
 */
import { and, count, eq, isNotNull, isNull } from 'drizzle-orm';

import { categories, products, reports, shopSettings, type ShopSettings } from '@/db/schema';
import type { DbOrTx } from '@/db/types';

export type MoreSummary = {
  shopName: string;
  sellerName: string;
  ownerWhatsapp: string;
  includePhones: boolean;
  lowStockLevel: number;
  categoryCount: number;
  catalogueStyle: ShopSettings['catalogueStyle'];
  language: string;
  pinSet: boolean;
  lastBackupAt: number | null;
  sentReports: number;
  hasSample: boolean;
};

export function readSettingsRow(db: DbOrTx): ShopSettings | null {
  return db.select().from(shopSettings).where(eq(shopSettings.id, 1)).get() ?? null;
}

export function readMoreSummary(db: DbOrTx): MoreSummary {
  const s = readSettingsRow(db);
  const cats = db.select({ n: count() }).from(categories).get()?.n ?? 0;
  const sent = db
    .select({ n: count() })
    .from(reports)
    .where(and(eq(reports.kind, 'owner'), isNotNull(reports.sentAt)))
    .get()?.n ?? 0;
  const sample = !!db.select({ id: products.id }).from(products).where(and(eq(products.isSample, true), isNull(products.deletedAt))).get();
  return {
    shopName: s?.shopName ?? '',
    sellerName: s?.sellerName ?? '',
    ownerWhatsapp: s?.ownerWhatsapp ?? '',
    includePhones: s?.reportIncludesCustomerPhones ?? true,
    lowStockLevel: s?.lowStockLevel ?? 1,
    categoryCount: cats,
    catalogueStyle: s?.catalogueStyle ?? 'bazaar',
    language: s?.language ?? 'en',
    pinSet: s?.pinHashSet ?? false,
    lastBackupAt: s?.lastBackupAt ?? null,
    sentReports: sent,
    hasSample: sample,
  };
}
