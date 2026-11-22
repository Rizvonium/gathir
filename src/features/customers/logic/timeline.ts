/** Pure mapping of profile timeline entries to display rows (i18n keys, not copy). */
import type { TimelineEntry, TimelineItem } from '@/db/repo/customerQueries';
import type { CustomerEvent } from '@/db/schema';

export type TimelineIcon = 'receipt-long' | 'assignment-return' | 'sticky-note-2' | 'picture-as-pdf' | 'image' | 'alarm' | 'check-circle' | 'favorite';

export type TimelineRow =
  | {
      id: string;
      type: 'sale';
      at: number;
      icon: TimelineIcon;
      saleId: string;
      billNo: string;
      totalPaise: number;
      cancelled: boolean;
      pieces: number;
      items: TimelineItem[];
    }
  | { id: string; type: 'return'; at: number; icon: TimelineIcon; saleId: string; billNo: string; totalPaise: number }
  | {
      id: string;
      type: 'event';
      at: number;
      icon: TimelineIcon;
      kind: CustomerEvent['kind'];
      eventId: string;
      titleKey: string;
      count?: number;
      note: string;
      productId: string | null;
      dueAt: number | null;
      done: boolean;
    };

function catalogueCount(e: CustomerEvent): number {
  try {
    const v = JSON.parse(e.note) as { productIds?: unknown };
    return Array.isArray(v.productIds) ? v.productIds.length : 0;
  } catch {
    return 0;
  }
}

function eventRow(e: CustomerEvent, at: number): TimelineRow {
  const base = { id: `e-${e.id}`, type: 'event' as const, at, kind: e.kind, eventId: e.id, dueAt: e.dueAt, done: e.doneAt !== null };
  switch (e.kind) {
    case 'note':
      return { ...base, icon: 'sticky-note-2', titleKey: 'timeline.note', note: e.note, productId: null };
    case 'catalogue_sent':
      return { ...base, icon: 'picture-as-pdf', titleKey: 'timeline.catalogue', count: catalogueCount(e), note: '', productId: null };
    case 'card_sent':
      return { ...base, icon: 'image', titleKey: 'timeline.card', note: '', productId: e.refId };
    case 'liked_item':
      return { ...base, icon: 'favorite', titleKey: 'timeline.liked', note: '', productId: e.refId };
    case 'follow_up':
      return {
        ...base,
        icon: e.doneAt !== null ? 'check-circle' : 'alarm',
        titleKey: e.doneAt !== null ? 'timeline.followUpDone' : 'timeline.followUp',
        note: e.note,
        productId: null,
      };
  }
}

export function timelineRows(entries: readonly TimelineEntry[]): TimelineRow[] {
  return entries.map((t) => {
    if (t.kind === 'sale') {
      return {
        id: `s-${t.saleId}`,
        type: 'sale',
        at: t.at,
        icon: 'receipt-long',
        saleId: t.saleId,
        billNo: t.billNo,
        totalPaise: t.totalPaise,
        cancelled: t.cancelled,
        pieces: t.items.reduce((s, i) => s + i.qty, 0),
        items: t.items,
      };
    }
    if (t.kind === 'return') {
      return { id: `r-${t.saleId}`, type: 'return', at: t.at, icon: 'assignment-return', saleId: t.saleId, billNo: t.billNo, totalPaise: t.totalPaise };
    }
    return eventRow(t.event, t.at);
  });
}

/** Product ids the timeline mentions (cards sent, liked items), for name lookups. */
export function referencedProductIds(rows: readonly TimelineRow[]): string[] {
  const ids = new Set<string>();
  for (const r of rows) if (r.type === 'event' && r.productId) ids.add(r.productId);
  return [...ids];
}

/** How many rows to show before "Show older". */
export const TIMELINE_PAGE = 15;
