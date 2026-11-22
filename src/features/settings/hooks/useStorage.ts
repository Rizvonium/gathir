/** Storage used (PLAN §8, §15): measured on open (file reads are sync, so after first paint). */
import { Paths } from 'expo-file-system';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cleanupOldExports } from '@/lib/files';
import { storageUsage, type StorageUsage } from '@/lib/storage';
import { useToast } from '@/ui/components';

import { isStorageLow } from '../settingsLogic';

export type StorageView =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; usage: StorageUsage; totalBytes: number; freeBytes: number | null; phoneBytes: number | null; low: boolean };

function readDisk(): { free: number | null; total: number | null } {
  try {
    return { free: Paths.availableDiskSpace, total: Paths.totalDiskSpace };
  } catch {
    return { free: null, total: null };
  }
}

export function measure(): StorageView {
  try {
    const usage = storageUsage();
    const disk = readDisk();
    return {
      status: 'ready',
      usage,
      totalBytes: usage.photosBytes + usage.dbBytes + usage.exportsBytes,
      freeBytes: disk.free,
      phoneBytes: disk.total,
      low: isStorageLow(disk.free, disk.total),
    };
  } catch {
    return { status: 'error' };
  }
}

export function useStorage() {
  const { t } = useTranslation('settings');
  const toast = useToast();
  const [view, setView] = useState<StorageView>({ status: 'loading' });

  useEffect(() => {
    // Let the screen paint first: measuring walks the photo folder.
    const id = setTimeout(() => setView(measure()), 50);
    return () => clearTimeout(id);
  }, []);

  const clearExports = () => {
    const n = cleanupOldExports(Date.now(), -1);
    toast.show({ message: n > 0 ? t('storage.cleared', { count: n }) : t('storage.nothingToClear') });
    setView(measure());
  };

  return { view, retry: () => setView(measure()), clearExports };
}
