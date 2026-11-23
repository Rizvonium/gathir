import { Stack, useLocalSearchParams } from 'expo-router';

import { SellScreen } from '@/features/sales/components/SellScreen';
import { useTheme } from '@/ui/theme';

/** /sell?productId=&colourId=&customerId=&qty= — the Sell sheet (native form sheet). */
export default function SellRoute() {
  const { colors, radius } = useTheme();
  const { productId, colourId, customerId, qty } = useLocalSearchParams<{ productId?: string; colourId?: string; customerId?: string; qty?: string }>();
  const pieces = Number.parseInt(qty ?? '', 10);
  return (
    <>
      <Stack.Screen
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: [0.92],
          sheetGrabberVisible: true,
          sheetCornerRadius: radius.sheet,
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      />
      <SellScreen params={{ productId: productId || undefined, colourId: colourId || undefined, customerId: customerId || undefined, qty: pieces > 0 ? pieces : undefined }} />
    </>
  );
}
