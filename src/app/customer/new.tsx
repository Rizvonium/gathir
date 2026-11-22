import { useLocalSearchParams } from 'expo-router';

import { CustomerFormScreen } from '@/features/customers/components/CustomerFormScreen';

/** /customer/new?name=&phone=&returnTo= — add a customer (pre-filled from contacts or the Sell sheet). */
export default function NewCustomerRoute() {
  const { name, phone, returnTo } = useLocalSearchParams<{ name?: string; phone?: string; returnTo?: string }>();
  return <CustomerFormScreen name={name || undefined} phone={phone || undefined} returnTo={returnTo || undefined} />;
}
