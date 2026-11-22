/** Idempotent first-run data: the single settings row and default categories. */
import { eq } from 'drizzle-orm';

import { newId } from '@/lib/ids';

import type { DbOrTx } from './types';
import { categories, shopSettings } from './schema';

export const DEFAULT_CATEGORIES: { name: string; icon: string }[] = [
  { name: 'Shawls', icon: 'texture' },
  { name: 'Stoles', icon: 'gesture' },
  { name: 'Pherans', icon: 'checkroom' },
  { name: 'Kani', icon: 'grid_on' },
  { name: 'Pashmina', icon: 'spa' },
  { name: 'Sozni', icon: 'draw' },
  { name: 'Aari', icon: 'brush' },
  { name: 'Papier-mâché', icon: 'palette' },
  { name: 'Other', icon: 'category' },
];

export const CRAFTS = ['Sozni', 'Kani', 'Aari', 'Tilla', 'Papier-mâché', 'Jamawar', 'Plain', 'Printed', 'Other'] as const;
export const MATERIALS = ['Pashmina', 'Wool', 'Raffal', 'Silk', 'Cotton', 'Blend', 'Other'] as const;
export const SIZES = ['Stole (70×200)', 'Shawl (100×200)', 'Large (140×280)', 'Muffler', 'Free size', 'Other'] as const;

export function ensureSeedData(database: DbOrTx, ownerWhatsApp = '', now: number = Date.now()): void {
  database.transaction((tx) => {
    const existing = tx.select({ id: shopSettings.id }).from(shopSettings).where(eq(shopSettings.id, 1)).get();
    if (!existing) {
      tx.insert(shopSettings)
        .values({ id: 1, ownerWhatsapp: ownerWhatsApp, createdAt: now, updatedAt: now })
        .run();
    }
    const anyCategory = tx.select({ id: categories.id }).from(categories).limit(1).get();
    if (!anyCategory) {
      DEFAULT_CATEGORIES.forEach((c, i) => {
        tx.insert(categories)
          .values({ id: newId(), name: c.name, icon: c.icon, sortOrder: i, isDefault: true, createdAt: now, updatedAt: now })
          .run();
      });
    }
  });
}
