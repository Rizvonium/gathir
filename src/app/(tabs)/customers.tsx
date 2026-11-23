import { useLocalSearchParams } from 'expo-router';

import { CustomersScreen } from '@/features/customers/components/CustomersScreen';
import { customerListSeed } from '@/features/customers/logic/links';

/** Customers tab (PLAN §4.8). /customers?filter=due&at= opens with "Follow-up due" on. */
export default function CustomersTab() {
  const params = useLocalSearchParams<{ filter?: string; at?: string }>();
  return <CustomersScreen seed={customerListSeed(params)} />;
}
