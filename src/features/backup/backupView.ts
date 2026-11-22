/** Pure helpers for the Backup screens: plain counts and the restore-result route params. */
import type { BackupCounts } from './backupFormat';
import type { RestoreFailureReason } from './backupService';

export type PlainCounts = { designs: number; sales: number; customers: number; photos: number };

/** "21 designs, 40 sales, 12 customers, 63 photos" (photos: each has a full file and a thumbnail). */
export function plainCounts(c: BackupCounts): PlainCounts {
  const n = (k: string) => (Number.isFinite(c.tables[k]) ? c.tables[k] : 0);
  return { designs: n('products'), sales: n('sales'), customers: n('customers'), photos: Math.ceil(Math.max(0, c.photoFiles) / 2) };
}

export type RestoreOutcome = { kind: 'ok'; counts: PlainCounts } | { kind: Exclude<RestoreFailureReason, 'cancelled'> };

const FAILURES = ['invalid', 'newer_version', 'failed'] as const;

export function outcomeToParams(o: RestoreOutcome): Record<string, string> {
  if (o.kind !== 'ok') return { status: o.kind };
  return { status: 'ok', designs: String(o.counts.designs), sales: String(o.counts.sales), customers: String(o.counts.customers), photos: String(o.counts.photos) };
}

const int = (v: string | string[] | undefined): number => {
  const s = Array.isArray(v) ? v[0] : v;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
};

/** Route params → outcome. Unknown values read as 'failed' (never claims success by mistake). */
export function paramsToOutcome(p: Record<string, string | string[] | undefined>): RestoreOutcome {
  const status = Array.isArray(p.status) ? p.status[0] : p.status;
  if (status === 'ok') return { kind: 'ok', counts: { designs: int(p.designs), sales: int(p.sales), customers: int(p.customers), photos: int(p.photos) } };
  return { kind: (FAILURES as readonly string[]).includes(status ?? '') ? (status as (typeof FAILURES)[number]) : 'failed' };
}

/** Rough size of the next backup: photos + data (zip barely shrinks JPEGs). */
export function estimateBackupBytes(u: { photosBytes: number; dbBytes: number }, thumbShare = 0.15): number {
  return Math.round(u.photosBytes * (1 + thumbShare) + u.dbBytes);
}

export const BACKUP_REMINDER_DAYS = 7;
export const BACKUP_REMINDER_HOUR = 11;

/** When the weekly reminder fires: 7 days after the backup, at 11:00 (shop hours, not at night). */
export function backupReminderAt(lastBackupAt: number): number {
  const d = new Date(lastBackupAt);
  d.setDate(d.getDate() + BACKUP_REMINDER_DAYS);
  d.setHours(BACKUP_REMINDER_HOUR, 0, 0, 0);
  return d.getTime();
}
