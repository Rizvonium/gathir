/** Reminder taps never open owner screens over the Showroom; they wait until it is left (PIN). */
import { act, render } from '@testing-library/react-native';

import { useBackupReminderRouting } from '@/features/backup/useBackupReminderRouting';
import { enterShowroom, resetShowroomSessionForTests } from '@/features/showroom/logic/session';

import { useFollowUpNotificationRouting } from '../followUpNotifications';

let mockResponse: unknown = null;
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  useLastNotificationResponse: () => mockResponse,
  AndroidImportance: { HIGH: 6 },
  AndroidNotificationVisibility: { PRIVATE: 2 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/db/client', () => ({ db: {} }));

const { router } = jest.requireMock('expo-router') as { router: { push: jest.Mock } };
const tap = (id: string, data: Record<string, unknown>) => ({ notification: { request: { identifier: id, content: { data } } }, actionIdentifier: 'default' });

function Routing() {
  useFollowUpNotificationRouting();
  useBackupReminderRouting();
  return null;
}

beforeEach(() => {
  jest.useFakeTimers();
  router.push.mockClear();
  resetShowroomSessionForTests();
});
afterEach(() => jest.useRealTimers());

it('opens the customer at once when no Showroom is open', async () => {
  mockResponse = tap('n1', { type: 'follow-up', customerId: 'c1' });
  await render(<Routing />);
  expect(router.push).toHaveBeenCalledTimes(1);
});

it('over the Showroom, waits: the tapped reminder opens only after the Showroom is left', async () => {
  const exit = enterShowroom();
  mockResponse = tap('n2', { type: 'backup-reminder' });
  await render(<Routing />);
  await act(async () => {
    jest.runAllTimers();
  });
  expect(router.push).not.toHaveBeenCalled();
  await act(async () => {
    exit();
    jest.runAllTimers();
  });
  expect(router.push).toHaveBeenCalledWith('/backup');
});
