/** Step 1 "What to send" (PLAN §6 flow). Pure. */
import type { CatalogueSelection } from '@/db/repo/reports';

export type SourceKind = 'all' | 'category' | 'selected' | 'suggested';

export type SourceState = {
  kind: SourceKind;
  categoryId: string | null;
  /** Hand-picked products, in the order they were picked. */
  productIds: string[];
  /** Suggestions as they were when the seller pressed Next (so the PDF does not change under them). */
  suggestedIds?: string[];
};

export type FlowParams = {
  productIds?: string | string[];
  categoryId?: string | string[];
  customerId?: string | string[];
};

function first(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.trim() ? s.trim() : undefined;
}

/** "a,b,,c" (or ['a,b','c']) → ['a','b','c'], de-duplicated, order kept. */
export function parseIdList(v: string | string[] | undefined): string[] {
  const parts = (Array.isArray(v) ? v : [v ?? ''])
    .flatMap((s) => s.split(','))
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set(parts)];
}

export function paramValue(v: string | string[] | undefined): string | null {
  return first(v) ?? null;
}

/** The choice to start on, from the link that opened the flow. */
export function initialSource(params: FlowParams): SourceState {
  const productIds = parseIdList(params.productIds);
  const categoryId = first(params.categoryId) ?? null;
  if (productIds.length > 0) return { kind: 'selected', categoryId, productIds };
  if (categoryId) return { kind: 'category', categoryId, productIds: [] };
  if (first(params.customerId)) return { kind: 'suggested', categoryId: null, productIds: [] };
  return { kind: 'all', categoryId: null, productIds: [] };
}

/** Adds or removes one product from a hand-picked list. */
export function toggleId(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

/**
 * The repo selection for a source, or null when nothing is chosen yet
 * (no category picked, nothing ticked, no suggestions).
 */
export function toSelection(source: SourceState, suggestedIds: readonly string[]): CatalogueSelection | null {
  switch (source.kind) {
    case 'all':
      return 'all';
    case 'category':
      return source.categoryId ? { categoryId: source.categoryId } : null;
    case 'selected':
      return source.productIds.length > 0 ? { productIds: [...source.productIds] } : null;
    case 'suggested':
      return suggestedIds.length > 0 ? { productIds: [...suggestedIds] } : null;
  }
}

/** Stable key for the preview cache. */
export function selectionKey(selection: CatalogueSelection | null): string {
  return JSON.stringify(selection);
}
