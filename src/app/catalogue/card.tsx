import { useLocalSearchParams } from 'expo-router';

import { CardScreen } from '@/features/catalogue/components/CardScreen';

/** /catalogue/card?productId=&customerId=  One shawl as a 1080×1350 picture for WhatsApp. */
export default function ProductCardRoute() {
  const { productId, customerId } = useLocalSearchParams<{ productId?: string; customerId?: string }>();
  return <CardScreen productId={productId || undefined} customerId={customerId || undefined} />;
}
