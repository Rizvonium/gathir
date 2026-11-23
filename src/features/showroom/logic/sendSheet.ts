/**
 * Who "Send me this" may show (PLAN §4.9: the Showroom is customer-safe). Pure.
 *
 * The phone may be in a customer's hands, so the customer book is never browsable from here:
 * - locked (a PIN is set and not entered in this sheet): only the customer whose full number was
 *   typed, i.e. someone who already knows that number;
 * - unlocked (no PIN, or the seller entered it): name search after 2 letters, as before.
 * Numbers are never shown in full, only their last digits to tell two namesakes apart.
 */
import { toE164 } from '@/lib/phone';

/** Matches shown at most (a short list keeps the sheet calm). */
export const MAX_MATCHES = 5;
/** Characters typed before any saved name is shown (unlocked). */
export const MIN_QUERY = 2;

export function sheetMatches<T extends { phone: string | null }>(rows: readonly T[], query: string, unlocked: boolean): T[] {
  const q = query.trim();
  if (unlocked) return q.length >= MIN_QUERY ? rows.slice(0, MAX_MATCHES) : [];
  const e164 = toE164(q);
  if (!e164) return [];
  return rows.filter((r) => r.phone === e164).slice(0, MAX_MATCHES);
}

/** "•••• 3210": enough to tell two people apart, never the whole number. */
export function maskedPhone(phone: string | null): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return undefined;
  return `•••• ${digits.slice(-4)}`;
}
