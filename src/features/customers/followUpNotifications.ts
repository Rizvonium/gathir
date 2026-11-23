/**
 * Follow-up reminders as local notifications (no internet): Android channel 'follow-ups',
 * permission asked only when the seller first sets a reminder, notification id stored on the
 * follow-up event so "Done" / delete can cancel it. Device calls never throw: they return a status.
 */
import * as Notifications from 'expo-notifications';
import { AndroidImportance, AndroidNotificationVisibility } from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';

import { addFollowUp, completeFollowUp, deleteEvent, openFollowUpsFor, reopenFollowUp, setFollowUpNotification } from '@/db/repo/events';
import type { DbOrTx } from '@/db/types';
import { isShowroomActive, whenShowroomClosed } from '@/features/showroom/logic/session';

import { customerHref } from './logic/links';

export const FOLLOW_UP_CHANNEL = 'follow-ups';
export const FOLLOW_UP_DATA_TYPE = 'follow-up';
/** Reminders closer than this are not scheduled (the Home "Follow-ups due" card covers them). */
export const MIN_LEAD_MS = 60_000;

export type ReminderTexts = {
  /** Android channel name shown in system settings, e.g. "Customer follow-ups". */
  channelName: string;
  /** Notification title, e.g. "Follow up with Anita Kaul". */
  title: string;
  /** Notification body: the follow-up note or a default line. */
  body: string;
};

export type ScheduleStatus = 'scheduled' | 'denied' | 'too_soon' | 'error';

let channelReady: Promise<void> | null = null;

/** Creates the 'follow-ups' channel once per launch. */
export function ensureFollowUpChannel(name: string): Promise<void> {
  channelReady ??= Notifications.setNotificationChannelAsync(FOLLOW_UP_CHANNEL, {
    name,
    importance: AndroidImportance.HIGH,
    // Customer names stay off the lock screen (PLAN §15 privacy).
    lockscreenVisibility: AndroidNotificationVisibility.PRIVATE,
    showBadge: true,
  })
    .then(() => undefined)
    .catch(() => {
      channelReady = null;
    });
  return channelReady;
}

/** True when notifications may be shown. Asks once, gracefully; never throws. */
export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const asked = await Notifications.requestPermissionsAsync();
    return asked.granted;
  } catch {
    return false;
  }
}

/** Schedules one reminder at `dueAt`. Returns the notification id, or a status explaining why not. */
export async function scheduleFollowUpNotification(
  input: { eventId: string; customerId: string; dueAt: number; texts: ReminderTexts },
  now: number = Date.now(),
): Promise<{ status: ScheduleStatus; notificationId: string | null }> {
  if (input.dueAt - now < MIN_LEAD_MS) return { status: 'too_soon', notificationId: null };
  // Channel first: on Android 13+ the permission prompt only appears once a channel exists.
  await ensureFollowUpChannel(input.texts.channelName);
  if (!(await ensureNotificationPermission())) return { status: 'denied', notificationId: null };
  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: input.texts.title,
        body: input.texts.body,
        data: { type: FOLLOW_UP_DATA_TYPE, customerId: input.customerId, eventId: input.eventId },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: input.dueAt, channelId: FOLLOW_UP_CHANNEL },
    });
    return { status: 'scheduled', notificationId };
  } catch {
    return { status: 'error', notificationId: null };
  }
}

/** Cancels a scheduled reminder. Safe with null and with ids that already fired. */
export async function cancelFollowUpNotification(notificationId: string | null | undefined): Promise<void> {
  if (!notificationId) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // Already delivered or removed: nothing to cancel.
  }
}

// ---------------------------------------------------------------------------------------------
// Database + device together

/**
 * Saves the follow-up (sync, so it shows at once) and then schedules its reminder, storing the
 * notification id on the event. The follow-up exists even when notifications are off: it still
 * shows on Home and the profile.
 */
export async function createFollowUp(
  database: DbOrTx,
  input: { customerId: string; dueAt: number; note: string; texts: ReminderTexts },
  now: number = Date.now(),
): Promise<{ eventId: string; status: ScheduleStatus; notificationId: string | null }> {
  const eventId = addFollowUp(database, { customerId: input.customerId, dueAt: input.dueAt, note: input.note }, now);
  const res = await scheduleFollowUpNotification({ eventId, customerId: input.customerId, dueAt: input.dueAt, texts: input.texts }, now);
  if (res.notificationId) setFollowUpNotification(database, eventId, res.notificationId);
  return { eventId, status: res.status, notificationId: res.notificationId };
}

/** Marks a follow-up done and cancels its reminder. */
export async function finishFollowUp(database: DbOrTx, eventId: string, now: number = Date.now()): Promise<void> {
  const notificationId = completeFollowUp(database, eventId, now);
  setFollowUpNotification(database, eventId, null);
  await cancelFollowUpNotification(notificationId);
}

/** Undo for finishFollowUp: reopens it and schedules the reminder again when still ahead. */
export async function undoFinishFollowUp(
  database: DbOrTx,
  input: { eventId: string; customerId: string; dueAt: number; texts: ReminderTexts },
  now: number = Date.now(),
): Promise<void> {
  reopenFollowUp(database, input.eventId);
  const res = await scheduleFollowUpNotification(input, now);
  if (res.notificationId) setFollowUpNotification(database, input.eventId, res.notificationId);
}

/**
 * After a customer comes back from Recently deleted (or a delete is undone elsewhere): re-arms the
 * reminders of their open follow-ups that are still ahead. Deleting a customer cancels them.
 */
export async function rescheduleOpenFollowUps(
  database: DbOrTx,
  customerId: string,
  textsFor: (note: string) => ReminderTexts,
  now: number = Date.now(),
): Promise<void> {
  for (const e of openFollowUpsFor(database, customerId)) {
    if (e.dueAt === null) continue;
    const res = await scheduleFollowUpNotification({ eventId: e.id, customerId, dueAt: e.dueAt, texts: textsFor(e.note) }, now);
    if (res.notificationId) setFollowUpNotification(database, e.id, res.notificationId);
  }
}

/** Undo for createFollowUp: removes the event and its reminder. */
export async function removeFollowUp(database: DbOrTx, eventId: string, notificationId: string | null): Promise<void> {
  deleteEvent(database, eventId);
  await cancelFollowUpNotification(notificationId);
}

// ---------------------------------------------------------------------------------------------
// Tapping a reminder

let handlerInstalled = false;

/**
 * How a reminder that arrives while the app is open is shown. Normally as a banner (otherwise
 * Android drops it silently in the foreground). While a Showroom is open the phone may be in a
 * customer's hands, and a reminder carries another customer's name and the seller's note: it is
 * not shown at all (follow-ups stay on Home, the backup reminder on its Home card). Pure.
 */
export function foregroundPresentation(showroomOpen: boolean): Notifications.NotificationBehavior {
  return { shouldShowBanner: !showroomOpen, shouldShowList: !showroomOpen, shouldPlaySound: false, shouldSetBadge: false };
}

/** Shows reminders while the app is open too, except over the Showroom (see foregroundPresentation). */
export function installFollowUpNotificationHandler(): void {
  if (handlerInstalled) return;
  handlerInstalled = true;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => foregroundPresentation(isShowroomActive()),
    });
  } catch {
    handlerInstalled = false;
  }
}

/** Customer id carried by a follow-up notification response, or null. Pure. */
export function customerIdFromResponse(response: Notifications.MaybeNotificationResponse): string | null {
  const data = response?.notification.request.content.data;
  if (!data || data.type !== FOLLOW_UP_DATA_TYPE) return null;
  return typeof data.customerId === 'string' && data.customerId ? data.customerId : null;
}

/**
 * Opens the customer's profile when the seller taps a follow-up reminder. Mount once, high in
 * the tree (root layout), so it also works on a cold start from the notification.
 */
export function useFollowUpNotificationRouting(): void {
  const response = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);
  useEffect(() => {
    installFollowUpNotificationHandler();
  }, []);
  useEffect(() => {
    const customerId = customerIdFromResponse(response);
    const id = response?.notification.request.identifier ?? null;
    if (!customerId || !id || handled.current === id) return;
    handled.current = id;
    // Over the Showroom this would open a private profile without the PIN: wait until it is left.
    whenShowroomClosed('notification', () => router.push(customerHref(customerId)));
  }, [response]);
}
