/** Builds the real report HTML for the preview (and keeps it for Send to reuse). */
import { useEffect, useState } from 'react';

import { useDbVersion } from '@/db/hooks';

import { prepareOwnerReport } from '../prepare';
import { reportKey, useReportFlow } from '../store';
import { useReportPeriod } from './useReportPeriod';

export type PreviewStatus = 'loading' | 'ready' | 'error';

export function useReportPreview() {
  const p = useReportPeriod();
  const version = useDbVersion();
  const prepared = useReportFlow((s) => s.prepared);
  const set = useReportFlow((s) => s.set);
  const [attempt, setAttempt] = useState(0);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const key = reportKey(p.range, p.includePhones, version, p.includeProfit);
  const ready = prepared?.key === key;

  useEffect(() => {
    if (ready) return;
    let alive = true;
    prepareOwnerReport(p.range, p.includePhones, key, p.now)
      .then((r) => {
        if (alive) set({ prepared: r });
      })
      .catch(() => {
        if (alive) setFailedKey(key);
      });
    return () => {
      alive = false;
    };
    // `key` covers range, phones and data version.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready, attempt]);

  const status: PreviewStatus = ready ? 'ready' : failedKey === key ? 'error' : 'loading';
  return {
    status,
    html: ready ? prepared.html : null,
    summary: p.summary,
    range: p.range,
    period: p,
    retry: () => {
      setFailedKey(null);
      setAttempt((n) => n + 1);
    },
  };
}
