/** Sent owner reports and re-sharing their PDF (kept for 24 h in the exports cache). */
import { File } from 'expo-file-system';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { db } from '@/db/client';
import { useReports } from '@/db/hooks';
import { getSettings } from '@/db/repo/settings';
import { exportsDir } from '@/lib/files';
import { shareFileToWhatsApp } from '@/share';
import { playHaptic, useToast } from '@/ui/components';

import { sentReports, type HistoryRow } from '../history';

function fileFor(row: HistoryRow): File | null {
  if (!row.fileName) return null;
  try {
    const f = new File(exportsDir(), row.fileName);
    return f.exists ? f : null;
  } catch {
    return null;
  }
}

export function useReportHistory() {
  const { t } = useTranslation('report');
  const toast = useToast();
  const rows = sentReports(useReports('owner'));
  const [busyId, setBusyId] = useState<string | null>(null);

  const reshare = async (row: HistoryRow) => {
    const file = fileFor(row);
    if (!file) return;
    setBusyId(row.id);
    const owner = getSettings(db).ownerWhatsapp;
    const r = await shareFileToWhatsApp({
      fileUri: file.uri,
      mimeType: 'application/pdf',
      phoneE164: owner || null,
      message: t('history.reshareMessage', { number: row.number }),
      dialogTitle: t('send.dialogTitle'),
      filename: row.fileName ?? undefined,
    });
    setBusyId(null);
    if (r.status === 'unavailable' || r.status === 'error') {
      playHaptic('error');
      toast.show({ message: t('send.failed'), tone: 'danger' });
    }
  };

  /** The PDF was cleared after 24 h: open the report screen on the same dates to make it again. */
  const makeAgain = (row: HistoryRow) => {
    if (row.from === null || row.to === null) return;
    router.push({ pathname: '/report', params: { from: String(row.from), to: String(row.to) } } as never);
  };

  return { rows, busyId, hasFile: (row: HistoryRow) => fileFor(row) !== null, reshare: (row: HistoryRow) => void reshare(row), makeAgain };
}
