/** Pure Home ("My Shop") logic: greeting, report and backup status, attention strip. */
import type { HomeSummary } from '@/db/repo/dashboard';
import type { DueFollowUp } from '@/db/repo/events';
import { startOfDay } from '@/lib/dates';

import type { HomeExtras } from './homeData';

export type GreetingPart = 'morning' | 'afternoon' | 'evening';

/** Local hour 0–23 → greeting key. Before noon morning, before 5 pm afternoon, else evening. */
export function greetingPart(hour: number): GreetingPart {
  if (hour >= 4 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  return 'evening';
}

/** Whole calendar days between `ms` and `now` (0 = same day). Never negative. */
export function calendarDaysAgo(ms: number, now: number): number {
  // Round to absorb the 1-hour DST shift; India has none, but phones may be set elsewhere.
  return Math.max(0, Math.round((startOfDay(now) - startOfDay(ms)) / 86_400_000));
}

export type ReportStatus = { kind: 'never'; newSales: number } | { kind: 'sent'; daysAgo: number; newSales: number };

export function reportStatus(lastSentAt: number | null, unreportedSales: number, now: number): ReportStatus {
  if (lastSentAt === null) return { kind: 'never', newSales: unreportedSales };
  return { kind: 'sent', daysAgo: calendarDaysAgo(lastSentAt, now), newSales: unreportedSales };
}

/** Days after which Home nudges for a backup. */
export const BACKUP_REMINDER_DAYS = 7;

export type BackupReminder = { kind: 'none' } | { kind: 'never' } | { kind: 'old'; daysAgo: number };

/**
 * Backup nudge. Shown when never backed up (only once the shop has something to lose)
 * or when the last backup is more than 7 days old.
 */
export function backupReminder(lastBackupAt: number | null, now: number, hasData: boolean): BackupReminder {
  if (lastBackupAt === null) return hasData ? { kind: 'never' } : { kind: 'none' };
  const days = calendarDaysAgo(lastBackupAt, now);
  return days > BACKUP_REMINDER_DAYS ? { kind: 'old', daysAgo: days } : { kind: 'none' };
}

export type AttentionInput = { id: string; name: string; totalPieces: number; coverThumb: string | null };
export type AttentionItem = AttentionInput & { status: 'out' | 'low' };

/** Sold-out designs first (nothing to sell), then low stock, fewest pieces first. Capped. */
export function attentionItems(soldOut: AttentionInput[], low: AttentionInput[], limit = 12): AttentionItem[] {
  const out = soldOut.map((p) => ({ ...p, status: 'out' as const }));
  const lows = [...low].sort((a, b) => a.totalPieces - b.totalPieces).map((p) => ({ ...p, status: 'low' as const }));
  return [...out, ...lows].slice(0, limit);
}

export type Comparison = { direction: 'up' | 'down' | 'same'; diff: number };

/** Today's amount vs yesterday's (paise). */
export function compareWithYesterday(today: number, yesterday: number): Comparison {
  const diff = today - yesterday;
  return { direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'same', diff: Math.abs(diff) };
}

export type HomeModel = {
  greeting: GreetingPart;
  shopName: string;
  summary: HomeSummary;
  lowStockLevel: number;
  /** No live products at all (show the empty-shop invitation). */
  emptyShop: boolean;
  hasSample: boolean;
  today: Comparison;
  attention: AttentionItem[];
  /** Sold-out + low designs in total (the strip is capped). */
  attentionTotal: number;
  report: ReportStatus;
  backup: BackupReminder;
  followUps: DueFollowUp[];
};

/** Pure assembly from the summary and extras of everything Home shows. */
export function buildHomeModel(summary: HomeSummary, extras: HomeExtras, lowStockLevel: number, now: number): HomeModel {
  return {
    greeting: greetingPart(new Date(now).getHours()),
    shopName: extras.shopName,
    summary,
    lowStockLevel,
    emptyShop: summary.designs === 0,
    hasSample: extras.hasSample,
    today: compareWithYesterday(summary.todayAmountPaise, summary.yesterdayAmountPaise),
    attention: attentionItems(summary.soldOut, summary.lowStock),
    attentionTotal: summary.soldOut.length + summary.lowStock.length,
    report: reportStatus(summary.lastReportSentAt, summary.unreportedSalesCount, now),
    backup: backupReminder(extras.lastBackupAt, now, extras.realProducts > 0),
    followUps: summary.followUpsDue,
  };
}

