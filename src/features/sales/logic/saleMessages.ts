/** Maps repo errors to i18n keys (sales namespace) and builds the "Sold …" toast text. Pure. */
import type { TFunction } from 'i18next';

import { RepoError } from '@/db/repo/errors';
import { StockError } from '@/db/stock';
import { formatINR } from '@/lib/money';

import type { SellLine } from './sellCart';

export type SellErrorKey = 'sell.errors.insufficient' | 'sell.errors.gone' | 'sell.errors.invalid' | 'sell.errors.customer' | 'sell.errors.generic';

export function sellErrorKey(error: unknown): SellErrorKey {
  if (error instanceof StockError) {
    if (error.code === 'insufficient') return 'sell.errors.insufficient';
    if (error.code === 'not_found') return 'sell.errors.gone';
    return 'sell.errors.invalid';
  }
  if (error instanceof RepoError) {
    if (error.code === 'not_found') return /customer/i.test(error.message) ? 'sell.errors.customer' : 'sell.errors.gone';
    if (error.code === 'invalid') return 'sell.errors.invalid';
  }
  return 'sell.errors.generic';
}

type T = TFunction<'sales'>;

/** "Sold 1 · Sozni stole (Red) · ₹6,500", or "Sold 3 pieces · ₹19,500" for a multi-item sale. */
export function soldMessage(t: T, lines: readonly SellLine[], totalPaise: number): string {
  const amount = formatINR(totalPaise);
  if (lines.length === 1) {
    const l = lines[0];
    return t('sell.toastOne', { qty: l.qty, name: l.productName, colour: l.colourName, amount });
  }
  return t('sell.toastMany', { pieces: lines.reduce((n, l) => n + l.qty, 0), amount });
}

export type BillMessage = { key: string; tone: 'neutral' | 'success' | 'danger' } | null;

/** Toast for a send-bill outcome; null when nothing needs saying (the seller backed out). */
export function billOutcomeMessage(outcome: { status: string; hadPhone: boolean }): BillMessage {
  switch (outcome.status) {
    case 'sent':
      return { key: 'detail.billSent', tone: 'success' };
    case 'fallback_shared':
      return { key: outcome.hadPhone ? 'detail.billShared' : 'detail.billSharedNoPhone', tone: 'neutral' };
    case 'unavailable':
      return { key: 'detail.billUnavailable', tone: 'danger' };
    case 'dismissed':
      return null;
    case 'not_found':
      return { key: 'detail.notFound', tone: 'danger' };
    default:
      return { key: 'detail.billFailed', tone: 'danger' };
  }
}
