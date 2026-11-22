/** /catalogue/card: the 1080×1350 product card for one shawl, sent on WhatsApp. */
import { useState } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { db } from '@/db/client';
import { useDbQuery, useProductDetail, useSettings } from '@/db/hooks';
import { getShopInfo } from '@/db/repo/shopInfo';
import { photoUri } from '@/lib/photos';
import { formatINR } from '@/lib/money';
import { productCardFileBaseName } from '@/pdf';
import { shareFileToWhatsApp, useProductCardCapture, type ProductCardData } from '@/share';
import { playHaptic, useToast } from '@/ui/components';

import { parseStoredForm } from '../logic/options';
import { isDelivered, recipientCustomerId, recipientPhone, shareProblemKey, type Recipient } from '../logic/recipient';
import { recordCardSent } from '../logic/record';

export type CardPhase = { kind: 'choose' } | { kind: 'working'; recipient: Recipient } | { kind: 'done'; recipient: Recipient };

/** WhatsApp caption for a card: name, rate (when shown) and the shop. */
export function cardMessage(t: TFunction<'catalogue'>, data: ProductCardData): string {
  const lines = [data.name.trim()];
  if (data.ratePaise !== null) lines.push(formatINR(data.ratePaise));
  if (data.code) lines.push(t('share.card.code', { code: data.code }));
  lines.push(t('card.messageOutro', { shop: data.shopName.trim() }));
  return lines.join('\n');
}

export function useProductCardSend(productId: string | undefined) {
  const { t } = useTranslation('catalogue');
  const toast = useToast();
  const detail = useProductDetail(productId);
  const settings = useSettings();
  const shop = useDbQuery((d) => getShopInfo(d), []);
  const [phase, setPhase] = useState<CardPhase>({ kind: 'choose' });

  const showRates = parseStoredForm(settings?.catalogueOptionsJson).showRates;
  const cover = detail?.photos[0];
  const data: ProductCardData = {
    seedKey: detail?.product.id ?? productId ?? 'card',
    name: detail?.product.name ?? '',
    craft: detail?.product.craft ?? '',
    material: detail?.product.material ?? '',
    ratePaise: detail && showRates && detail.product.ratePaise > 0 ? detail.product.ratePaise : null,
    shopName: shop.shopName,
    code: detail?.product.code,
    photoUri: cover ? photoUri(cover.fileName) : null,
  };
  const card = useProductCardCapture(data);

  const send = async (recipient: Recipient) => {
    if (!detail || phase.kind === 'working') return;
    setPhase({ kind: 'working', recipient });
    let uri: string;
    try {
      uri = await card.capture();
    } catch {
      playHaptic('error');
      toast.show({ message: t('card.captureFailed'), tone: 'danger' });
      setPhase({ kind: 'choose' });
      return;
    }
    const result = await shareFileToWhatsApp({
      fileUri: uri,
      mimeType: 'image/jpeg',
      phoneE164: recipientPhone(recipient),
      message: cardMessage(t, data),
      filename: `${productCardFileBaseName(data.name, shop.shopName)}.jpg`,
      dialogTitle: t('send.dialogTitle'),
    });
    if (!isDelivered(result.status)) {
      const key = shareProblemKey(result.status);
      if (key) toast.show({ message: t(key), tone: result.status === 'dismissed' ? 'neutral' : 'danger' });
      setPhase({ kind: 'choose' });
      return;
    }
    if (result.status === 'fallback_shared') toast.show({ message: t('send.fallback') });
    try {
      recordCardSent(db, recipientCustomerId(recipient), detail.product.id);
    } catch {
      // Logged best-effort; the card was sent.
    }
    playHaptic('success');
    setPhase({ kind: 'done', recipient });
  };

  return { detail, data, cardNode: card.node, phase, send, again: () => setPhase({ kind: 'choose' }) };
}
