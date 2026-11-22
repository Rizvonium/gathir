import { fireEvent, screen } from '@testing-library/react-native';

import type { CustomerProfile } from '@/db/repo/customerQueries';
import { DuplicateCustomerError } from '@/db/repo/errors';

import { CustomerFormScreen } from '../components/CustomerFormScreen';
import { customer, profile, renderScreen, router } from './customersMocks';

jest.mock('react-native-reanimated', () => require('@/ui/components/__tests__/reanimatedMock'));
jest.mock('react-native-keyboard-controller', () => require('react-native-keyboard-controller/jest'));
jest.mock('react-native-gesture-handler', () => require('./customersMocks').gestureHandler);
jest.mock('@expo/ui', () => require('./customersMocks').expoUi);
jest.mock('expo-router', () => ({ router: require('./customersMocks').router }));
jest.mock('@/db/client', () => ({ db: {} }));
jest.mock('@/db/repo/customers', () => ({ createCustomer: jest.fn(() => 'new-id'), updateCustomer: jest.fn(), findByPhone: jest.fn(() => null) }));
jest.mock('expo-contacts', () => ({ Contact: { presentPicker: jest.fn() }, requestPermissionsAsync: jest.fn() }));

const mockData: { profile: CustomerProfile | null } = { profile: null };
jest.mock('@/db/hooks', () => ({ useCustomerProfile: () => mockData.profile }));

const repo = jest.requireMock('@/db/repo/customers') as Record<string, jest.Mock>;
const contacts = jest.requireMock('expo-contacts') as { Contact: { presentPicker: jest.Mock } };

beforeEach(() => {
  jest.clearAllMocks();
  mockData.profile = null;
  repo.findByPhone.mockReturnValue(null);
  repo.createCustomer.mockReturnValue('new-id');
});

it('needs only a name to save, then opens the new profile', async () => {
  await renderScreen(<CustomerFormScreen />);
  await fireEvent.press(screen.getByTestId('customer-save'));
  expect(screen.getByText('Write their name')).toBeTruthy();
  expect(repo.createCustomer).not.toHaveBeenCalled();

  await fireEvent.changeText(screen.getByTestId('customer-name'), 'Rafiq Dar');
  await fireEvent.changeText(screen.getByTestId('customer-phone'), '98765 43210');
  await fireEvent.press(screen.getByTestId('customer-tag-tourist'));
  await fireEvent.press(screen.getByTestId('customer-save'));
  expect(repo.createCustomer).toHaveBeenCalledWith(
    {},
    expect.objectContaining({ name: 'Rafiq Dar', phone: '+919876543210', tag: 'tourist', whatsappOk: true }),
  );
  expect(router.replace).toHaveBeenCalledWith({ pathname: '/customer/[id]', params: { id: 'new-id' } });
});

it('guards duplicates as soon as the number is complete', async () => {
  repo.findByPhone.mockReturnValue(customer({ id: 'c9', name: 'Rafiq Dar' }));
  await renderScreen(<CustomerFormScreen />);
  await fireEvent.changeText(screen.getByTestId('customer-name'), 'Rafiq');
  await fireEvent.changeText(screen.getByTestId('customer-phone'), '9876543210');
  expect(screen.getByText('Already saved as Rafiq Dar.')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('customer-save'));
  expect(repo.createCustomer).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByTestId('customer-open-duplicate'));
  expect(router.replace).toHaveBeenCalledWith({ pathname: '/customer/[id]', params: { id: 'c9' } });
});

it('shows the duplicate inline when the repo catches it on save', async () => {
  repo.createCustomer.mockImplementation(() => {
    throw new DuplicateCustomerError('c7', 'Anita Kaul');
  });
  await renderScreen(<CustomerFormScreen name="Anita" />);
  await fireEvent.press(screen.getByTestId('customer-save'));
  expect(screen.getByText('Already saved as Anita Kaul.')).toBeTruthy();
});

it('returns to the Sell sheet with the new (or existing) customer', async () => {
  await renderScreen(<CustomerFormScreen name="Bilal" phone="+919906011111" returnTo="/sell" />);
  expect(screen.getByDisplayValue('Bilal')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('customer-save'));
  expect(repo.createCustomer).toHaveBeenCalledWith({}, expect.objectContaining({ name: 'Bilal', phone: '+919906011111' }));
  expect(router.dismissTo).toHaveBeenCalledWith({ pathname: '/sell', params: { customerId: 'new-id' } });
});

it('in the Sell flow, a duplicate offers "Use Name"', async () => {
  repo.findByPhone.mockReturnValue(customer({ id: 'c9', name: 'Rafiq Dar' }));
  await renderScreen(<CustomerFormScreen returnTo="/sell" />);
  await fireEvent.changeText(screen.getByTestId('customer-phone'), '9876543210');
  expect(screen.getByLabelText('Use Rafiq Dar')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('customer-open-duplicate'));
  expect(router.dismissTo).toHaveBeenCalledWith({ pathname: '/sell', params: { customerId: 'c9' } });
});

it('fills name and number from contacts', async () => {
  contacts.Contact.presentPicker.mockResolvedValue({
    getFullName: async () => 'Shabnam Bhat',
    getPhones: async () => [{ number: 'n/a' }, { number: '099060 22222' }],
  });
  await renderScreen(<CustomerFormScreen />);
  await fireEvent.press(screen.getByTestId('customer-from-contacts'));
  expect(await screen.findByDisplayValue('Shabnam Bhat')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('customer-save'));
  expect(repo.createCustomer).toHaveBeenCalledWith({}, expect.objectContaining({ name: 'Shabnam Bhat', phone: '+919906022222' }));
});

it('edits an existing customer, including consent and likes', async () => {
  mockData.profile = profile({ customer: customer({ name: 'Anita Kaul', city: 'Srinagar' }), likes: { colours: [], crafts: [] } });
  await renderScreen(<CustomerFormScreen id="c1" />);
  expect(screen.getByText('Edit customer')).toBeTruthy();
  expect(screen.getByDisplayValue('Srinagar')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('customer-consent'));
  await fireEvent.press(screen.getByTestId('customer-likes-colour-maroon'));
  await fireEvent.press(screen.getByTestId('customer-save'));
  expect(repo.updateCustomer).toHaveBeenCalledWith(
    {},
    'c1',
    expect.objectContaining({ name: 'Anita Kaul', whatsappOk: false, likes: { colours: ['maroon'], crafts: [] } }),
  );
  expect(router.back).toHaveBeenCalled();
});
