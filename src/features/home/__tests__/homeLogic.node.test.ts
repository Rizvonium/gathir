import { addDays, startOfDay } from '@/lib/dates';

import { attentionItems, backupReminder, calendarDaysAgo, compareWithYesterday, greetingPart, reportStatus } from '../homeLogic';

const NOW = new Date(2026, 10, 22, 15, 30).getTime();

describe('greetingPart', () => {
  it('splits the day', () => {
    expect(greetingPart(6)).toBe('morning');
    expect(greetingPart(11)).toBe('morning');
    expect(greetingPart(12)).toBe('afternoon');
    expect(greetingPart(16)).toBe('afternoon');
    expect(greetingPart(17)).toBe('evening');
    expect(greetingPart(1)).toBe('evening');
  });
});

describe('calendarDaysAgo', () => {
  it('counts calendar days, not 24-hour blocks', () => {
    expect(calendarDaysAgo(startOfDay(NOW) + 1000, NOW)).toBe(0);
    expect(calendarDaysAgo(startOfDay(NOW) - 1000, NOW)).toBe(1);
    expect(calendarDaysAgo(addDays(NOW, -3), NOW)).toBe(3);
    expect(calendarDaysAgo(addDays(NOW, 2), NOW)).toBe(0);
  });
});

describe('reportStatus', () => {
  it('never sent', () => expect(reportStatus(null, 4, NOW)).toEqual({ kind: 'never', newSales: 4 }));
  it('sent days ago', () => expect(reportStatus(addDays(NOW, -3), 7, NOW)).toEqual({ kind: 'sent', daysAgo: 3, newSales: 7 }));
});

describe('backupReminder', () => {
  it('nudges a never-backed-up shop only when it has data', () => {
    expect(backupReminder(null, NOW, false)).toEqual({ kind: 'none' });
    expect(backupReminder(null, NOW, true)).toEqual({ kind: 'never' });
  });
  it('nudges after more than 7 days', () => {
    expect(backupReminder(addDays(NOW, -7), NOW, true)).toEqual({ kind: 'none' });
    expect(backupReminder(addDays(NOW, -8), NOW, true)).toEqual({ kind: 'old', daysAgo: 8 });
  });
});

describe('attentionItems', () => {
  const p = (id: string, n: number) => ({ id, name: id, totalPieces: n, coverThumb: null });
  it('puts sold out first, then low by fewest pieces, capped', () => {
    const items = attentionItems([p('a', 0)], [p('b', 2), p('c', 1)], 2);
    expect(items.map((i) => [i.id, i.status])).toEqual([
      ['a', 'out'],
      ['c', 'low'],
    ]);
  });
  it('is empty when nothing needs attention', () => expect(attentionItems([], [])).toEqual([]));
});

describe('compareWithYesterday', () => {
  it('direction and absolute difference', () => {
    expect(compareWithYesterday(500, 200)).toEqual({ direction: 'up', diff: 300 });
    expect(compareWithYesterday(0, 200)).toEqual({ direction: 'down', diff: 200 });
    expect(compareWithYesterday(0, 0)).toEqual({ direction: 'same', diff: 0 });
  });
});
