/** Settings → App lock: status, fingerprint availability, remove PIN (after the PIN is entered). */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { db } from '@/db/client';
import { useDbQuery } from '@/db/hooks';
import { updateSettings } from '@/db/repo/settings';
import { playHaptic, useToast } from '@/ui/components';

import { readPinFlag } from './pinFlag';
import { canUseFingerprint, clearPin } from './pinStore';

export function useAppLockSettings() {
  const { t } = useTranslation('settings');
  const toast = useToast();
  const pinSet = useDbQuery(readPinFlag, [], { tables: ['shop_settings'] });
  const [fingerprint, setFingerprint] = useState(false);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    let alive = true;
    void canUseFingerprint().then((v) => {
      if (alive) setFingerprint(v);
    });
    return () => {
      alive = false;
    };
  }, []);

  /** Called once the current PIN was entered correctly. */
  const confirmRemove = async () => {
    try {
      await clearPin();
      updateSettings(db, { pinHashSet: false });
      playHaptic('success');
      toast.show({ message: t('lock.removed') });
    } catch {
      playHaptic('error');
      toast.show({ message: t('lock.removeFailed'), tone: 'danger' });
    }
    setRemoving(false);
  };

  return {
    pinSet,
    fingerprint,
    removing,
    startRemove: () => setRemoving(true),
    cancelRemove: () => setRemoving(false),
    confirmRemove: () => void confirmRemove(),
  };
}
