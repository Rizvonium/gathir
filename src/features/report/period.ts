/**
 * Report periods (PLAN §7): "Since last report" (default), Today, This week, This month, or
 * Custom (from/to picked from date chips). Pure: no React, no expo.
 */
import { addDays, endOfDay, startOfDay, startOfMonth, startOfWeek } from '@/lib/dates';

export const PERIOD_KINDS = ['since', 'today', 'week', 'month', 'custom'] as const;
export type PeriodKind = (typeof PERIOD_KINDS)[number];

export type Range = { from: number; to: number };

/** How many days back the custom date chips reach. */
export const CUSTOM_DAYS_BACK = 62;

export type PeriodInput = {
  kind: PeriodKind;
  now: number;
  /** From sinceLastReportPeriod(db, now, shopStart). */
  sinceLast: Range;
  /** Day starts picked for Custom (null = not picked yet). */
  customFrom: number | null;
  customTo: number | null;
};

/** The exact [from, to] (epoch ms, inclusive) the report covers. `to` never passes now. */
export function resolvePeriod({ kind, now, sinceLast, customFrom, customTo }: PeriodInput): Range {
  switch (kind) {
    case 'since':
      return sinceLast;
    case 'today':
      return { from: startOfDay(now), to: now };
    case 'week':
      return { from: startOfWeek(now), to: now };
    case 'month':
      return { from: startOfMonth(now), to: now };
    case 'custom': {
      const today = startOfDay(now);
      const a = startOfDay(customFrom ?? today);
      const b = startOfDay(customTo ?? customFrom ?? today);
      const from = Math.min(a, b);
      const to = Math.min(endOfDay(Math.max(a, b)), now);
      return { from, to };
    }
  }
}

/** Day starts for the custom chips, newest first: today, yesterday, … `daysBack` days. */
export function recentDays(now: number, daysBack: number = CUSTOM_DAYS_BACK): number[] {
  const today = startOfDay(now);
  return Array.from({ length: daysBack + 1 }, (_, i) => startOfDay(addDays(today, -i)));
}

/**
 * Picking custom dates with one row of chips: the first tap sets both ends (a one-day report);
 * the next tap extends the range to that day; a tap when a range is already set starts over.
 */
export function pickCustomDay(current: { from: number | null; to: number | null }, day: number): { from: number; to: number } {
  const d = startOfDay(day);
  if (current.from === null || current.to === null || current.from !== current.to) return { from: d, to: d };
  return d < current.from ? { from: d, to: current.from } : { from: current.from, to: d };
}

/** True when `day` (a day start) is inside the custom selection. */
export function isDayInRange(day: number, from: number | null, to: number | null): boolean {
  if (from === null || to === null) return false;
  return day >= Math.min(from, to) && day <= Math.max(from, to);
}

/** Whole calendar days a range touches (for "3 days"). */
export function daysCovered(r: Range): number {
  let n = 0;
  for (let d = startOfDay(r.from); d <= r.to && n < 10_000; d = addDays(d, 1)) n++;
  return Math.max(1, n);
}
