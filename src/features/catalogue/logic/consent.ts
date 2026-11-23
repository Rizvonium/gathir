/**
 * "OK to send catalogues" (PLAN §15 DPDP): a customer who said no is never sent a catalogue or
 * a photo card in one tap. The seller sees why and must choose "Send anyway". Bills are not
 * marketing and are not gated. Pure.
 */
import type { Recipient } from './recipient';

/** True when sending to this customer needs the explicit "Send anyway". Unknown counts as OK. */
export function needsConsentCheck(c: { whatsappOk?: boolean | null } | null | undefined): boolean {
  return c?.whatsappOk === false;
}

export type ConsentAware = Extract<Recipient, { kind: 'customer' }> & { whatsappOk?: boolean | null };

/** Strips the consent flag so the send code gets a plain Recipient. */
export function toRecipient(c: ConsentAware): Recipient {
  return { kind: 'customer', id: c.id, name: c.name, phone: c.phone };
}
