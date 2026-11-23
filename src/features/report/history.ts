/** What a sent owner report keeps for Report history. Pure. */
import type { Report } from '@/db/schema';

export type ReportSummary = {
  saleCount: number;
  pieces: number;
  amountPaise: number;
  /** PDF size, for "1.2 MB". */
  sizeBytes?: number;
};

export function summaryOf(data: { summary: { count: number; pieces: number; amountPaise: number } }, sizeBytes?: number): ReportSummary {
  return { saleCount: data.summary.count, pieces: data.summary.pieces, amountPaise: data.summary.amountPaise, ...(sizeBytes ? { sizeBytes } : {}) };
}

export function parseSummary(json: string): ReportSummary {
  try {
    const v = JSON.parse(json) as Partial<ReportSummary>;
    const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : 0);
    return { saleCount: num(v.saleCount), pieces: num(v.pieces), amountPaise: num(v.amountPaise), sizeBytes: num(v.sizeBytes) || undefined };
  } catch {
    return { saleCount: 0, pieces: 0, amountPaise: 0 };
  }
}

export type HistoryRow = {
  id: string;
  number: number;
  sentAt: number;
  from: number | null;
  to: number | null;
  fileName: string | null;
  summary: ReportSummary;
};

/** Sent owner reports, newest send first. Unsent records (share dismissed) are left out. */
export function sentReports(reports: readonly Report[]): HistoryRow[] {
  return reports
    .filter((r) => r.kind === 'owner' && r.sentAt !== null)
    .map((r) => ({
      id: r.id,
      number: r.number,
      sentAt: r.sentAt as number,
      from: r.periodFrom,
      to: r.periodTo,
      fileName: r.fileName,
      summary: parseSummary(r.summaryJson),
    }))
    .sort((a, b) => b.sentAt - a.sentAt);
}

/**
 * "Make again": the report screen on the same dates. `at` makes each tap a new visit, so the
 * screen applies the dates even when it is already open underneath with the same ones.
 */
export function makeAgainParams(row: Pick<HistoryRow, 'from' | 'to'>, at: number = Date.now()): { from: string; to: string; at: string } | null {
  if (row.from === null || row.to === null) return null;
  return { from: String(row.from), to: String(row.to), at: String(at) };
}
