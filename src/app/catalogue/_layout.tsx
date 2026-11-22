import { Stack } from 'expo-router';
import { useEffect } from 'react';

import { releaseCatalogueFlow } from '@/features/catalogue/store';
import { useTheme } from '@/ui/theme';

/** The "Send catalogue" flow and the product card: native stack, platform transitions. */
export default function CatalogueLayout() {
  const { colors } = useTheme();
  useEffect(() => releaseCatalogueFlow, []);
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />;
}
