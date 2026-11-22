/**
 * Customer profile: live data plus every write the screen makes (likes, notes, follow-ups,
 * delete/restore), each with an Undo toast instead of a confirm dialog.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { db } from '@/db/client';
import { useCatalogueVersions, useCustomerCatalogue, useCustomerProfile, useDbQuery, useLowStockLevel, useSuggestedProducts } from '@/db/hooks';
import { restoreCustomer, softDeleteCustomer, updateCustomer } from '@/db/repo/customers';
import { DuplicateCustomerError } from '@/db/repo/errors';
import { addNote, deleteEvent, setFollowUpNotification } from '@/db/repo/events';
import { getProductDetail } from '@/db/repo/products';
import type { CustomerEvent, CustomerLikes } from '@/db/schema';
import { formatDay } from '@/lib/dates';
import { playHaptic, useToast } from '@/ui/components';

import {
  cancelFollowUpNotification,
  createFollowUp,
  finishFollowUp,
  removeFollowUp,
  scheduleFollowUpNotification,
  undoFinishFollowUp,
  type ReminderTexts,
} from '../followUpNotifications';
import { acceptSuggestion, learnedSuggestion, suggestionKey, type LikesSuggestion } from '../logic/customerLogic';
import { referencedProductIds, timelineRows } from '../logic/timeline';
import { useTheirCatalogueActions } from './useTheirCatalogue';

export function useCustomerProfileScreen(id: string | undefined) {
  const { t } = useTranslation('customers');
  const toast = useToast();
  const profile = useCustomerProfile(id);
  const suggestions = useSuggestedProducts(id, 12);
  const [dismissedSuggestion, setDismissedSuggestion] = useState<string | null>(null);
  const catalogueRows = useCustomerCatalogue(id);
  const catalogueVersions = useCatalogueVersions(id);
  const lowStockLevel = useLowStockLevel();

  const rows = profile ? timelineRows(profile.timeline) : [];
  const refIds = referencedProductIds(rows).join(',');
  const productNames = useDbQuery(
    (d) => {
      const names: Record<string, string> = {};
      for (const pid of refIds ? refIds.split(',') : []) {
        const p = getProductDetail(d, pid);
        if (p) names[pid] = p.product.name;
      }
      return names;
    },
    [refIds],
  );

  const name = profile?.customer.name ?? '';
  const catalogue = useTheirCatalogueActions(id, name);
  const inCatalogue = new Set(catalogueRows.map((r) => r.productId));
  const fail = (e?: unknown) => {
    playHaptic('error');
    if (e instanceof DuplicateCustomerError) toast.show({ message: t('profile.restoreClash', { name: e.existingName }), tone: 'danger' });
    else toast.show({ message: t('common:errors.generic'), tone: 'danger' });
  };

  const reminderTexts = (note: string): ReminderTexts => ({
    channelName: t('followUp.channelName'),
    title: t('followUp.notifyTitle', { name }),
    body: note.trim() || t('followUp.notifyBody', { name }),
  });

  const suggestion: LikesSuggestion | null = profile ? learnedSuggestion(profile.likes, profile.learnedLikes) : null;
  const visibleSuggestion = suggestion && suggestionKey(suggestion) !== dismissedSuggestion ? suggestion : null;

  const saveLikes = (likes: CustomerLikes): boolean => {
    if (!id) return false;
    try {
      updateCustomer(db, id, { likes });
      return true;
    } catch (e) {
      fail(e);
      return false;
    }
  };

  const acceptLearned = () => {
    if (!profile || !suggestion) return;
    const before = profile.likes;
    if (!saveLikes(acceptSuggestion(before, suggestion))) return;
    playHaptic('success');
    toast.show({ message: t('learned.added'), actionLabel: t('common:actions.undo'), onAction: () => saveLikes(before), tone: 'success' });
  };

  const dismissLearned = () => {
    if (suggestion) setDismissedSuggestion(suggestionKey(suggestion));
  };

  const saveNote = (text: string): boolean => {
    if (!id || !text.trim()) return false;
    try {
      const eventId = addNote(db, id, text.trim());
      toast.show({ message: t('timeline.noteSaved'), actionLabel: t('common:actions.undo'), onAction: () => deleteEvent(db, eventId) });
      return true;
    } catch (e) {
      fail(e);
      return false;
    }
  };

  const setFollowUp = async (dueAt: number, note: string) => {
    if (!id) return;
    const pending = createFollowUp(db, { customerId: id, dueAt, note: note.trim(), texts: reminderTexts(note) });
    let result: Awaited<typeof pending>;
    try {
      result = await pending;
    } catch (e) {
      fail(e);
      return;
    }
    const date = formatDay(dueAt);
    const message =
      result.status === 'scheduled'
        ? t('followUp.scheduled', { date })
        : result.status === 'denied'
          ? t('followUp.savedNoNotify', { date })
          : t('followUp.savedSoon', { date });
    playHaptic('success');
    toast.show({
      message,
      actionLabel: t('common:actions.undo'),
      onAction: () => void removeFollowUp(db, result.eventId, result.notificationId),
    });
  };

  const markDone = async (event: CustomerEvent) => {
    try {
      await finishFollowUp(db, event.id);
    } catch (e) {
      fail(e);
      return;
    }
    playHaptic('success');
    toast.show({
      message: t('followUp.markedDone'),
      actionLabel: t('common:actions.undo'),
      onAction: () =>
        void undoFinishFollowUp(db, {
          eventId: event.id,
          customerId: event.customerId,
          dueAt: event.dueAt ?? Date.now(),
          texts: reminderTexts(event.note),
        }),
    });
  };

  /** Reminders stop while the customer sits in Recently deleted; Undo/restore schedules them again. */
  const rescheduleOpen = async (events: CustomerEvent[]) => {
    for (const e of events) {
      if (e.dueAt === null) continue;
      const res = await scheduleFollowUpNotification({ eventId: e.id, customerId: e.customerId, dueAt: e.dueAt, texts: reminderTexts(e.note) });
      if (res.notificationId) setFollowUpNotification(db, e.id, res.notificationId);
    }
  };

  const restore = (): boolean => {
    if (!id || !profile) return false;
    try {
      restoreCustomer(db, id);
    } catch (e) {
      fail(e);
      return false;
    }
    void rescheduleOpen(profile.openFollowUps);
    return true;
  };

  const deleteCustomer = () => {
    if (!id || !profile) return;
    const open = profile.openFollowUps;
    try {
      softDeleteCustomer(db, id);
    } catch (e) {
      fail(e);
      return;
    }
    for (const e of open) {
      void cancelFollowUpNotification(e.notificationId);
      setFollowUpNotification(db, e.id, null);
    }
    playHaptic('medium');
    if (router.canGoBack()) router.back();
    toast.show({
      message: t('profile.deleted', { name }),
      actionLabel: t('common:actions.undo'),
      onAction: () => {
        if (restore()) toast.show({ message: t('profile.restored', { name }), tone: 'success' });
      },
    });
  };

  const restoreHere = () => {
    if (restore()) {
      playHaptic('success');
      toast.show({ message: t('profile.restored', { name }), tone: 'success' });
    }
  };

  return {
    profile,
    rows,
    productNames,
    suggestions,
    suggestion: visibleSuggestion,
    saveLikes,
    acceptLearned,
    dismissLearned,
    saveNote,
    setFollowUp,
    markDone,
    deleteCustomer,
    restore: restoreHere,
    catalogueRows,
    catalogueVersions,
    lowStockLevel,
    inCatalogue,
    catalogue,
    addSuggestedToCatalogue: (productId: string) => catalogue.add([productId], inCatalogue),
  };
}
