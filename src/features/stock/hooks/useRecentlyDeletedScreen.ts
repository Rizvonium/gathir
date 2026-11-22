/** Recently deleted: purge expired items on open, list the rest, restore with one tap. */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { db } from '@/db/client';
import { useRecentlyDeleted, useToday } from '@/db/hooks';
import { DuplicateCustomerError } from '@/db/repo/errors';
import { restoreCustomer } from '@/db/repo/customers';
import { deletePhotoFiles } from '@/lib/photos';
import { playHaptic, useToast } from '@/ui/components';

import { purgeExpired } from '../logic/purge';
import { errorKeyOf, useStockActions } from './useStockActions';

export function useRecentlyDeletedScreen() {
  const { t } = useTranslation('stock');
  const toast = useToast();
  const actions = useStockActions();
  const today = useToday();
  const { products, customers } = useRecentlyDeleted();
  // Clock for "days left", read once when the screen opens.
  const [now] = useState(() => Date.now());

  useEffect(() => {
    try {
      const { files } = purgeExpired(db);
      deletePhotoFiles(files);
    } catch {
      // Housekeeping only: try again next time the screen opens.
    }
  }, [today]);

  const restoreCustomerRow = (id: string, name: string) => {
    try {
      restoreCustomer(db, id);
      playHaptic('success');
      toast.show({ message: t('deleted.restoredCustomer', { name }), tone: 'success' });
    } catch (e) {
      playHaptic('error');
      const message =
        e instanceof DuplicateCustomerError ? t('deleted.customerClash', { name: e.existingName }) : t(errorKeyOf(e));
      toast.show({ message, tone: 'danger' });
    }
  };

  return { products, customers, now, restoreProduct: actions.restore, restoreCustomer: restoreCustomerRow, empty: products.length === 0 && customers.length === 0 };
}
