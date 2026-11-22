import { addTestProduct, DAY, T0 } from '@/db/__tests__/fixtures';
import { cancelSale, createSale, listSales } from '@/db/repo/sales';
import { startOfDay, startOfMonth, startOfWeek } from '@/lib/dates';
import { createTestDb } from '@/test/testDb';

import { dayLabel, emptyKind, groupSalesByDay, itemSummary, periodRange, totalsOf } from '../logic/salesList';

const today = startOfDay(T0);

describe('periodRange', () => {
  it('covers today, this week, this month and all time up to the end of today', () => {
    const end = today + DAY - 1;
    expect(periodRange('today', today)).toEqual({ from: today, to: end });
    expect(periodRange('week', today)).toEqual({ from: startOfWeek(today), to: end });
    expect(periodRange('month', today)).toEqual({ from: startOfMonth(today), to: end });
    expect(periodRange('all', today)).toEqual({ from: 0, to: end });
  });
});

describe('day groups', () => {
  it('groups newest-first sales by day with totals that skip returned sales', () => {
    const db = createTestDb();
    const { colourIds } = addTestProduct(db, { colours: [{ name: 'Red', hex: '#C0262D', pieces: 20 }] });
    const sell = (at: number, qty: number) => createSale(db, { items: [{ colourId: colourIds[0], qty, ratePaise: 100_000 }] }, at).saleId;
    sell(T0 - DAY, 1);
    sell(T0, 2);
    const returned = sell(T0 + 1000, 3);
    cancelSale(db, returned, T0 + 2000);
    const rows = listSales(db, periodRange('all', today));

    const { items, stickyIndices } = groupSalesByDay(rows);
    expect(items.map((i) => i.type)).toEqual(['day', 'sale', 'sale', 'day', 'sale']);
    expect(stickyIndices).toEqual([0, 3]);
    expect(items[0]).toMatchObject({ day: today, pieces: 2, amountPaise: 200_000, count: 1 });
    expect(items[3]).toMatchObject({ day: today - DAY, pieces: 1, count: 1 });
    expect(items[2]).toMatchObject({ lastInDay: true });
    expect(totalsOf(rows)).toEqual({ pieces: 3, amountPaise: 300_000, count: 2 });
    expect(groupSalesByDay([])).toEqual({ items: [], stickyIndices: [] });
  });

  it('labels today and yesterday, and summarises items', () => {
    expect(dayLabel(today, today)).toEqual({ kind: 'today' });
    expect(dayLabel(today - DAY, today)).toEqual({ kind: 'yesterday' });
    expect(dayLabel(today - 2 * DAY, today)).toEqual({ kind: 'date', day: today - 2 * DAY });
    expect(itemSummary([])).toBeNull();
    expect(
      itemSummary([
        { productNameSnapshot: 'Kani', colourNameSnapshot: 'Red', qty: 2 },
        { productNameSnapshot: 'Sozni', colourNameSnapshot: 'Blue', qty: 1 },
      ]),
    ).toEqual({ name: 'Kani', colour: 'Red', qty: 2, more: 1 });
  });
});

describe('emptyKind', () => {
  it('tells apart never sold, nothing today, nothing in period and filtered to zero', () => {
    expect(emptyKind({ rows: 2, period: 'today', payment: null, anySalesEver: true })).toBe('none');
    expect(emptyKind({ rows: 0, period: 'week', payment: 'upi', anySalesEver: false })).toBe('never');
    expect(emptyKind({ rows: 0, period: 'week', payment: 'upi', anySalesEver: true })).toBe('payment');
    expect(emptyKind({ rows: 0, period: 'today', payment: null, anySalesEver: true })).toBe('today');
    expect(emptyKind({ rows: 0, period: 'month', payment: null, anySalesEver: true })).toBe('period');
  });
});
