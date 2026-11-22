/**
 * Weekly backup reminder (PLAN §3 Safety, §15): one local notification, replaced after every
 * backup, so it fires only when a week passes without one. No internet. Never throws.
 */
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';

import { backupReminderAt } from './backupView';

export const BACKUP_REMINDER_ID = 'gathir-backup-reminder';
export const BACKUP_CHANNEL = 'backups';

export type BackupReminderTexts = { channelName: string; title: string; body: string };

/** Re-arms the reminder for a week after `lastBackupAt`. Asks for permission only if it can. */
export async function scheduleBackupReminder(texts: BackupReminderTexts, lastBackupAt: number = Date.now(), now: number = Date.now()): Promise<boolean> {
  try {
    await Notifications.cancelScheduledNotificationAsync(BACKUP_REMINDER_ID).catch(() => undefined);
    const at = backupReminderAt(lastBackupAt);
    if (at <= now) return false;
    await Notifications.setNotificationChannelAsync(BACKUP_CHANNEL, { name: texts.channelName, importance: AndroidImportance.DEFAULT });
    const perm = await Notifications.getPermissionsAsync();
    const granted = perm.granted || (perm.canAskAgain && (await Notifications.requestPermissionsAsync()).granted);
    if (!granted) return false;
    await Notifications.scheduleNotificationAsync({
      identifier: BACKUP_REMINDER_ID,
      content: { title: texts.title, body: texts.body, data: { type: 'backup-reminder', url: '/backup' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: BACKUP_CHANNEL },
    });
    return true;
  } catch {
    return false;
  }
}
