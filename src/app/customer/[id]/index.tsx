import { useLocalSearchParams } from 'expo-router';

import { CustomerProfileScreen } from '@/features/customers/components/CustomerProfileScreen';

/** /customer/[id] — customer profile. */
export default function CustomerRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CustomerProfileScreen id={id} />;
}
