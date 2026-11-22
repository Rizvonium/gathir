/** Everything the Home tab shows and does. The screen only lays it out. */
import { useTranslation } from 'react-i18next';

import { db } from '@/db/client';
import { useDbQuery, useHomeSummary, useLowStockLevel, useToday } from '@/db/hooks';
import type { DueFollowUp } from '@/db/repo/events';
import { clearSampleData, insertSampleData } from '@/db/sampleData';
import { finishFollowUp, undoFinishFollowUp, type ReminderTexts } from '@/features/customers/followUpNotifications';
import { openWhatsAppChat } from '@/share/whatsapp';
import { playHaptic, useToast } from '@/ui/components';

import { readHomeExtras } from './homeData';
import { buildHomeModel, type HomeModel } from './homeLogic';

export type { HomeModel } from './homeLogic';

export type HomeActions = {
  clearSample: () => void;
  trySample: () => void;
  completeFollowUp: (f: DueFollowUp) => void;
  messageFollowUp: (f: DueFollowUp) => void;
};

export function useHome(): { model: HomeModel; actions: HomeActions } {
  const { t } = useTranslation('home');
  const { t: tc } = useTranslation('customers');
  const toast = useToast();
  const summary = useHomeSummary();
  const lowStockLevel = useLowStockLevel();
  // Re-read at midnight / after any write so the greeting and "days ago" stay right.
  const today = useToday();
  const { now, ...extras } = useDbQuery((d) => ({ ...readHomeExtras(d), now: Date.now() }), [today]);
  const model = buildHomeModel(summary, extras, lowStockLevel, now);

  const fail = () => {
    playHaptic('error');
    toast.show({ message: t('errors.generic'), tone: 'danger' });
  };

  const actions: HomeActions = {
    clearSample: () => {
      try {
        clearSampleData(db);
        playHaptic('medium');
        toast.show({ message: t('sample.cleared'), tone: 'success' });
      } catch {
        fail();
      }
    },
    trySample: () => {
      try {
        insertSampleData(db);
        playHaptic('success');
      } catch {
        fail();
      }
    },
    completeFollowUp: (f) => {
      // finishFollowUp marks it done, clears the stored reminder id and cancels the notification;
      // Undo reopens it and re-arms the reminder when it is still ahead.
      const texts: ReminderTexts = {
        channelName: tc('followUp.channelName'),
        title: tc('followUp.notifyTitle', { name: f.customerName }),
        body: f.note.trim() || tc('followUp.notifyBody', { name: f.customerName }),
      };
      finishFollowUp(db, f.eventId).then(
        () => {
          playHaptic('light');
          toast.show({
            message: t('followUps.doneToast'),
            actionLabel: t('common:actions.undo'),
            onAction: () => {
              undoFinishFollowUp(db, { eventId: f.eventId, customerId: f.customerId, dueAt: f.dueAt, texts }).catch(fail);
            },
          });
        },
        fail,
      );
    },
    messageFollowUp: (f) => {
      void openWhatsAppChat(f.phone, t('followUps.message', { name: f.customerName })).then((ok) => {
        if (!ok) toast.show({ message: t('followUps.whatsappFailed'), tone: 'danger' });
      });
    },
  };

  return { model, actions };
}
