import { Stack } from 'expo-router';

import { useTheme } from '@/ui/theme';

/** First-launch flow: native stack, platform push transitions, no headers (each step draws its own). */
export default function OnboardingLayout() {
  const { colors } = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />;
}
