/** Home and report-history hooks. */
import { desc, eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import { db } from '../client';
import { homeSummary, type HomeSummary } from '../repo/dashboard';
import { getLowStockLevel } from '../repo/settings';
import { reports, type Report, type ReportKind } from '../schema';
import { useDbQuery } from './useDbQuery';
import { useToday } from './useToday';

/** Home screen summary (uses the low-stock level from settings). Rolls over at midnight / app resume. */
export function useHomeSummary(): HomeSummary {
  const today = useToday();
  return useDbQuery((d) => homeSummary(d, Date.now(), getLowStockLevel(d)), [today]);
}

/** Report history, newest first; pass a kind to filter. */
export function useReports(kind?: ReportKind): Report[] {
  const { data } = useLiveQuery(
    db
      .select()
      .from(reports)
      .where(kind ? eq(reports.kind, kind) : undefined)
      .orderBy(desc(reports.createdAt)),
    [kind],
  );
  return data;
}
