/** Seller-only profit hooks (never use them on customer-facing screens). */
import {
  productProfit,
  profitBreakdown,
  profitBreakdowns,
  profitSummary,
  stockValues,
  type ProductProfit,
  type ProfitBreakdowns,
  type ProfitGroupBy,
  type ProfitGroupRow,
  type ProfitSummary,
  type StockValues,
} from '../repo/profit';
import type { DateRange } from '../repo/saleQueries';
import { useDbQuery } from './useDbQuery';

/** Profit totals for non-cancelled sales in [from, to]. */
export function useProfitSummary(range: DateRange): ProfitSummary {
  const { from, to } = range;
  return useDbQuery((d) => profitSummary(d, { from, to }), [from, to]);
}

/** Summary plus by day / product / category / customer, in one pass. */
export function useProfitBreakdowns(range: DateRange): ProfitBreakdowns {
  const { from, to } = range;
  return useDbQuery((d) => profitBreakdowns(d, { from, to }), [from, to]);
}

/** One grouping (day / week / month / product / category / customer). */
export function useProfitBreakdown(range: DateRange, by: ProfitGroupBy): ProfitGroupRow[] {
  const { from, to } = range;
  return useDbQuery((d) => profitBreakdown(d, { from, to }, by), [from, to, by]);
}

/** Profit earned on one design (product detail), or null without an id. */
export function useProductProfit(productId: string | undefined): ProductProfit | null {
  return useDbQuery((d) => (productId ? productProfit(d, productId) : null), [productId]);
}

/** Stock value at selling rate and at buying price. */
export function useStockValues(): StockValues {
  return useDbQuery((d) => stockValues(d), []);
}
