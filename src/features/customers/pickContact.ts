/**
 * "Pick from contacts": the system contact picker (expo-contacts `Contact.presentPicker`, which
 * needs no permission to open). Contacts permission is requested only if reading the picked
 * contact fails, i.e. only after the seller tapped. Never throws.
 */
import { Contact, requestPermissionsAsync } from 'expo-contacts';

import { toE164 } from '@/lib/phone';

export type PickedContact =
  | { status: 'ok'; name: string; phone: string | null }
  | { status: 'cancelled' }
  | { status: 'denied' }
  | { status: 'error' };

/** First number that parses (E.164, +91 default), else null. Pure. */
export function firstValidPhone(numbers: readonly (string | null | undefined)[]): string | null {
  for (const n of numbers) {
    const e164 = n ? toE164(n) : null;
    if (e164) return e164;
  }
  return null;
}

async function read(contact: Contact): Promise<{ name: string; phone: string | null }> {
  const [name, phones] = await Promise.all([contact.getFullName(), contact.getPhones()]);
  return { name: (name ?? '').trim(), phone: firstValidPhone(phones.map((p) => p.number)) };
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
    return { status: 'ok', ...(await read(contact)) };
  } catch {
    try {
      const permission = await requestPermissionsAsync();
      if (!permission.granted) return { status: 'denied' };
      return { status: 'ok', ...(await read(contact)) };
    } catch {
      return { status: 'error' };
    }
  }
}
