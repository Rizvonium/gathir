/** Sample data on/off. Each change is undoable from the toast (no confirm dialog). */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { db } from '@/db/client';
import { useDbQuery } from '@/db/hooks';
import { clearSampleData, hasSampleData, insertSampleData } from '@/db/sampleData';
import { playHaptic, useToast } from '@/ui/components';

export function useSampleData() {
  const { t } = useTranslation('settings');
  const toast = useToast();
  const present = useDbQuery(hasSampleData, []);
  const [busy, setBusy] = useState(false);

  const run = (fn: () => void): boolean => {
    try {
      fn();
      return true;
    } catch {
      playHaptic('error');
      toast.show({ message: t('sample.failed'), tone: 'danger' });
      return false;
    }
  };

  const add = () => {
    if (busy) return;
    setBusy(true);
    const ok = run(() => insertSampleData(db));
    setBusy(false);
    if (!ok) return;
    playHaptic('success');
    toast.show({ message: t('sample.added'), tone: 'success', actionLabel: t('common:actions.undo'), onAction: () => run(() => clearSampleData(db)) });
  };

  const clear = () => {
    if (busy) return;
    setBusy(true);
    let counts = { products: 0, sales: 0, customers: 0 };
    const ok = run(() => {
      counts = clearSampleData(db);
    });
    setBusy(false);
    if (!ok) return;
    playHaptic('medium');
    toast.show({ message: t('sample.cleared', counts), actionLabel: t('common:actions.undo'), onAction: () => run(() => insertSampleData(db)) });
  };

  return { present, busy, add, clear };
}
