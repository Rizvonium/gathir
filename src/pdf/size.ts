/** Catalogue size budget (PLAN §6): ~800 px JPEG photos at q≈0.72, < ~8 MB for 60 items, split over 120. */

/** Average embedded photo (800 px, JPEG 0.72) in bytes. */
export const PHOTO_BYTES_ESTIMATE = 95 * 1024;
/** Fonts (subset by the print engine), cover art, order page and PDF structure. */
export const CATALOGUE_BASE_BYTES = 420 * 1024;
/** Above this many items a catalogue is split into parts. */
export const MAX_ITEMS_PER_PART = 120;

/** Rough PDF size in bytes for a catalogue with `itemCount` photos (for "about 6 MB" hints). */
export function estimateCatalogueSize(itemCount: number): number {
  return CATALOGUE_BASE_BYTES + Math.max(0, itemCount) * PHOTO_BYTES_ESTIMATE;
}

/** "5.9 MB" / "740 KB" for size hints. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Splits items into balanced parts of at most `maxPerPart` (130 items → 65 + 65, not 120 + 10).
 * Order is kept. Always returns at least one part (possibly empty).
 */
export function splitForSize<T>(items: readonly T[], maxPerPart: number = MAX_ITEMS_PER_PART): T[][] {
  if (maxPerPart < 1) throw new Error('maxPerPart must be ≥ 1');
  if (items.length <= maxPerPart) return [[...items]];
  const parts = Math.ceil(items.length / maxPerPart);
  const base = Math.floor(items.length / parts);
  const extra = items.length % parts;
  const out: T[][] = [];
  let start = 0;
  for (let i = 0; i < parts; i++) {
    const size = base + (i < extra ? 1 : 0);
    out.push(items.slice(start, start + size));
    start += size;
  }
  return out;
}
