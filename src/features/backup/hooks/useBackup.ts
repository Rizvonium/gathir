/**
 * Backup and restore (PLAN §3 Safety, §8). Create → share sheet (Drive / WhatsApp / USB).
 * Restore replaces everything, so it is the one place with a warning sheet (it cannot be undone).
 */
import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { db } from '@/db/client';
import { useDbQuery } from '@/db/hooks';
import { readSettingsRow } from '@/features/settings/settingsData';
import { formatBytes, storageUsage, type StorageUsage } from '@/lib/storage';
import { playHaptic, useToast } from '@/ui/components';

import { scheduleBackupReminder } from '../backupReminder';
import { createBackup, pickAndRestoreBackup, shareBackup } from '../backupService';
import { outcomeToParams, plainCounts } from '../backupView';

export type BackupPhase = 'idle' | 'creating' | 'sharing' | 'restoring';

function readUsage(): StorageUsage | null {
  try {
    return storageUsage();
  } catch {
    return null;
  }
}

export function useBackup() {
  const { t } = useTranslation('backup');
  const toast = useToast();
  const lastBackupAt = useDbQuery((d) => readSettingsRow(d)?.lastBackupAt ?? null, [], { tables: ['shop_settings'] });
  const [phase, setPhase] = useState<BackupPhase>('idle');
  const [warning, setWarning] = useState(false);
  const [usage, setUsage] = useState<StorageUsage | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setUsage(readUsage()), 50);
    return () => clearTimeout(id);
  }, []);

  const create = async () => {
    if (phase !== 'idle') return;
    setPhase('creating');
    let made;
    try {
      made = await createBackup(db);
    } catch {
      setPhase('idle');
      playHaptic('error');
      toast.show({ message: t('errors.createFailed'), tone: 'danger', actionLabel: t('common:actions.retry'), onAction: () => void create() });
      return;
    }
    setPhase('sharing');
    let shared = false;
    try {
      shared = await shareBackup(made.uri, t('create.dialogTitle'));
    } catch {
      shared = false;
    }
    setPhase('idle');
    setUsage(readUsage());
    if (!shared) {
      playHaptic('error');
      toast.show({ message: t('errors.shareUnavailable'), tone: 'danger' });
      return;
    }
    void scheduleBackupReminder({ channelName: t('reminder.channel'), title: t('reminder.title'), body: t('reminder.body') });
    playHaptic('success');
    toast.show({ message: t('create.made', { size: formatBytes(made.sizeBytes) }), tone: 'success' });
  };

  const restore = async () => {
    setWarning(false);
    if (phase !== 'idle') return;
    setPhase('restoring');
    const r = await pickAndRestoreBackup(db);
    setPhase('idle');
    if (r.ok) {
      playHaptic('success');
      router.replace({ pathname: '/backup/result', params: outcomeToParams({ kind: 'ok', counts: plainCounts(r.counts) }) } as unknown as Href);
      return;
    }
    if (r.reason === 'cancelled') {
      toast.show({ message: t('errors.cancelled') });
      return;
    }
    playHaptic('error');
    router.push({ pathname: '/backup/result', params: outcomeToParams({ kind: r.reason }) } as unknown as Href);
  };

  return {
    phase,
    busy: phase !== 'idle',
    lastBackupAt,
    usage,
    warning,
    openWarning: () => setWarning(true),
    closeWarning: () => setWarning(false),
    create: () => void create(),
    /** From the warning sheet: make a backup of this phone first. */
    backupFirst: () => {
      setWarning(false);
      void create();
    },
    restore: () => void restore(),
  };
}
