import { Stack } from 'expo-router';
import { View } from 'react-native';

import { useLeaveShowroom } from '@/features/showroom/hooks/useLeaveShowroom';
import { darkColors } from '@/ui/tokens';

/** /showroom/leave — after the PIN on /lock: closes the Showroom (no UI of its own). */
export default function ShowroomLeaveRoute() {
  useLeaveShowroom();
  return (
    <>
      <Stack.Screen options={{ headerShown: false, animation: 'none', gestureEnabled: false, contentStyle: { backgroundColor: darkColors.bg } }} />
      <View style={{ flex: 1, backgroundColor: darkColors.bg }} />
    </>
  );
}
