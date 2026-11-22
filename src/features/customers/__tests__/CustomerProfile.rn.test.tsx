import { fireEvent, screen } from '@testing-library/react-native';

import type { CustomerProfile, SuggestedProduct } from '@/db/repo/customerQueries';

import { CustomerProfileScreen } from '../components/CustomerProfileScreen';
import { followUpDueAt } from '../logic/customerLogic';
import { customer, profile, renderScreen, router } from './customersMocks';

jest.mock('react-native-reanimated', () => require('@/ui/components/__tests__/reanimatedMock'));
jest.mock('react-native-keyboard-controller', () => require('react-native-keyboard-controller/jest'));
jest.mock('react-native-gesture-handler', () => require('./customersMocks').gestureHandler);
jest.mock('@expo/ui', () => require('./customersMocks').expoUi);
jest.mock('@expo/ui/community/datetime-picker', () => require('./customersMocks').datePicker);
jest.mock('@/ui/patterns', () => require('./customersMocks').patterns);
jest.mock('@/lib/photos', () => require('./customersMocks').photos);
jest.mock('expo-router', () => ({ router: require('./customersMocks').router, useIsFocused: () => true }));
jest.mock('@/share', () => require('./customersMocks').share);
jest.mock('@/db/client', () => ({ db: {} }));
jest.mock('@/db/repo/customers', () => ({ updateCustomer: jest.fn(), softDeleteCustomer: jest.fn(), restoreCustomer: jest.fn() }));
jest.mock('@/db/repo/events', () => ({ addNote: jest.fn(() => 'note-1'), deleteEvent: jest.fn(), setFollowUpNotification: jest.fn() }));
jest.mock('@/db/repo/products', () => ({ getProductDetail: jest.fn(() => null) }));
jest.mock('../followUpNotifications', () => ({
  createFollowUp: jest.fn(async () => ({ eventId: 'f1', status: 'scheduled', notificationId: 'n1' })),
  finishFollowUp: jest.fn(async () => undefined),
  undoFinishFollowUp: jest.fn(async () => undefined),
  removeFollowUp: jest.fn(async () => undefined),
  cancelFollowUpNotification: jest.fn(async () => undefined),
  scheduleFollowUpNotification: jest.fn(async () => ({ status: 'scheduled', notificationId: 'n2' })),
}));

const mockData: { profile: CustomerProfile | null; suggestions: SuggestedProduct[] } = { profile: null, suggestions: [] };
jest.mock('@/db/hooks', () => ({
  useCustomerProfile: () => mockData.profile,
  useSuggestedProducts: () => mockData.suggestions,
  useDbQuery: (fn: (d: unknown) => unknown) => fn({}),
  useToday: () => 0,
}));

const repo = jest.requireMock('@/db/repo/customers') as Record<string, jest.Mock>;
const events = jest.requireMock('@/db/repo/events') as Record<string, jest.Mock>;
const followUps = jest.requireMock('../followUpNotifications') as Record<string, jest.Mock>;

function suggestion(id: string, name: string): SuggestedProduct {
  return {
    id,
    code: 'GTH-1',
    name,
    categoryId: null,
    categoryName: null,
    craft: 'Sozni',
    material: '',
    size: '',
    ratePaise: 650_000,
    oneOfAKind: false,
    isSample: false,
    createdAt: 0,
    totalPieces: 3,
    status: 'in',
    colours: [],
    coverThumb: null,
    coverFile: null,
    score: 3,
    reasons: ['craft', 'colour'],
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockData.profile = profile();
  mockData.suggestions = [];
});

it('shows contact, totals and big WhatsApp / Call buttons', async () => {
  await renderScreen(<CustomerProfileScreen id="c1" />);
  expect(screen.getByText('Anita Kaul')).toBeTruthy();
  expect(screen.getByText('Regular · Srinagar')).toBeTruthy();
  expect(screen.getByText('₹45,000')).toBeTruthy();
  expect(screen.getByText('yesterday')).toBeTruthy();
  expect(screen.getByTestId('customer-whatsapp')).toBeTruthy();
  expect(screen.getByTestId('customer-call')).toBeTruthy();
});

it('offers learned likes and saves them in one tap, with Undo', async () => {
  await renderScreen(<CustomerProfileScreen id="c1" />);
  expect(screen.getByText('Usually buys Sozni')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('learned-accept'));
  expect(repo.updateCustomer).toHaveBeenCalledWith({}, 'c1', { likes: { colours: ['maroon'], crafts: ['Sozni'] } });
  await fireEvent.press(screen.getByText('Undo'));
  expect(repo.updateCustomer).toHaveBeenLastCalledWith({}, 'c1', { likes: { colours: ['maroon'], crafts: [] } });
});

it('sends suggested designs as a catalogue for this customer', async () => {
  mockData.suggestions = [suggestion('p1', 'Maroon Sozni'), suggestion('p2', 'Kani stole')];
  await renderScreen(<CustomerProfileScreen id="c1" />);
  await fireEvent.press(screen.getByTestId('suggested-send'));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/catalogue', params: { customerId: 'c1', productIds: 'p1,p2' } });
  await fireEvent.press(screen.getByTestId('suggested-p2'));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/product/[id]', params: { id: 'p2' } });
});

it('sells to this customer from the thumb-zone footer', async () => {
  await renderScreen(<CustomerProfileScreen id="c1" />);
  await fireEvent.press(screen.getByTestId('customer-sell'));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/sell', params: { customerId: 'c1' } });
});

it('sets a follow-up from a quick chip', async () => {
  await renderScreen(<CustomerProfileScreen id="c1" />);
  await fireEvent.press(screen.getByTestId('follow-up-add'));
  await fireEvent.press(screen.getByTestId('follow-up-choice-tomorrow'));
  await fireEvent.changeText(screen.getByTestId('follow-up-note'), 'New Kani arrived');
  await fireEvent.press(screen.getByTestId('follow-up-save'));
  expect(followUps.createFollowUp).toHaveBeenCalledWith(
    {},
    expect.objectContaining({
      customerId: 'c1',
      note: 'New Kani arrived',
      texts: expect.objectContaining({ title: 'Follow up with Anita Kaul', body: 'New Kani arrived', channelName: 'Customer follow-ups' }),
    }),
  );
  const dueAt = followUps.createFollowUp.mock.calls[0][1].dueAt as number;
  // Same day as "tomorrow at 10:00" computed now (the test may straddle a second, not a day).
  expect(new Date(dueAt).toDateString()).toBe(new Date(followUpDueAt('tomorrow', Date.now())).toDateString());
  expect(await screen.findByText(/Reminder set for/)).toBeTruthy();
});

it('marks an open follow-up done', async () => {
  const fu = { id: 'f1', customerId: 'c1', kind: 'follow_up' as const, refId: null, note: 'Call about wedding', dueAt: Date.now() - 2 * 86_400_000, doneAt: null, notificationId: 'n1', createdAt: 0 };
  mockData.profile = profile({ openFollowUps: [fu] });
  await renderScreen(<CustomerProfileScreen id="c1" />);
  expect(screen.getByText('2 days late')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('follow-up-done-f1'));
  expect(followUps.finishFollowUp).toHaveBeenCalledWith({}, 'f1');
});

it('saves a note with Undo', async () => {
  await renderScreen(<CustomerProfileScreen id="c1" />);
  await fireEvent.press(screen.getByText('Add note'));
  await fireEvent.changeText(screen.getByTestId('note-input'), 'Wants maroon');
  await fireEvent.press(screen.getByTestId('note-save'));
  expect(events.addNote).toHaveBeenCalledWith({}, 'c1', 'Wants maroon');
  await fireEvent.press(screen.getByText('Undo'));
  expect(events.deleteEvent).toHaveBeenCalledWith({}, 'note-1');
});

it('deletes without a dialog, explains sales stay, and Undo restores', async () => {
  const fu = { id: 'f1', customerId: 'c1', kind: 'follow_up' as const, refId: null, note: '', dueAt: Date.now() + 5 * 86_400_000, doneAt: null, notificationId: 'n1', createdAt: 0 };
  mockData.profile = profile({ openFollowUps: [fu] });
  await renderScreen(<CustomerProfileScreen id="c1" />);
  expect(screen.getByText(/Their past sales stay in your totals/)).toBeTruthy();
  await fireEvent.press(screen.getByTestId('customer-delete'));
  expect(repo.softDeleteCustomer).toHaveBeenCalledWith({}, 'c1');
  expect(followUps.cancelFollowUpNotification).toHaveBeenCalledWith('n1');
  expect(router.back).toHaveBeenCalled();
  expect(screen.getByText('Anita Kaul deleted. Sales keep their amounts.')).toBeTruthy();
  await fireEvent.press(screen.getByText('Undo'));
  expect(repo.restoreCustomer).toHaveBeenCalledWith({}, 'c1');
  expect(followUps.scheduleFollowUpNotification).toHaveBeenCalled();
});

it('shows a restore banner for a deleted customer', async () => {
  mockData.profile = profile({ customer: customer({ deletedAt: 1 }) });
  await renderScreen(<CustomerProfileScreen id="c1" />);
  expect(screen.queryByTestId('customer-sell')).toBeNull();
  await fireEvent.press(screen.getByTestId('customer-restore'));
  expect(repo.restoreCustomer).toHaveBeenCalled();
});

it('shows a not-found state', async () => {
  mockData.profile = null;
  await renderScreen(<CustomerProfileScreen id="gone" />);
  expect(screen.getByText('Customer not found')).toBeTruthy();
});

it('without a phone, offers to add one instead of dead buttons', async () => {
  mockData.profile = profile({ customer: customer({ phone: null }) });
  await renderScreen(<CustomerProfileScreen id="c1" />);
  expect(screen.queryByTestId('customer-whatsapp')).toBeNull();
  await fireEvent.press(screen.getByLabelText('Add phone number'));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/customer/[id]/edit', params: { id: 'c1' } });
});
