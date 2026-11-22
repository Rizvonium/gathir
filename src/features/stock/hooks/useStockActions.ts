/**
 * Stock writes used by the list and detail screens: delete with Undo, restock, reduce with a
 * reason, and friendly messages for repository errors. Screens call these; they never call
 * repos directly.
 */
import { useTranslation } from 'react-i18next';

import { db } from '@/db/client';
import { RepoError } from '@/db/repo/errors';
import { restoreProduct, softDeleteProduct, updateProduct } from '@/db/repo/products';
import { adjustStock, recordReduction, recordRestock, StockError, type ReductionReason } from '@/db/stock';
import { playHaptic, useToast } from '@/ui/components';

/** i18n key (stock namespace) for an error thrown by a repo or stock write. */
export function errorKeyOf(e: unknown): string {
  if (e instanceof StockError) {
    if (e.code === 'insufficient') return 'errors.insufficient';
    if (e.code === 'not_found') return 'errors.notFound';
    return 'errors.invalid';
  }
  if (e instanceof RepoError) {
    if (e.code === 'not_found') return 'errors.notFound';
    if (e.code === 'duplicate') return 'errors.duplicate';
    if (e.code === 'invalid') return 'errors.invalid';
  }
  return 'errors.generic';
}

export function useStockActions() {
  const { t } = useTranslation('stock');
  const toast = useToast();

  const fail = (e: unknown) => {
    playHaptic('error');
    toast.show({ message: t(errorKeyOf(e)), tone: 'danger' });
  };

  /** Soft delete + Undo toast. Returns false when the write failed. */
  const deleteProducts = (items: { id: string; name: string }[]): boolean => {
    if (items.length === 0) return false;
    const now = Date.now();
    try {
      db.transaction((tx) => {
        for (const item of items) softDeleteProduct(tx, item.id, now);
      });
    } catch (e) {
      fail(e);
      return false;
    }
    playHaptic('medium');
    toast.show({
      message: items.length === 1 ? t('toast.deleted', { name: items[0].name }) : t('toast.deletedMany', { count: items.length }),
      actionLabel: t('common:actions.undo'),
      onAction: () => {
        try {
          db.transaction((tx) => {
            for (const item of items) restoreProduct(tx, item.id);
          });
        } catch (e) {
          fail(e);
        }
      },
    });
    return true;
  };

  const restore = (id: string, name: string): boolean => {
    try {
      restoreProduct(db, id);
      playHaptic('success');
      toast.show({ message: t('toast.restored', { name }), tone: 'success' });
      return true;
    } catch (e) {
      fail(e);
      return false;
    }
  };

  /** "+" stepper: adds pieces as a restock. */
  const restock = (colourId: string, qty: number): boolean => {
    if (qty <= 0) return false;
    try {
      recordRestock(db, colourId, qty);
      return true;
    } catch (e) {
      fail(e);
      return false;
    }
  };

  /**
   * "−" with a reason. Undo writes the opposite correction (history stays honest: both
   * moves are visible).
   */
  const reduce = (colourId: string, qty: number, reason: ReductionReason): boolean => {
    try {
      recordReduction(db, colourId, qty, reason);
    } catch (e) {
      fail(e);
      return false;
    }
    playHaptic('light');
    toast.show({
      message: t('toast.reduced', { count: qty, reason: t(`reason.${reason}`) }),
      actionLabel: t('common:actions.undo'),
      onAction: () => {
        try {
          adjustStock(db, { colourId, delta: qty, reason: 'correction', note: '' });
        } catch (e) {
          fail(e);
        }
      },
    });
    return true;
  };

  /** Moves products to a category (null = none). */
  const setCategory = (ids: string[], categoryId: string | null, categoryName: string): boolean => {
    try {
      db.transaction((tx) => {
        for (const id of ids) updateProduct(tx, id, { categoryId });
      });
      toast.show({ message: t('select.movedTo', { count: ids.length, category: categoryName }), tone: 'success' });
      return true;
    } catch (e) {
      fail(e);
      return false;
    }
  };

  return { deleteProducts, restore, restock, reduce, setCategory, fail };
}
