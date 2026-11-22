/** Follow-ups: event + local notification stay in step (schedule, done, undo, permission off). */
import { createCustomer, getCustomerProfile } from '@/db/repo/customers';
import { dueFollowUps } from '@/db/repo/events';
import { createTestDb } from '@/test/testDb';

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
  setNotificationChannelAsync: jest.fn(async () => null),
  scheduleNotificationAsync: jest.fn(async () => 'notif-1'),
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
  setNotificationHandler: jest.fn(),
  useLastNotificationResponse: jest.fn(() => null),
  AndroidImportance: { HIGH: 6 },
  AndroidNotificationVisibility: { PRIVATE: 2 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

import {
  createFollowUp,
  customerIdFromResponse,
  finishFollowUp,
  removeFollowUp,
  scheduleFollowUpNotification,
  undoFinishFollowUp,
} from '../followUpNotifications';

type AsyncMock = jest.Mock<Promise<unknown>, unknown[]>;
const mockNotifications = jest.requireMock('expo-notifications') as Record<
  'getPermissionsAsync' | 'requestPermissionsAsync' | 'setNotificationChannelAsync' | 'scheduleNotificationAsync' | 'cancelScheduledNotificationAsync',
  AsyncMock
>;

const NOW = new Date(2026, 10, 22, 12).getTime();
const DUE = new Date(2026, 11, 6, 10).getTime();
const texts = { channelName: 'Customer follow-ups', title: 'Follow up with Anita', body: 'New Kani arrived' };

beforeEach(() => jest.clearAllMocks());

function setup() {
  const db = createTestDb();
  const customerId = createCustomer(db, { name: 'Anita', phone: '9906000104' }, NOW);
  return { db, customerId };
}

it('saves the follow-up, schedules a date reminder on the follow-ups channel and stores its id', async () => {
  const { db, customerId } = setup();
  const res = await createFollowUp(db, { customerId, dueAt: DUE, note: 'New Kani arrived', texts }, NOW);
  expect(res).toMatchObject({ status: 'scheduled', notificationId: 'notif-1' });
  expect(mockNotifications.setNotificationChannelAsync).toHaveBeenCalledWith('follow-ups', expect.objectContaining({ importance: 6, lockscreenVisibility: 2 }));
  expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledWith({
    content: { title: texts.title, body: texts.body, data: { type: 'follow-up', customerId, eventId: res.eventId } },
    trigger: { type: 'date', date: DUE, channelId: 'follow-ups' },
  });
  const open = getCustomerProfile(db, customerId)!.openFollowUps;
  expect(open).toHaveLength(1);
  expect(open[0]).toMatchObject({ dueAt: DUE, note: 'New Kani arrived', notificationId: 'notif-1' });
});

it('still saves the follow-up when notifications are refused (shows on Home)', async () => {
  const { db, customerId } = setup();
  mockNotifications.getPermissionsAsync.mockResolvedValueOnce({ granted: false, canAskAgain: true });
  mockNotifications.requestPermissionsAsync.mockResolvedValueOnce({ granted: false, canAskAgain: false });
  const res = await createFollowUp(db, { customerId, dueAt: DUE, note: '', texts }, NOW);
  expect(res.status).toBe('denied');
  expect(mockNotifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  expect(dueFollowUps(db, DUE)).toHaveLength(1);
});

it('does not ask again once Android says never', async () => {
  mockNotifications.getPermissionsAsync.mockResolvedValueOnce({ granted: false, canAskAgain: false });
  const res = await scheduleFollowUpNotification({ eventId: 'e', customerId: 'c', dueAt: DUE, texts }, NOW);
  expect(res.status).toBe('denied');
  expect(mockNotifications.requestPermissionsAsync).not.toHaveBeenCalled();
});

it('skips reminders in the past and survives scheduling errors', async () => {
  expect((await scheduleFollowUpNotification({ eventId: 'e', customerId: 'c', dueAt: NOW - 1, texts }, NOW)).status).toBe('too_soon');
  mockNotifications.scheduleNotificationAsync.mockRejectedValueOnce(new Error('boom'));
  expect((await scheduleFollowUpNotification({ eventId: 'e', customerId: 'c', dueAt: DUE, texts }, NOW)).status).toBe('error');
});

it('Done cancels the reminder; Undo reopens and reschedules', async () => {
  const { db, customerId } = setup();
  const { eventId } = await createFollowUp(db, { customerId, dueAt: DUE, note: '', texts }, NOW);
  await finishFollowUp(db, eventId, NOW + 1);
  expect(mockNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('notif-1');
  expect(getCustomerProfile(db, customerId)!.openFollowUps).toHaveLength(0);

  mockNotifications.scheduleNotificationAsync.mockResolvedValueOnce('notif-2');
  await undoFinishFollowUp(db, { eventId, customerId, dueAt: DUE, texts }, NOW + 2);
  expect(getCustomerProfile(db, customerId)!.openFollowUps[0]).toMatchObject({ id: eventId, notificationId: 'notif-2' });
});

it('Undo of a new follow-up deletes it and its reminder', async () => {
  const { db, customerId } = setup();
  const res = await createFollowUp(db, { customerId, dueAt: DUE, note: '', texts }, NOW);
  await removeFollowUp(db, res.eventId, res.notificationId);
  expect(mockNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('notif-1');
  expect(getCustomerProfile(db, customerId)!.timeline).toHaveLength(0);
});

it('reads the customer id from a tapped reminder only', () => {
  const response = (data: Record<string, unknown>) =>
    ({ notification: { request: { identifier: 'n', content: { data } } }, actionIdentifier: 'default' }) as never;
  expect(customerIdFromResponse(response({ type: 'follow-up', customerId: 'c1' }))).toBe('c1');
  expect(customerIdFromResponse(response({ type: 'backup', customerId: 'c1' }))).toBeNull();
  expect(customerIdFromResponse(null)).toBeNull();
});
