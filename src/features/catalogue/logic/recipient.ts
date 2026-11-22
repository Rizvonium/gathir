/** Who a catalogue or card goes to, and how a share result is explained. Pure. */
import type { ShareStatus } from '@/share/whatsapp';

export type Recipient =
  | { kind: 'customer'; id: string; name: string; phone: string | null }
  | { kind: 'number'; phone: string }
  | { kind: 'chat' };

export function recipientPhone(r: Recipient): string | null {
  return r.kind === 'customer' ? r.phone : r.kind === 'number' ? r.phone : null;
}

/** Name printed as "Prepared for …" and used in the greeting; null when unknown. */
export function recipientName(r: Recipient): string | null {
  return r.kind === 'customer' ? r.name : null;
}

export function recipientCustomerId(r: Recipient): string | null {
  return r.kind === 'customer' ? r.id : null;
}

/** 'sent' and 'fallback_shared' both mean the file left the app. */
export function isDelivered(status: ShareStatus): boolean {
  return status === 'sent' || status === 'fallback_shared';
}

/** i18n key (catalogue namespace) for a share that did not go out. */
export function shareProblemKey(status: ShareStatus): 'send.dismissed' | 'send.unavailable' | 'send.failed' | null {
  if (status === 'dismissed') return 'send.dismissed';
  if (status === 'unavailable') return 'send.unavailable';
  if (status === 'error') return 'send.failed';
  return null;
}
