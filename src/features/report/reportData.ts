/** Reads for the report screens. Pure drizzle on DbOrTx (Node-testable), no expo imports. */
import { asc, eq } from 'drizzle-orm';

import { lastOwnerReport, sinceLastReportPeriod } from '@/db/repo/reports';
import { salesSummary, type SalesSummary } from '@/db/repo/saleQueries';
import { sales, shopSettings } from '@/db/schema';
import type { DbOrTx } from '@/db/types';
import { startOfDay } from '@/lib/dates';

import type { Range } from './period';

export type ReportBasics = {
  ownerWhatsapp: string;
  includeCustomerPhones: boolean;
  /** "Since last report" range at `now`. */
  sinceLast: Range;
  /** When the last report was sent (null = never). */
  lastSentAt: number | null;
};

/**
 * Where "Since last report" starts when no report was ever sent: the first sale, else the day
 * the shop was set up, else today.
 */
export function shopStart(db: DbOrTx, now: number): number {
  const first = db.select({ at: sales.createdAt }).from(sales).orderBy(asc(sales.createdAt)).limit(1).get();
  if (first) return first.at;
  const s = db.select({ onboardedAt: shopSettings.onboardedAt, createdAt: shopSettings.createdAt }).from(shopSettings).where(eq(shopSettings.id, 1)).get();
  return s?.onboardedAt ?? s?.createdAt ?? startOfDay(now);
}

export function readReportBasics(db: DbOrTx, now: number): ReportBasics {
  const s = db
    .select({ owner: shopSettings.ownerWhatsapp, phones: shopSettings.reportIncludesCustomerPhones })
    .from(shopSettings)
    .where(eq(shopSettings.id, 1))
    .get();
  const last = lastOwnerReport(db);
  return {
    ownerWhatsapp: s?.owner ?? '',
    includeCustomerPhones: s?.phones ?? true,
    sinceLast: sinceLastReportPeriod(db, now, shopStart(db, now)),
    lastSentAt: last?.sentAt ?? null,
  };
}

/** Live summary card numbers for a range (non-cancelled sales). */
export function readRangeSummary(db: DbOrTx, range: Range): SalesSummary {
  return salesSummary(db, range);
}
