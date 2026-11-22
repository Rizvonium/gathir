import { useLocalSearchParams } from 'expo-router';

import { ProductDetailScreen } from '@/features/stock/components/ProductDetailScreen';

/** Product detail (PLAN §4.4). */
export default function ProductDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ProductDetailScreen productId={id} />;
}
