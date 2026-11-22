import { useLocalSearchParams } from 'expo-router';

import { SendStep } from '@/features/catalogue/components/SendStep';

/** /catalogue/send?to=<customerId>  Step 4 of 4: who gets it (to = send straight to that customer). */
export default function CatalogueSendRoute() {
  const { to } = useLocalSearchParams<{ to?: string }>();
  return <SendStep toCustomerId={to || undefined} />;
}
