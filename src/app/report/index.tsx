import { useLocalSearchParams } from 'expo-router';

import { ReportScreen } from '@/features/report/components/ReportScreen';

function ms(v: string | undefined): number | undefined {
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** /report?from=&to= — send the sales report to the owner (period → preview → send). */
export default function ReportRoute() {
  const { from, to } = useLocalSearchParams<{ from?: string; to?: string }>();
  return <ReportScreen initialFrom={ms(from)} initialTo={ms(to)} />;
}
