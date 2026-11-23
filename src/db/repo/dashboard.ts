/** Home ("My Shop") summary. */
import { addDays, endOfDay, startOfDay } from '@/lib/dates';

import type { DbOrTx } from '../types';
import { dueFollowUps, type DueFollowUp } from './events';
import { loadLiveProducts } from './productQueries';
import { stockValues } from './profit';
import { lastOwnerReport } from './reports';
import { countUnreportedSales, salesSummary } from './saleQueries';

export type AttentionProduct = { id: string; code: string; name: string; totalPieces: number; coverThumb: string | null };

export type HomeSummary = {
  totalPieces: number;
  designs: number;
  /** Live stock at selling rate. */
  stockValuePaise: number;
  /** Seller-only: live stock at buying price (pieces without a buying price are left out). */
  stockValueAtCostPaise: number;
  /** Pieces in stock with no buying price (not in stockValueAtCostPaise). */
  stockCostUnknownPieces: number;
  todayPieces: number;
  todayAmountPaise: number;
  yesterdayAmountPaise: number;
  /** Seller-only "Today's profit": profit on today's items whose buying price is known. */
  todayProfitPaise: number;
  todayMarginPct: number | null;
  /** Today's sale items without a buying price (profit unknown, not counted). */
  todayProfitUnknownItems: number;
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
  const values = stockValues(db);
  return {
    totalPieces: products.reduce((s, p) => s + p.totalPieces, 0),
    designs: products.length,
    stockValuePaise: products.reduce((s, p) => s + p.totalPieces * p.ratePaise, 0),
    stockValueAtCostPaise: values.atCostPaise,
    stockCostUnknownPieces: values.unknownCostPieces,
    todayPieces: today.pieces,
    todayAmountPaise: today.amountPaise,
    yesterdayAmountPaise: yest.amountPaise,
    todayProfitPaise: today.profitPaise,
    todayMarginPct: today.marginPct,
    todayProfitUnknownItems: today.unknownCostItems,
    lowStock: products.filter((p) => p.status === 'low').sort((a, b) => a.totalPieces - b.totalPieces).map(pick),
    soldOut: products.filter((p) => p.status === 'out').map(pick),
    unreportedSalesCount: countUnreportedSales(db),
    lastReportSentAt: lastOwnerReport(db)?.sentAt ?? null,
    followUpsDue: dueFollowUps(db, now),
  };
}
