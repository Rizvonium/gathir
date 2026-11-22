/**
 * Step 4 "Send": makes the PDF for the chosen person ("Prepared for …"), opens WhatsApp, and on
 * return records the send (report list + customer timeline). Large catalogues go part by part.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { db } from '@/db/client';
import { useDbQuery } from '@/db/hooks';
import { getShopInfo } from '@/db/repo/shopInfo';
import { catalogueFileBaseName, catalogueMessage, renderCatalogueHtml, renderPdf } from '@/pdf';
import { shareFileToWhatsApp } from '@/share';
import { playHaptic, useToast } from '@/ui/components';

import { isPersonalData, sentSnapshot } from '../logic/flowData';
import { catalogueParts, partProductIds } from '../logic/parts';
import { isDelivered, recipientCustomerId, recipientName, recipientPhone, shareProblemKey, type Recipient } from '../logic/recipient';
import { recordCatalogueSent } from '../logic/record';
import { useLoadedForm } from './useCatalogueOptions';
import { usePrepared } from './useCataloguePreview';

export type SendPhase =
  | { kind: 'choose' }
  | { kind: 'working'; step: 'making' | 'opening'; recipient: Recipient }
  | { kind: 'done'; recipient: Recipient; partsSent: number; totalParts: number };

export function useCatalogueSend() {
  const { t } = useTranslation('catalogue');
  const toast = useToast();
  const { prepared, status, retry } = usePrepared();
  const form = useLoadedForm();
  const shop = useDbQuery((d) => getShopInfo(d), []);
  const [phase, setPhase] = useState<SendPhase>({ kind: 'choose' });
  const [now] = useState(() => Date.now());

  const sendPart = async (recipient: Recipient, partIndex: number) => {
    if (!prepared || !form || phase.kind === 'working') return;
    const docs = catalogueParts(
      prepared.data,
      form,
      { customerName: recipientName(recipient), fontCss: prepared.fontCss, now, fallbackTitle: prepared.fallbackTitle },
      prepared.photos,
    );
    const doc = docs[partIndex];
    if (!doc) return;
    setPhase({ kind: 'working', step: 'making', recipient });

    let pdf: { uri: string };
    const fileBaseName = catalogueFileBaseName(shop.shopName, now, doc.part);
    try {
      pdf = await renderPdf(renderCatalogueHtml(doc), { fileBaseName });
    } catch {
      playHaptic('error');
      toast.show({ message: t('send.pdfFailed'), tone: 'danger' });
      setPhase(partIndex === 0 ? { kind: 'choose' } : { kind: 'done', recipient, partsSent: partIndex, totalParts: docs.length });
      return;
    }

    setPhase({ kind: 'working', step: 'opening', recipient });
    const result = await shareFileToWhatsApp({
      fileUri: pdf.uri,
      mimeType: 'application/pdf',
      phoneE164: recipientPhone(recipient),
      message: catalogueMessage(doc),
      filename: `${fileBaseName}.pdf`,
      dialogTitle: t('send.dialogTitle'),
    });

    if (!isDelivered(result.status)) {
      const key = shareProblemKey(result.status);
      if (key) toast.show({ message: t(key), tone: result.status === 'dismissed' ? 'neutral' : 'danger' });
      setPhase(partIndex === 0 ? { kind: 'choose' } : { kind: 'done', recipient, partsSent: partIndex, totalParts: docs.length });
      return;
    }

    if (result.status === 'fallback_shared') toast.show({ message: t('send.fallback') });
    if (partIndex === 0) {
      try {
        const sentIds = partProductIds(docs);
        recordCatalogueSent(db, {
          customerId: recipientCustomerId(recipient),
          productIds: sentIds,
          snapshot: { items: sentSnapshot(prepared.data, sentIds), personal: isPersonalData(prepared.data) },
          fileName: `${fileBaseName}.pdf`,
          title: doc.title,
          parts: docs.length,
        });
      } catch {
        // The catalogue went out; a failed log line must not undo that.
      }
    }
    playHaptic('success');
    setPhase({ kind: 'done', recipient, partsSent: partIndex + 1, totalParts: docs.length });
  };

  return {
    status,
    retry,
    phase,
    send: (recipient: Recipient) => sendPart(recipient, 0),
    sendNextPart: () => {
      if (phase.kind === 'done' && phase.partsSent < phase.totalParts) void sendPart(phase.recipient, phase.partsSent);
    },
    sendAnother: () => setPhase({ kind: 'choose' }),
  };
}
