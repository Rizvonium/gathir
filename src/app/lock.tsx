import { useLocalSearchParams } from 'expo-router';

import { LockScreen, parseLockMode } from '@/features/lock/components/LockScreen';

/** /lock?mode=set|verify|change&returnTo= — set, check or change the app PIN. */
export default function LockRoute() {
  const { mode, returnTo } = useLocalSearchParams<{ mode?: string; returnTo?: string }>();
  return <LockScreen mode={parseLockMode(mode)} returnTo={returnTo} />;
}
