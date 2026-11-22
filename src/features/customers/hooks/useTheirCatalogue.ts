/**
 * Writes for a customer's personal catalogue, each with an Undo toast instead of a confirm dialog.
 * Reads are live (useCustomerCatalogue / useCatalogueVersions), so the list updates after every write.
 */
import { useTranslation } from 'react-i18next';

import { db } from '@/db/client';
import {
  addToCustomerCatalogue,
  removeFromCustomerCatalogue,
  reorderCustomerCatalogue,
  restoreCustomerCatalogueItem,
  updateCatalogueItem,
} from '@/db/repo/customerCatalogue';
import { playHaptic, useToast } from '@/ui/components';

import { moveItem } from '../logic/theirCatalogue';

export function useTheirCatalogueActions(customerId: string | undefined, customerName: string) {
  const { t } = useTranslation('customers');
  const toast = useToast();

  const fail = () => {
    playHaptic('error');
    toast.show({ message: t('theirCatalogue.failed'), tone: 'danger' });
  };

  /** Adds designs at the end of their catalogue. Undo takes out only the ones this call added. */
  const add = (productIds: readonly string[], already: ReadonlySet<string> = new Set()): boolean => {
    if (!customerId || productIds.length === 0) return false;
    const added: string[] = [];
    try {
      db.transaction((tx) => {
        for (const pid of productIds) {
          const itemId = addToCustomerCatalogue(tx, { customerId, productId: pid });
          if (!already.has(pid)) added.push(itemId);
        }
      });
    } catch {
      fail();
      return false;
    }
    playHaptic('success');
    toast.show({
      message: t('theirCatalogue.added', { count: productIds.length, name: customerName }),
      tone: 'success',
      ...(added.length > 0
        ? {
            actionLabel: t('common:actions.undo'),
            onAction: () => {
              try {
                for (const id of added) removeFromCustomerCatalogue(db, id);
              } catch {
                fail();
              }
            },
          }
        : {}),
    });
    return true;
  };

  const remove = (itemId: string, name: string) => {
    try {
      if (!removeFromCustomerCatalogue(db, itemId)) return;
    } catch {
      fail();
      return;
    }
    playHaptic('medium');
    toast.show({
      message: t('theirCatalogue.removed', { name }),
      actionLabel: t('common:actions.undo'),
      onAction: () => {
        try {
          if (!restoreCustomerCatalogueItem(db, itemId)) toast.show({ message: t('theirCatalogue.alreadyBack', { name }) });
        } catch {
          fail();
        }
      },
    });
  };

  /** Saves the special rate (null = normal rate) and note. Undo puts the old values back. */
  const save = (itemId: string, patch: { specialRatePaise: number | null; note: string }, before: { specialRatePaise: number | null; note: string }): boolean => {
    try {
      updateCatalogueItem(db, itemId, patch);
    } catch {
      fail();
      return false;
    }
    playHaptic('success');
    toast.show({
      message: t('theirCatalogue.saved'),
      tone: 'success',
      actionLabel: t('common:actions.undo'),
      onAction: () => {
        try {
          updateCatalogueItem(db, itemId, before);
        } catch {
          fail();
        }
      },
    });
    return true;
  };

  /** Moves one item up or down; returns the new order (for TalkBack announcements). */
  const move = (orderedIds: readonly string[], itemId: string, dir: -1 | 1): string[] => {
    const next = moveItem(orderedIds, itemId, dir);
    if (!customerId || next.join() === orderedIds.join()) return next;
    try {
      reorderCustomerCatalogue(db, customerId, next);
      playHaptic('selection');
    } catch {
      fail();
    }
    return next;
  };

  return { add, remove, save, move };
}
