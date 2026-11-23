import { Redirect, Stack } from 'expo-router';
import { useState } from 'react';

import { useOnboarded } from '@/features/onboarding/useOnboarded';
import { useTheme } from '@/ui/theme';

/**
 * First-launch flow: native stack, platform push transitions, no headers (each step draws its own).
 * Once setup has finished these steps are closed: opening one later (e.g. /owner, which would
 * change the owner number without the PIN) goes Home instead. Checked at mount only, so finishing
 * setup (or restoring a backup) from inside the flow still leaves through its own navigation.
 */
export default function OnboardingLayout() {
  const { colors } = useTheme();
  const onboarded = useOnboarded();
  const [closed] = useState(onboarded);
  if (closed) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />;
}
