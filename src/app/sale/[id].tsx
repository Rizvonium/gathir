import { useLocalSearchParams } from 'expo-router';

import { SaleDetailScreen } from '@/features/sales/components/SaleDetailScreen';

/** /sale/[id] — one sale: items, totals, customer, Send bill, Return. */
export default function SaleRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <SaleDetailScreen id={id} />;
}
