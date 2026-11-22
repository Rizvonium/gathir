/** All timestamps are stored as epoch milliseconds (integers). */

export function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function endOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export function startOfWeek(ms: number): number {
  const d = new Date(startOfDay(ms));
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  return d.getTime();
}

export function startOfMonth(ms: number): number {
  const d = new Date(startOfDay(ms));
  d.setDate(1);
  return d.getTime();
}

export function addDays(ms: number, days: number): number {
  const d = new Date(ms);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

const dateFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' });
const dayFmt = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

/** "22 Nov 2026" */
export function formatDate(ms: number): string {
  return dateFmt.format(ms);
}

/** "4:05 pm" */
export function formatTime(ms: number): string {
  return timeFmt.format(ms);
}

/** "Sun, 22 Nov" */
export function formatDay(ms: number): string {
  return dayFmt.format(ms);
}

export type RelativeDays = { key: 'today' | 'yesterday' | 'daysAgo' | 'monthsAgo'; count: number };

/**
 * Translatable relative day: show it with `t(`common:relative.${r.key}`, { count: r.count })`
 * (plural keys live in src/i18n/en/common.json → relative.*).
 */
export function relativeDaysKey(ms: number, now: number): RelativeDays {
  const days = Math.round((startOfDay(now) - startOfDay(ms)) / 86_400_000);
  if (days <= 0) return { key: 'today', count: 0 };
  if (days === 1) return { key: 'yesterday', count: 1 };
  if (days < 30) return { key: 'daysAgo', count: days };
  return { key: 'monthsAgo', count: Math.round(days / 30) };
}

/** "3 days ago", "today", "yesterday" — English only; UI should use relativeDaysKey + i18n. */
export function relativeDays(ms: number, now: number): string {
  const r = relativeDaysKey(ms, now);
  if (r.key === 'today') return 'today';
  if (r.key === 'yesterday') return 'yesterday';
  if (r.key === 'daysAgo') return `${r.count} days ago`;
  return r.count === 1 ? '1 month ago' : `${r.count} months ago`;
}
