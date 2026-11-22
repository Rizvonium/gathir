import { Stack } from 'expo-router';

import { ShowroomScreen } from '@/features/showroom/components/ShowroomScreen';
import { darkColors } from '@/ui/tokens';

/** /showroom — customer-facing, full screen. No swipe-back: leaving needs the corner hold (+ PIN). */
export default function ShowroomRoute() {
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
          animation: 'fade',
          gestureEnabled: false,
          statusBarHidden: true,
          navigationBarHidden: true,
          contentStyle: { backgroundColor: darkColors.bg },
        }}
      />
      <ShowroomScreen />
    </>
  );
}
