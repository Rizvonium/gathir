/** Sales tab controller: period + payment filters, day groups, totals and the empty-state kind. */
import { useState } from 'react';

import { useDbQuery, useSales, useToday } from '@/db/hooks';
import { hasAnySale } from '@/db/repo/sales';
import type { PaymentMethod } from '@/db/schema';

import { emptyKind, groupSalesByDay, periodRange, totalsOf, type EmptyKind, type SalesListItem, type SalesPeriod, type SalesTotals } from '../logic/salesList';

export type SalesListModel = {
  period: SalesPeriod;
  payment: PaymentMethod | null;
  today: number;
  items: SalesListItem[];
  stickyIndices: number[];
  totals: SalesTotals;
  empty: EmptyKind;
};

export type SalesListActions = { setPeriod: (p: SalesPeriod) => void; setPayment: (p: PaymentMethod | null) => void };

export function useSalesList(): { model: SalesListModel; actions: SalesListActions } {
  const [period, setPeriod] = useState<SalesPeriod>('today');
  const [payment, setPayment] = useState<PaymentMethod | null>(null);
  const today = useToday();
  const range = periodRange(period, today);
  const rows = useSales({ ...range, payment: payment ?? undefined });
  const isEmpty = rows.length === 0;
  // Only asked when the filtered list is empty: "never sold anything" gets its own empty state.
  const anySalesEver = useDbQuery((d) => (isEmpty ? hasAnySale(d) : true), [isEmpty]);
  const { items, stickyIndices } = groupSalesByDay(rows);
  return {
    model: {
      period,
      payment,
      today,
      items,
      stickyIndices,
      totals: totalsOf(rows),
      empty: emptyKind({ rows: rows.length, period, payment, anySalesEver }),
    },
    actions: { setPeriod, setPayment },
  };
}
