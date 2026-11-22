/** Report flow state shared by /report and /report/preview (small UI state, PLAN §13: Zustand). */
import { create } from 'zustand';

import type { OwnerReportData } from '@/db/repo/reports';
import type { OwnerReportDoc } from '@/pdf';

import type { PeriodKind } from './period';

export type PreparedReport = { key: string; data: OwnerReportData; doc: OwnerReportDoc; html: string; fingerprint: string };

/** A PDF made and recorded but not (yet) marked as sent: a retry reuses it, so no report number is skipped. */
export type PendingSend = {
  key: string;
  reportId: string;
  number: number;
  pdfUri: string;
  fileName: string;
  doc: OwnerReportDoc;
  /** Thumbnail names of the sold items (for "Also send photos"). */
  photoThumbs: (string | null)[];
};

export type SentReport = {
  reportId: string;
  number: number;
  saleCount: number;
  amountPaise: number;
  /** Full-size photo file names of the sold items ("Also send photos"). */
  photoNames: string[];
  ownerPhone: string;
};

export type SendPhase = 'idle' | 'preparing' | 'sharing' | 'photos';

type ReportFlow = {
  /** Fixes "now" while the flow is open, so the period does not drift second by second. */
  openedAt: number;
  kind: PeriodKind;
  customFrom: number | null;
  customTo: number | null;
  alsoPhotos: boolean;
  phase: SendPhase;
  prepared: PreparedReport | null;
  pending: PendingSend | null;
  sent: SentReport | null;
  /** Play the celebration once on the report screen. */
  celebrate: boolean;
  set: (patch: Partial<Omit<ReportFlow, 'set' | 'reset'>>) => void;
  reset: (now: number) => void;
};

const initial = {
  kind: 'since' as PeriodKind,
  customFrom: null,
  customTo: null,
  alsoPhotos: false,
  phase: 'idle' as SendPhase,
  prepared: null,
  pending: null,
  sent: null,
  celebrate: false,
};

export const useReportFlow = create<ReportFlow>((set) => ({
  openedAt: Date.now(),
  ...initial,
  set: (patch) => set(patch),
  reset: (now) => set({ ...initial, openedAt: now }),
}));

/**
 * Identity of one report's content: same key → the same PDF can be reused. `stamp` is the DB
 * version for previews, and a sales signature for a pending send (recording the report itself
 * is a DB write, which must not make a retry render a second PDF with a new number).
 */
export function reportKey(range: { from: number; to: number }, includePhones: boolean, stamp: string | number): string {
  return `${range.from}|${range.to}|${includePhones ? 1 : 0}|${stamp}`;
}

export function salesStamp(s: { count: number; pieces: number; amountPaise: number }): string {
  return `${s.count}:${s.pieces}:${s.amountPaise}`;
}
