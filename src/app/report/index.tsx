import { useLocalSearchParams } from 'expo-router';

import { ReportScreen } from '@/features/report/components/ReportScreen';

function ms(v: string | undefined): number | undefined {
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** /report?from=&to=&at= — send the sales report to the owner (period → preview → send). */
export default function ReportRoute() {
  const { from, to, at } = useLocalSearchParams<{ from?: string; to?: string; at?: string }>();
  return <ReportScreen initialFrom={ms(from)} initialTo={ms(to)} visit={at} />;
}
