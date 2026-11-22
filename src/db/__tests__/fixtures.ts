/** Shared builders for repository tests (not a test file itself). */
import { createProduct, type ColourInput } from '@/db/repo/products';
import { getProductDetail } from '@/db/repo/productQueries';
import { findCountDrift } from '@/db/stock';
import type { DbOrTx } from '@/db/types';

export const T0 = new Date(2026, 10, 10, 12, 0, 0).getTime(); // 10 Nov 2026, local noon
export const DAY = 86_400_000;

export function addTestProduct(
  db: DbOrTx,
  opts: { name?: string; craft?: string; ratePaise?: number; costPaise?: number | null; categoryId?: string | null; colours?: ColourInput[]; photos?: number; at?: number } = {},
) {
  const photoCount = opts.photos ?? 0;
  const { productId, code } = createProduct(
    db,
    {
      fields: {
        name: opts.name ?? 'Sozni stole',
        craft: opts.craft ?? 'Sozni',
        ratePaise: opts.ratePaise ?? 650_000,
        costPaise: opts.costPaise === undefined ? 400_000 : opts.costPaise,
        categoryId: opts.categoryId ?? null,
      },
      colours: opts.colours ?? [
        { name: 'Red', hex: '#C0262D', pieces: 4 },
        { name: 'Beige', hex: '#D8C3A5', pieces: 2 },
      ],
      photos: Array.from({ length: photoCount }, (_, i) => ({
        fileName: `${opts.name ?? 'p'}-${i}.jpg`,
        thumbName: `${opts.name ?? 'p'}-${i}-t.jpg`,
        width: 1600,
        height: 1200,
      })),
    },
    opts.at ?? T0,
  );
  const detail = getProductDetail(db, productId);
  if (!detail) throw new Error('product missing');
  return { productId, code, colourIds: detail.colours.map((c) => c.id) };
}

export function expectNoDrift(db: DbOrTx): void {
  expect(findCountDrift(db)).toEqual([]);
}
