import { useLocalSearchParams } from 'expo-router';

import { ProductWizardScreen } from '@/features/stock/components/wizard/ProductWizardScreen';

/** Edit product wizard (PLAN §4.5). */
export default function EditProductRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ProductWizardScreen productId={id} />;
}
