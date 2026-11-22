/** Profit screen controller: period, breakdown tab, "without buying price" filter, live data. */
import { useState } from 'react';

import { useProducts, useProfitBreakdowns, useToday } from '@/db/hooks';
import type { ProfitGroupRow, ProfitSummary } from '@/db/repo/profit';
import { pickCustomDay } from '@/features/report/period';

import { breakdownRows, profitRange, type BreakdownTab, type ProfitPeriod, type Range } from '../logic';

export type ProfitScreenModel = {
  today: number;
  period: ProfitPeriod;
  range: Range;
  customFrom: number | null;
  customTo: number | null;
  tab: BreakdownTab;
  /** Product tab shows only designs with sales that had no buying price. */
  missingOnly: boolean;
  summary: ProfitSummary;
  rows: ProfitGroupRow[];
  /** Cover thumbnail per live product id (deleted designs fall back to their pattern). */
  thumbs: Map<string, string | null>;
  /** Product ids that still exist (rows of deleted designs do not open anything). */
  liveProducts: Set<string>;
};

export type ProfitScreenActions = {
  setPeriod: (p: ProfitPeriod) => void;
  pickDay: (day: number) => void;
  setTab: (t: BreakdownTab) => void;
  showMissing: () => void;
  clearMissing: () => void;
};

export function useProfitScreen(): { model: ProfitScreenModel; actions: ProfitScreenActions } {
  const today = useToday();
  const [period, setPeriodState] = useState<ProfitPeriod>('today');
  const [custom, setCustom] = useState<{ from: number | null; to: number | null }>({ from: null, to: null });
  const [tab, setTabState] = useState<BreakdownTab>('day');
  const [missingOnly, setMissingOnly] = useState(false);

  const range = profitRange(period, today, custom.from, custom.to);
  const b = useProfitBreakdowns(range);
  const products = useProducts({});
  const thumbs = new Map(products.map((p) => [p.id, p.coverThumb]));
  const liveProducts = new Set(products.map((p) => p.id));

  let rows = breakdownRows(b, tab);
  if (tab === 'product' && missingOnly) rows = rows.filter((r) => r.unknownCostItems > 0);

  return {
    model: { today, period, range, customFrom: custom.from, customTo: custom.to, tab, missingOnly, summary: b.summary, rows, thumbs, liveProducts },
    actions: {
      setPeriod: (p) => {
        if (p === 'custom' && custom.from === null) setCustom({ from: today, to: today });
        setPeriodState(p);
      },
      pickDay: (day) => {
        setCustom((cur) => pickCustomDay(cur, day));
        setPeriodState('custom');
      },
      setTab: (t) => {
        setTabState(t);
        if (t !== 'product') setMissingOnly(false);
      },
      showMissing: () => {
        setTabState('product');
        setMissingOnly(true);
      },
      clearMissing: () => setMissingOnly(false),
    },
  };
}
