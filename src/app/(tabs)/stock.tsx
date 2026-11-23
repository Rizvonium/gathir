import { useLocalSearchParams } from 'expo-router';

import { StockScreen } from '@/features/stock/components/StockScreen';
import { stockListSeed } from '@/features/stock/logic/links';

/** Stock tab (PLAN §4.3). /stock?filter=&sort=&at= opens on that filter and sort. */
export default function StockTab() {
  const params = useLocalSearchParams<{ filter?: string; sort?: string; at?: string }>();
  return <StockScreen seed={stockListSeed(params)} />;
}
