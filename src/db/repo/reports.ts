/** Report records (owner reports, catalogues, bills, cards) and the PDF view models. */
import { and, desc, eq, gte, isNotNull, isNull, lte } from 'drizzle-orm';

import { newId } from '@/lib/ids';

import { reports, sales, type Report, type ReportKind } from '../schema';
import type { DbOrTx } from '../types';
import { RepoError } from './errors';
import { nextReportNumber } from './settings';

export { buildOwnerReportData } from './ownerReport';
export type {
  OwnerReportData,
  OwnerReportSale,
  OwnerReportStockChange,
  OwnerReportStockRow,
  OwnerReportCustomer,
  OwnerReportProfit,
  OwnerReportSummary,
} from './ownerReport';
export { buildCatalogueData, fewThreshold } from './catalogueData';
export type { CatalogueData, CatalogueProduct, CatalogueOptions, CatalogueSelection, Availability } from './catalogueData';
export { computeFingerprint, canonicalJson } from './fingerprint';

export type CreateReportInput = {
  kind: ReportKind;
  periodFrom?: number | null;
  periodTo?: number | null;
  fileName?: string | null;
  customerId?: string | null;
  /** Small JSON-serialisable summary shown in Report history. */
  summary?: unknown;
  fingerprint?: string;
};

/** Saves a generated PDF/card record. Owner reports take the next report number. Returns id and number. */
export function createReportRecord(db: DbOrTx, input: CreateReportInput, now: number = Date.now()): { id: string; number: number } {
  return db.transaction((tx) => {
    const id = newId();
    const number = input.kind === 'owner' ? nextReportNumber(tx, now) : 0;
    tx.insert(reports)
      .values({
        id,
        number,
        kind: input.kind,
        periodFrom: input.periodFrom ?? null,
        periodTo: input.periodTo ?? null,
        fileName: input.fileName ?? null,
        customerId: input.customerId ?? null,
        summaryJson: JSON.stringify(input.summary ?? {}),
        fingerprint: input.fingerprint ?? '',
        createdAt: now,
      })
      .run();
    return { id, number };
  });
}

/**
 * Marks a report as sent. For owner reports, unreported non-cancelled sales in its period
 * are linked to it (they stop counting as "new sales" on Home). Undo: unmarkSent.
 */
export function markSent(db: DbOrTx, reportId: string, at: number = Date.now()): void {
  db.transaction((tx) => {
    const r = tx.select().from(reports).where(eq(reports.id, reportId)).get();
    if (!r) throw new RepoError('Report not found', 'not_found');
    tx.update(reports).set({ sentAt: at }).where(eq(reports.id, reportId)).run();
    if (r.kind === 'owner' && r.periodFrom !== null && r.periodTo !== null) {
      tx.update(sales)
        .set({ reportId })
        .where(and(isNull(sales.reportId), isNull(sales.cancelledAt), gte(sales.createdAt, r.periodFrom), lte(sales.createdAt, r.periodTo)))
        .run();
    }
  });
}

/** Undo for markSent: clears sentAt and unlinks the sales it claimed. */
export function unmarkSent(db: DbOrTx, reportId: string): void {
  db.transaction((tx) => {
    tx.update(reports).set({ sentAt: null }).where(eq(reports.id, reportId)).run();
    tx.update(sales).set({ reportId: null }).where(eq(sales.reportId, reportId)).run();
  });
}

/** Report history, newest first (optionally one kind). */
export function listReports(db: DbOrTx, kind?: ReportKind): Report[] {
  return db
    .select()
    .from(reports)
    .where(kind ? eq(reports.kind, kind) : undefined)
    .orderBy(desc(reports.createdAt))
    .all();
}

/** The most recently sent owner report, or null. */
export function lastOwnerReport(db: DbOrTx): Report | null {
  return (
    db
      .select()
      .from(reports)
      .where(and(eq(reports.kind, 'owner'), isNotNull(reports.sentAt)))
      .orderBy(desc(reports.sentAt))
      .get() ?? null
  );
}

/** Default "Since last report" period: from just after the last sent report's end (or `fallbackFrom`) to now. */
export function sinceLastReportPeriod(db: DbOrTx, now: number, fallbackFrom: number): { from: number; to: number } {
  const last = lastOwnerReport(db);
  const from = last?.periodTo != null ? last.periodTo + 1 : fallbackFrom;
  return { from: Math.min(from, now), to: now };
}
