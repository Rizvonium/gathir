import 'react-native-gesture-handler/jestSetup';

import { fireEvent, screen } from '@testing-library/react-native';
import { useEffect, useState } from 'react';

import { renderWithTheme } from '@/ui/components/__tests__/renderWithTheme';

import { CustomerPickerField } from '../components/CustomerPickerField';
import type { CustomerChoice } from '../logic/sellCart';

jest.mock('react-native-keyboard-controller', () => require('react-native-keyboard-controller/jest'));

const saved = { id: 'c1', name: 'Anita Kaul', phone: '+919906000104' };
const mockFind = jest.fn((e164: string) => (e164 === saved.phone ? saved : null));
jest.mock('../hooks/useCustomerPicker', () => ({
  useCustomerPicker: (q: string) => ({
    results: q ? [{ ...saved, whatsappOk: true, city: '', tag: 'regular', favouriteColour: null, nextFollowUpAt: null, createdAt: 0, lifetimeSpendPaise: 0, purchases: 0, lastVisitAt: null }] : [],
    findSavedByPhone: mockFind,
  }),
}));
const mockPick = jest.fn();
jest.mock('../logic/pickContact', () => ({ pickContact: () => mockPick() }));

let latest: CustomerChoice = { kind: 'walk_in' };
function Harness({ initial = { kind: 'walk_in' } as CustomerChoice }) {
  const [value, setValue] = useState<CustomerChoice>(initial);
  useEffect(() => {
    latest = value;
  }, [value]);
  return <CustomerPickerField value={value} onChange={setValue} />;
}

describe('CustomerPickerField', () => {
  beforeEach(() => {
    latest = { kind: 'walk_in' };
    mockPick.mockReset();
  });

  it('defaults to walk-in and adds a new customer inline', async () => {
    await renderWithTheme(<Harness />);
    expect(screen.getByLabelText('Walk-in')).toBeChecked();
    await fireEvent.press(screen.getByTestId('customer-picker-new'));
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Rafiq Dar');
    await fireEvent.changeText(screen.getByLabelText('WhatsApp number'), '98765 43210');
    expect(latest).toEqual({ kind: 'new', name: 'Rafiq Dar', phone: '+919876543210' });
    await fireEvent.press(screen.getByTestId('customer-picker-walkin'));
    expect(latest).toEqual({ kind: 'walk_in' });
  });

  it('switches to the saved customer when the typed phone is already saved', async () => {
    await renderWithTheme(<Harness />);
    await fireEvent.press(screen.getByTestId('customer-picker-new'));
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Anita');
    await fireEvent.changeText(screen.getByLabelText('WhatsApp number'), '99060 00104');
    expect(latest).toEqual({ kind: 'existing', id: 'c1', name: 'Anita Kaul', phone: '+919906000104' });
    expect(screen.getByText('Already saved as Anita Kaul. This sale will go to them.')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Remove customer'));
    expect(latest).toEqual({ kind: 'walk_in' });
  });

  it('finds a saved customer by search', async () => {
    await renderWithTheme(<Harness />);
    await fireEvent.press(screen.getByTestId('customer-picker-search'));
    await fireEvent.changeText(screen.getByLabelText('Search customers by name or phone'), 'Ani');
    await fireEvent.press(screen.getByLabelText('Choose Anita Kaul'));
    expect(latest).toMatchObject({ kind: 'existing', id: 'c1' });
    expect(screen.getByLabelText('Customer: Anita Kaul')).toBeTruthy();
  });

  it('fills name and phone from phone contacts', async () => {
    mockPick.mockResolvedValueOnce({ status: 'ok', name: 'Bilal Shah', phone: '+919811122233' });
    await renderWithTheme(<Harness />);
    await fireEvent.press(screen.getByTestId('customer-picker-new'));
    await fireEvent.press(screen.getByText('Pick from contacts'));
    expect(latest).toEqual({ kind: 'new', name: 'Bilal Shah', phone: '+919811122233' });
  });

  it('a picked contact that is already saved becomes that customer', async () => {
    mockPick.mockResolvedValueOnce({ status: 'ok', name: 'A. Kaul', phone: saved.phone });
    await renderWithTheme(<Harness />);
    await fireEvent.press(screen.getByTestId('customer-picker-new'));
    await fireEvent.press(screen.getByText('Pick from contacts'));
    expect(latest).toMatchObject({ kind: 'existing', id: 'c1' });
  });

  it('explains when contacts are not allowed', async () => {
    mockPick.mockResolvedValueOnce({ status: 'denied' });
    await renderWithTheme(<Harness />);
    await fireEvent.press(screen.getByTestId('customer-picker-new'));
    await fireEvent.press(screen.getByText('Pick from contacts'));
    expect(screen.getByText('Allow contacts in phone settings to pick a customer from them.')).toBeTruthy();
  });
});
