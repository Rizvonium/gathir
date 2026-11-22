jest.mock('expo-contacts', () => ({ Contact: { presentPicker: jest.fn() }, requestPermissionsAsync: jest.fn() }));

import { Contact, requestPermissionsAsync } from 'expo-contacts';

import { firstValidPhone, pickContact } from '../logic/pickContact';

const picker = Contact.presentPicker as jest.Mock;
const permission = requestPermissionsAsync as jest.Mock;

function contact(name: string, numbers: (string | undefined)[], failFirst = false) {
  let calls = 0;
  return {
    getFullName: jest.fn(async () => {
      calls += 1;
      if (failFirst && calls === 1) throw new Error('no permission');
      return name;
    }),
    getPhones: jest.fn(async () => numbers.map((n, i) => ({ id: String(i), number: n }))),
  };
}

describe('pickContact', () => {
  beforeEach(() => {
    picker.mockReset();
    permission.mockReset();
  });

  it('takes the first valid phone number as E.164', () => {
    expect(firstValidPhone([undefined, '12', '098765 43210'])).toBe('+919876543210');
    expect(firstValidPhone([])).toBeNull();
  });

  it('returns name and phone, or cancelled', async () => {
    picker.mockResolvedValueOnce(contact(' Anita Kaul ', ['+91 99060 00104']));
    expect(await pickContact()).toEqual({ status: 'ok', name: 'Anita Kaul', phone: '+919906000104' });
    picker.mockResolvedValueOnce(null);
    expect(await pickContact()).toEqual({ status: 'cancelled' });
  });

  it('asks for the contacts permission only when reading the picked contact needs it', async () => {
    picker.mockResolvedValueOnce(contact('Rafiq', ['9876543210'], true));
    permission.mockResolvedValueOnce({ granted: true });
    expect(await pickContact()).toEqual({ status: 'ok', name: 'Rafiq', phone: '+919876543210' });
    picker.mockResolvedValueOnce(contact('Rafiq', [], true));
    permission.mockResolvedValueOnce({ granted: false });
    expect(await pickContact()).toEqual({ status: 'denied' });
    picker.mockRejectedValueOnce(new Error('no activity'));
    expect(await pickContact()).toEqual({ status: 'error' });
  });
});
