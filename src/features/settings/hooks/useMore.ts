/** Everything the More tab shows, read live (rows update right after any change). */
import * as Application from 'expo-application';

import { db } from '@/db/client';
import { useDbQuery, useToday } from '@/db/hooks';
import { updateSettings } from '@/db/repo/settings';

import { readMoreSummary } from '../settingsData';
import { backupAge, backupIsStale, describeLowStock } from '../settingsLogic';

export function appVersionLabel(): string {
  const v = Application.nativeApplicationVersion ?? '1.0.0';
  const b = Application.nativeBuildVersion;
  return b ? `${v} (${b})` : v;
}

export function useMore() {
  const summary = useDbQuery(readMoreSummary, []);
  // Day buckets only ("today", "3 days ago"): the start of today is precise enough.
  const now = useToday();
  return {
    summary,
    backup: backupAge(summary.lastBackupAt, now),
    backupStale: backupIsStale(summary.lastBackupAt, now),
    lowStock: describeLowStock(summary.lowStockLevel),
    version: appVersionLabel(),
    setIncludePhones: (on: boolean) => {
      updateSettings(db, { reportIncludesCustomerPhones: on });
    },
    setIncludeProfit: (on: boolean) => {
      updateSettings(db, { reportIncludesProfit: on });
    },
  };
}
