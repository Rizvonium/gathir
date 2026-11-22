/**
 * Catalogue data → one or more PDF docs (PLAN §6 size budget: split over 120 items) and the
 * numbers shown under the preview. Pure: photos and fonts are passed in.
 */
import type { CatalogueData } from '@/db/repo/reports';
import { catalogueDocFromData } from '@/pdf/adapters';
import { paginateCatalogue } from '@/pdf/paginate';
import { estimateCatalogueSize, MAX_ITEMS_PER_PART, splitForSize } from '@/pdf/size';
import type { CatalogueDoc } from '@/pdf/types';

import { layoutOptions, ratesValidTill, type CatalogueForm } from './options';

export type PartExtras = {
  /** Shown as "Prepared for …" on the cover; null for a chat chosen in WhatsApp. */
  customerName: string | null;
  fontCss: string;
  /** Used for "Rates valid till". */
  now: number;
  /** Title used when the seller left the title empty (e.g. the category name). */
  fallbackTitle?: string;
};

/** Builds the docs (one per part). Always at least one doc, possibly with no items. */
export function catalogueParts(
  data: CatalogueData,
  form: CatalogueForm,
  extras: PartExtras,
  photos: ReadonlyMap<string, string>,
  maxPerPart: number = MAX_ITEMS_PER_PART,
): CatalogueDoc[] {
  const groups = splitForSize(data.products, maxPerPart);
  const title = form.title.trim() || extras.fallbackTitle?.trim() || '';
  return groups.map((products, i) =>
    catalogueDocFromData(
      { ...data, products },
      {
        title,
        customerName: extras.customerName?.trim() || null,
        personalNote: form.personalNote.trim() || null,
        ratesValidTill: form.showRates ? ratesValidTill(form.validForDays, extras.now) : null,
        discountLine: form.discountLine.trim() || null,
        part: groups.length > 1 ? { index: i + 1, total: groups.length } : null,
        fontCss: extras.fontCss,
        layout: layoutOptions(form),
      },
      photos,
    ),
  );
}

export type PartStats = { items: number; pages: number; estimatedBytes: number };

/** Items, A4 pages (cover + products + order page) and a rough size for one part. */
export function partStats(doc: CatalogueDoc): PartStats {
  const items = doc.options.hideSoldOut ? doc.items.filter((i) => i.availability.kind !== 'sold_out').length : doc.items.length;
  return { items, pages: paginateCatalogue(Array.from({ length: items }), doc.options.columns).total, estimatedBytes: estimateCatalogueSize(items) };
}

/** Product ids across all parts (what is logged on the customer's timeline). */
export function partProductIds(docs: readonly CatalogueDoc[]): string[] {
  return docs.flatMap((d) => d.items.map((i) => i.id));
}
