import { fireEvent, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import type { CustomerListFilters, CustomerListRow } from '@/db/repo/customerQueries';

import { CustomersScreen } from '../components/CustomersScreen';
import { customerRow, renderScreen, router, share } from './customersMocks';

jest.mock('react-native-reanimated', () => require('@/ui/components/__tests__/reanimatedMock'));
jest.mock('react-native-keyboard-controller', () => require('react-native-keyboard-controller/jest'));
jest.mock('@shopify/flash-list', () => require('./customersMocks').flashList);
jest.mock('react-native-gesture-handler', () => require('./customersMocks').gestureHandler);
jest.mock('@expo/ui', () => require('./customersMocks').expoUi);
jest.mock('@/ui/patterns', () => require('./customersMocks').patterns);
jest.mock('expo-router', () => ({ router: require('./customersMocks').router, useIsFocused: () => true }));
jest.mock('@/share', () => require('./customersMocks').share);
jest.mock('@/db/client', () => ({ db: {} }));
jest.mock('expo-contacts', () => ({ Contact: { presentPicker: jest.fn(async () => null) }, requestPermissionsAsync: jest.fn() }));

const mockState: { rows: CustomerListRow[]; last: CustomerListFilters | null } = { rows: [], last: null };
jest.mock('@/db/hooks', () => ({
  useCustomers: (f: CustomerListFilters) => {
    mockState.last = f;
    return mockState.rows;
  },
  useDbQuery: (fn: () => unknown, deps: unknown[]) => (deps.length === 1 && typeof deps[0] === 'boolean' ? (deps[0] ? 2 : -1) : fn()),
  useToday: () => 0,
}));
jest.mock('@/db/repo/customerQueries', () => ({ listCustomers: () => [] }));

beforeEach(() => {
  jest.clearAllMocks();
  mockState.rows = [];
  mockState.last = null;
});

it('shows the empty book with "Add from contacts" and "Add customer"', async () => {
  await renderScreen(<CustomersScreen />);
  expect(screen.getByText('Your customer book is empty')).toBeTruthy();
  expect(screen.getByText('Add from contacts')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('customers-empty-add'));
  expect(router.push).toHaveBeenCalledWith('/customer/new');
});

it('lists customers with tag, city, last visit and spend; opens the profile', async () => {
  mockState.rows = [customerRow(), customerRow({ id: 'c2', name: 'A very long customer name that keeps going', phone: null, lifetimeSpendPaise: 0, lastVisitAt: null, tag: 'tourist', city: '' })];
  await renderScreen(<CustomersScreen />);
  expect(screen.getByText('Anita Kaul')).toBeTruthy();
  expect(screen.getByText('Regular · Srinagar')).toBeTruthy();
  expect(screen.getByText('Last visit 3 days ago')).toBeTruthy();
  expect(screen.getByText('₹45,000 spent')).toBeTruthy();
  expect(screen.getByText('No purchase yet')).toBeTruthy();
  // No phone → no quick buttons for that row.
  expect(screen.queryByTestId('customer-wa-c2')).toBeNull();
  await fireEvent.press(screen.getByTestId('customer-row-c1'));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/customer/[id]', params: { id: 'c1' } });
});

it('quick WhatsApp and Call use the saved number', async () => {
  mockState.rows = [customerRow()];
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  await renderScreen(<CustomersScreen />);
  await fireEvent.press(screen.getByLabelText('WhatsApp Anita Kaul'));
  expect(share.openWhatsAppChat).toHaveBeenCalledWith('+919906000104', '');
  await fireEvent.press(screen.getByLabelText('Call Anita Kaul'));
  expect(open).toHaveBeenCalledWith('tel:+919906000104');
});

it('passes tag, follow-up and inactivity filters to the query and shows a filtered empty state', async () => {
  mockState.rows = [customerRow()];
  await renderScreen(<CustomersScreen />);
  await fireEvent.press(screen.getByTestId('customers-tag-wholesale'));
  expect(mockState.last).toMatchObject({ tag: 'wholesale' });
  await fireEvent.press(screen.getByTestId('customers-filter-due'));
  await fireEvent.press(screen.getByTestId('customers-filter-inactive'));
  expect(mockState.last).toMatchObject({ followUpDue: true, inactiveDays: 90 });
});

it('marks customers whose follow-up is due', async () => {
  mockState.rows = [customerRow({ nextFollowUpAt: Date.now() - 1000 })];
  await renderScreen(<CustomersScreen />);
  expect(screen.getByText('Follow up')).toBeTruthy();
});

it('sorts from the sheet', async () => {
  mockState.rows = [customerRow()];
  await renderScreen(<CustomersScreen />);
  await fireEvent.press(screen.getByTestId('customers-sort'));
  await fireEvent.press(screen.getByTestId('customers-sort-spend'));
  expect(mockState.last).toMatchObject({ sort: 'spend' });
  expect(screen.getByText('Sort: Most spent')).toBeTruthy();
});

it('opened from Home\'s "See all" follow-ups: starts with "Follow-up due" on, and again on the next link', async () => {
  mockState.rows = [customerRow()];
  const { customerListSeed } = jest.requireActual('../logic/links') as typeof import('../logic/links');
  const { useState } = jest.requireActual<typeof import('react')>('react');
  const { Pressable } = jest.requireActual<typeof import('react-native')>('react-native');
  function Harness() {
    const [at, setAt] = useState('1');
    return (
      <>
        <Pressable testID="next-link" onPress={() => setAt('2')} />
        <CustomersScreen seed={customerListSeed({ filter: 'due', at })} />
      </>
    );
  }
  await renderScreen(<Harness />);
  expect(mockState.last).toMatchObject({ followUpDue: true });
  await fireEvent.press(screen.getByTestId('customers-filter-due'));
  expect(mockState.last).toMatchObject({ followUpDue: undefined });
  await fireEvent.press(screen.getByTestId('next-link'));
  expect(mockState.last).toMatchObject({ followUpDue: true });
});
