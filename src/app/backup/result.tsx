import { Stack, useLocalSearchParams } from 'expo-router';

import { paramsToOutcome } from '@/features/backup/backupView';
import { RestoreResultScreen } from '@/features/backup/components/RestoreResultScreen';

/** /backup/result?status=ok|invalid|newer_version|failed&designs=&sales=&customers=&photos= */
export default function RestoreResultRoute() {
  const params = useLocalSearchParams();
  return (
    <>
      <Stack.Screen options={{ gestureEnabled: false }} />
      <RestoreResultScreen outcome={paramsToOutcome(params)} />
    </>
  );
}
