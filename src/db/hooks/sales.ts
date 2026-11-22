/** Sales hooks. */
import type { PaymentMethod } from '../schema';
import { getSale, listSales, salesSummary, type DateRange, type SaleDetail, type SaleListRow, type SalesSummary } from '../repo/saleQueries';
import { useDbQuery } from './useDbQuery';

/** Sales in [from, to], newest first (cancelled included; check cancelledAt). */
export function useSales(range: DateRange & { payment?: PaymentMethod; customerId?: string }): SaleListRow[] {
  const { from, to, payment, customerId } = range;
  return useDbQuery((d) => listSales(d, { from, to, payment, customerId }), [from, to, payment, customerId]);
}

/** One sale with items and customer, or null. */
export function useSale(saleId: string | undefined): SaleDetail | null {
  return useDbQuery((d) => (saleId ? getSale(d, saleId) : null), [saleId]);
}

/** Totals for non-cancelled sales in [from, to]. */
export function useSalesSummary(range: DateRange): SalesSummary {
  const { from, to } = range;
  return useDbQuery((d) => salesSummary(d, { from, to }), [from, to]);
}
