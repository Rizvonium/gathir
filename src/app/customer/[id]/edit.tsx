import { useLocalSearchParams } from 'expo-router';

import { CustomerFormScreen } from '@/features/customers/components/CustomerFormScreen';

/** /customer/[id]/edit — edit a customer. */
export default function EditCustomerRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CustomerFormScreen key={id} id={id} />;
}
