/** Home ("My Shop") summary. */
import { addDays, endOfDay, startOfDay } from '@/lib/dates';

import type { DbOrTx } from '../types';
import { dueFollowUps, type DueFollowUp } from './events';
import { loadLiveProducts } from './productQueries';
import { lastOwnerReport } from './reports';
import { salesSummary, unreportedSales } from './saleQueries';

export type AttentionProduct = { id: string; code: string; name: string; totalPieces: number; coverThumb: string | null };

export type HomeSummary = {
  totalPieces: number;
  designs: number;
  stockValuePaise: number;
  todayPieces: number;
  todayAmountPaise: number;
  yesterdayAmountPaise: number;
  lowStock: AttentionProduct[];
  soldOut: AttentionProduct[];
  unreportedSalesCount: number;
  lastReportSentAt: number | null;
  followUpsDue: DueFollowUp[];
};

/** Everything the Home screen shows, computed in one pass. */
export function homeSummary(db: DbOrTx, now: number, lowStockLevel: number): HomeSummary {
  const products = loadLiveProducts(db, lowStockLevel);
  const pick = (p: (typeof products)[number]): AttentionProduct => ({
    id: p.id,
    code: p.code,
    name: p.name,
    totalPieces: p.totalPieces,
    coverThumb: p.coverThumb,
  });
  const today = salesSummary(db, { from: startOfDay(now), to: endOfDay(now) });
  const yesterday = addDays(now, -1);
  const yest = salesSummary(db, { from: startOfDay(yesterday), to: endOfDay(yesterday) });
  return {
    totalPieces: products.reduce((s, p) => s + p.totalPieces, 0),
    designs: products.length,
    stockValuePaise: products.reduce((s, p) => s + p.totalPieces * p.ratePaise, 0),
    todayPieces: today.pieces,
    todayAmountPaise: today.amountPaise,
    yesterdayAmountPaise: yest.amountPaise,
    lowStock: products.filter((p) => p.status === 'low').sort((a, b) => a.totalPieces - b.totalPieces).map(pick),
    soldOut: products.filter((p) => p.status === 'out').map(pick),
    unreportedSalesCount: unreportedSales(db).length,
    lastReportSentAt: lastOwnerReport(db)?.sentAt ?? null,
    followUpsDue: dueFollowUps(db, now),
  };
}
