/** Period, options and the live summary for /report (the screen only lays it out). */
import { db } from '@/db/client';
import { useDbQuery } from '@/db/hooks';
import { updateSettings } from '@/db/repo/settings';

import { pickCustomDay, resolvePeriod, type PeriodKind, type Range } from '../period';
import { readRangeSummary, readReportBasics } from '../reportData';
import { useReportFlow } from '../store';

export type ReportPeriod = ReturnType<typeof useReportPeriod>;

export function useReportPeriod() {
  const flow = useReportFlow();
  const now = flow.openedAt;
  const basics = useDbQuery((d) => readReportBasics(d, now), [now]);
  const range: Range = resolvePeriod({ kind: flow.kind, now, sinceLast: basics.sinceLast, customFrom: flow.customFrom, customTo: flow.customTo });
  const summary = useDbQuery((d) => readRangeSummary(d, range), [range.from, range.to]);

  return {
    now,
    kind: flow.kind,
    range,
    summary,
    basics,
    customFrom: flow.customFrom,
    customTo: flow.customTo,
    includePhones: basics.includeCustomerPhones,
    alsoPhotos: flow.alsoPhotos,
    setKind: (kind: PeriodKind) => {
      if (kind === 'custom' && flow.customFrom === null) {
        flow.set({ kind, customFrom: now, customTo: now });
      } else {
        flow.set({ kind });
      }
    },
    pickDay: (day: number) => flow.set({ kind: 'custom', ...pickCustomDay({ from: flow.customFrom, to: flow.customTo }, day) }),
    setIncludePhones: (on: boolean) => {
      updateSettings(db, { reportIncludesCustomerPhones: on });
    },
    setAlsoPhotos: (on: boolean) => flow.set({ alsoPhotos: on }),
  };
}
