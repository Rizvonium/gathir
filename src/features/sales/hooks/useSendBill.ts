/** "Send bill" for a sale: renders the PDF, opens WhatsApp, records it, and toasts the result. */
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { db } from '@/db/client';
import { getPdfFontCss, renderPdf } from '@/pdf';
import { shareFileToWhatsApp } from '@/share';
import { playHaptic, useToast } from '@/ui/components';

import { sendBill, type BillOutcome } from '../logic/sendBill';
import { billOutcomeMessage } from '../logic/saleMessages';

const deps = { getPdfFontCss, renderPdf, shareFileToWhatsApp };

export function useSendBill(): { send: (saleId: string) => Promise<BillOutcome | null>; sending: boolean } {
  const { t } = useTranslation('sales');
  const toast = useToast();
  const [sending, setSending] = useState(false);
  const busy = useRef(false);

  const send = async (saleId: string): Promise<BillOutcome | null> => {
    if (busy.current) return null;
    busy.current = true;
    setSending(true);
    try {
      const outcome = await sendBill(db, saleId, deps);
      const msg = billOutcomeMessage(outcome);
      if (msg) {
        if (msg.tone === 'danger') playHaptic('error');
        toast.show({ message: t(msg.key), tone: msg.tone });
      }
      return outcome;
    } finally {
      busy.current = false;
      setSending(false);
    }
  };

  return { send, sending };
}
