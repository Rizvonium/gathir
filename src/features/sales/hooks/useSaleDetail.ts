/** Sale detail controller: the sale, Send bill and Return (cancel). */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { db } from '@/db/client';
import { useSale } from '@/db/hooks';
import type { SaleDetail } from '@/db/repo/saleQueries';
import { cancelSale } from '@/db/repo/saleWrites';
import { playHaptic, useToast } from '@/ui/components';

import { useSendBill } from './useSendBill';

export type SaleDetailActions = {
  sendBill: () => void;
  sending: boolean;
  askReturn: () => void;
  confirmReturn: () => void;
  cancelReturn: () => void;
  returnOpen: boolean;
};

export function useSaleDetail(id: string | undefined): { detail: SaleDetail | null; actions: SaleDetailActions } {
  const { t } = useTranslation('sales');
  const toast = useToast();
  const detail = useSale(id);
  const bill = useSendBill();
  const [returnOpen, setReturnOpen] = useState(false);

  const confirmReturn = () => {
    setReturnOpen(false);
    if (!detail) return;
    const pieces = detail.items.reduce((n, i) => n + i.qty, 0);
    try {
      const done = cancelSale(db, detail.sale.id);
      playHaptic('medium');
      toast.show(done ? { message: t('detail.returnedToast', { count: pieces }), tone: 'success' } : { message: t('detail.alreadyReturned') });
    } catch {
      playHaptic('error');
      toast.show({ message: t('detail.returnFailed'), tone: 'danger' });
    }
  };

  return {
    detail,
    actions: {
      sendBill: () => {
        if (detail) void bill.send(detail.sale.id);
      },
      sending: bill.sending,
      askReturn: () => setReturnOpen(true),
      confirmReturn,
      cancelReturn: () => setReturnOpen(false),
      returnOpen,
    },
  };
}
