/**
 * Step 3 "Preview": builds the real catalogue (photos at ~800 px, embedded fonts) once per
 * selection, then re-renders the HTML instantly when only words or layout change.
 */
import { useEffect, useState } from 'react';

import { db } from '@/db/client';
import { useSuggestedProducts } from '@/db/hooks';
import { buildCatalogueData } from '@/db/repo/reports';
import { categoryName } from '@/db/repo/catalogueData';
import { photoAsDataUri } from '@/lib/photos';
import { CATALOGUE_PHOTO, cataloguePhotoNames, getPdfFontCss, loadPhotoMap, MAX_ITEMS_PER_PART, renderCatalogueHtml } from '@/pdf';
import type { CatalogueDoc } from '@/pdf/types';

import { dataOptions, type CatalogueForm } from '../logic/options';
import { catalogueParts, partStats, type PartStats } from '../logic/parts';
import { selectionKey, toSelection } from '../logic/selection';
import { useCatalogueFlow, type Prepared } from '../store';
import { useLoadedForm } from './useCatalogueOptions';
import { useCustomerBrief } from './useCustomerBrief';
import { SUGGESTION_LIMIT } from './useCatalogueSource';

export type PreviewStatus = 'loading' | 'ready' | 'empty' | 'error';

/** The selection + data-shaping options a prepared catalogue was built for. */
export function useSelectionKey(): { key: string | null; selection: ReturnType<typeof toSelection>; form: CatalogueForm | null } {
  const source = useCatalogueFlow((s) => s.source);
  const customerId = useCatalogueFlow((s) => s.customerId);
  const suggested = useSuggestedProducts(source.kind === 'suggested' ? (customerId ?? undefined) : undefined, SUGGESTION_LIMIT);
  const form = useLoadedForm();
  const selection = toSelection(
    source,
    suggested.map((p) => p.id),
  );
  const key = selection && form ? `${selectionKey(selection)}|${JSON.stringify(dataOptions(form))}` : null;
  return { key, selection, form };
}

/** Builds the prepared catalogue for the current run when it is missing or stale. */
export function usePrepared(): { prepared: Prepared | null; status: PreviewStatus; retry: () => void } {
  const { key, selection, form } = useSelectionKey();
  const source = useCatalogueFlow((s) => s.source);
  const prepared = useCatalogueFlow((s) => s.prepared);
  const setPrepared = useCatalogueFlow((s) => s.setPrepared);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const fresh = prepared && prepared.key === key ? prepared : null;

  useEffect(() => {
    if (!key || !selection || !form || fresh) return;
    let cancelled = false;
    (async () => {
      try {
        const data = buildCatalogueData(db, selection, dataOptions(form));
        const [photos, fontCss] = await Promise.all([
          loadPhotoMap(cataloguePhotoNames(data), photoAsDataUri, CATALOGUE_PHOTO),
          getPdfFontCss(),
        ]);
        const fallbackTitle = source.kind === 'category' && source.categoryId ? (categoryName(db, source.categoryId) ?? '') : '';
        if (!cancelled) setPrepared({ key, data, photos, fontCss, fallbackTitle });
      } catch {
        if (!cancelled) setFailedKey(key);
      }
    })();
    return () => {
      cancelled = true;
    };
    // `selection`/`form`/`source` are captured by `key` (and categoryId); rebuild only when it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt, !!fresh]);

  let status: PreviewStatus = 'loading';
  if (key && failedKey === key) status = 'error';
  else if (fresh) status = fresh.data.products.length === 0 ? 'empty' : 'ready';
  else if (form && !selection) status = 'empty';

  return {
    prepared: fresh,
    status,
    retry: () => {
      setFailedKey(null);
      setAttempt((n) => n + 1);
    },
  };
}

export type CataloguePreview = {
  status: PreviewStatus;
  retry: () => void;
  docs: CatalogueDoc[];
  stats: PartStats[];
  partIndex: number;
  setPartIndex: (i: number) => void;
  /** HTML of the visible part (the exact PDF source). */
  html: string | null;
  totalItems: number;
  maxPerPart: number;
  customerName: string | null;
};

export function useCataloguePreview(): CataloguePreview {
  const { prepared, status, retry } = usePrepared();
  const form = useLoadedForm();
  const customerId = useCatalogueFlow((s) => s.customerId);
  const customer = useCustomerBrief(customerId);
  const [now] = useState(() => Date.now());
  const [partIndex, setPartIndex] = useState(0);

  const docs =
    prepared && form
      ? catalogueParts(prepared.data, form, { customerName: customer?.name ?? null, fontCss: prepared.fontCss, now, fallbackTitle: prepared.fallbackTitle }, prepared.photos)
      : [];
  const index = Math.min(partIndex, Math.max(0, docs.length - 1));
  const stats = docs.map(partStats);

  return {
    status,
    retry,
    docs,
    stats,
    partIndex: index,
    setPartIndex,
    html: status === 'ready' && docs[index] ? renderCatalogueHtml(docs[index]) : null,
    totalItems: stats.reduce((n, s) => n + s.items, 0),
    maxPerPart: MAX_ITEMS_PER_PART,
    customerName: customer?.name ?? null,
  };
}
