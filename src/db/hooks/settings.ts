/** Settings and categories hooks (single live queries). */
import { asc, eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import { db } from '../client';
import { getLowStockLevel } from '../repo/settings';
import { categories, shopSettings, type Category, type ShopSettings } from '../schema';
import { useDbQuery } from './useDbQuery';

/** The shop settings row (undefined until the first read completes or before seeding). */
export function useSettings(): ShopSettings | undefined {
  const { data } = useLiveQuery(db.select().from(shopSettings).where(eq(shopSettings.id, 1)));
  return data[0];
}

/** Categories in display order. */
export function useCategories(): Category[] {
  const { data } = useLiveQuery(db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name)));
  return data;
}

/** The shop's low-stock level (pass it to PieceBadge's lowThreshold). Re-reads after any write. */
export function useLowStockLevel(): number {
  return useDbQuery((d) => getLowStockLevel(d), []);
}
