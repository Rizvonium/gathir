/**
 * Opens /backup when the seller taps the weekly backup reminder (see backupReminder.ts).
 * Mount once in the root layout, next to the follow-up routing, so it also works on a cold start.
 */
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';

/** True when a notification response is a tap on the backup reminder. Pure. */
export function isBackupReminderResponse(response: Notifications.MaybeNotificationResponse): boolean {
  return response?.notification.request.content.data?.type === 'backup-reminder';
}

export function useBackupReminderRouting(): void {
  const response = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (!isBackupReminderResponse(response)) return;
    const id = response?.notification.request.identifier ?? null;
    if (!id || handled.current === id) return;
    handled.current = id;
    router.push('/backup');
  }, [response]);
}
