/**
 * Starts the report flow fresh for each visit to /report: "Since last report", or the dates
 * "Make again" brought from history. A new visit (`visit` changes, e.g. history went back to the
 * open screen with new dates) starts it again; nothing else does.
 */
import { useEffect } from 'react';

import { startOfDay } from '@/lib/dates';

import { useReportFlow } from '../store';

export function useReportVisit(initialFrom: number | undefined, initialTo: number | undefined, visit: string | undefined): void {
  const reset = useReportFlow((s) => s.reset);
  useEffect(() => {
    reset(Date.now());
    if (initialFrom !== undefined && initialTo !== undefined) {
      useReportFlow.getState().set({ kind: 'custom', customFrom: startOfDay(initialFrom), customTo: startOfDay(initialTo) });
    }
  }, [reset, initialFrom, initialTo, visit]);
}
