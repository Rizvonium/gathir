import { useLocalSearchParams } from 'expo-router';

import { AddPiecesScreen } from '@/features/customers/components/AddPiecesScreen';

/** /customer/[id]/add-pieces — pick designs for this customer's personal catalogue. */
export default function AddPiecesRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AddPiecesScreen customerId={id} />;
}
