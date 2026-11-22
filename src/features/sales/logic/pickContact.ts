/**
 * "Pick from contacts": opens the system contact picker (expo-contacts `Contact.presentPicker`)
 * and returns the name and the first usable phone number. Never throws.
 */
import { Contact, requestPermissionsAsync } from 'expo-contacts';

import { toE164 } from '@/lib/phone';

export type PickedContact =
  | { status: 'ok'; name: string; phone: string | null }
  | { status: 'cancelled' }
  | { status: 'denied' }
  | { status: 'error' };

/** First phone that parses as a number (E.164), else null. Pure. */
export function firstValidPhone(numbers: readonly (string | undefined)[]): string | null {
  for (const n of numbers) {
    const e164 = n ? toE164(n) : null;
    if (e164) return e164;
  }
  return null;
}

async function readContact(contact: Contact): Promise<{ name: string; phone: string | null }> {
  const [name, phones] = await Promise.all([contact.getFullName(), contact.getPhones()]);
  return { name: name.trim(), phone: firstValidPhone(phones.map((p) => p.number)) };
}

export async function pickContact(): Promise<PickedContact> {
  let contact: Contact | null;
  try {
    contact = await Contact.presentPicker();
  } catch {
    return { status: 'error' };
  }
  if (!contact) return { status: 'cancelled' };
  try {
    return { status: 'ok', ...(await readContact(contact)) };
  } catch {
    // Some Android versions only let us read the picked contact with the contacts permission.
    try {
      const permission = await requestPermissionsAsync();
      if (!permission.granted) return { status: 'denied' };
      return { status: 'ok', ...(await readContact(contact)) };
    } catch {
      return { status: 'error' };
    }
  }
}
