import { relativeDays, relativeDaysKey } from '../dates';

const NOW = new Date(2026, 10, 22, 15).getTime();
const daysBack = (n: number) => new Date(2026, 10, 22 - n, 9).getTime();

describe('relative days', () => {
  it('gives an i18n key and count by calendar day', () => {
    expect(relativeDaysKey(daysBack(0), NOW)).toEqual({ key: 'today', count: 0 });
    expect(relativeDaysKey(daysBack(1), NOW)).toEqual({ key: 'yesterday', count: 1 });
    expect(relativeDaysKey(daysBack(3), NOW)).toEqual({ key: 'daysAgo', count: 3 });
    expect(relativeDaysKey(daysBack(65), NOW)).toEqual({ key: 'monthsAgo', count: 2 });
    expect(relativeDaysKey(NOW + 86_400_000, NOW).key).toBe('today');
  });

  it('keeps the English fallback text', () => {
    expect(relativeDays(daysBack(0), NOW)).toBe('today');
    expect(relativeDays(daysBack(1), NOW)).toBe('yesterday');
    expect(relativeDays(daysBack(3), NOW)).toBe('3 days ago');
    expect(relativeDays(daysBack(31), NOW)).toBe('1 month ago');
  });
});
