/**
 * /lock?mode=set|verify|change&returnTo=
 * - set: choose a PIN (onboarding and Settings → App lock), then go to `returnTo` (or back).
 * - verify: unlock with PIN or fingerprint, then go to `returnTo` (or back).
 * - change: verify the current PIN, then choose a new one.
 * In verify mode with a guarded `returnTo` (Showroom exit, see lockBlocksBack) Android back is blocked.
 */
import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { IconButton, Screen, useToast } from '@/ui/components';

import { lockBlocksBack, safeReturnTo } from '../pinLogic';
import { PinVerifyPanel } from './PinVerifyPanel';
import { SetPinPanel } from './SetPinPanel';

export type LockMode = 'set' | 'verify' | 'change';

export function parseLockMode(v: string | string[] | undefined): LockMode {
  const m = Array.isArray(v) ? v[0] : v;
  return m === 'set' || m === 'change' ? m : 'verify';
}

export function LockScreen({ mode, returnTo }: { mode: LockMode; returnTo?: string | string[] }) {
  const { t } = useTranslation('lock');
  const toast = useToast();
  const [verified, setVerified] = useState(false);
  const target = safeReturnTo(returnTo);
  // Showroom exit: Android back (and the back swipe) must not slip past the PIN; the close
  // button still returns to the Showroom. Other uses keep the normal back behaviour.
  const blockBack = lockBlocksBack(mode, returnTo);

  useEffect(() => {
    if (!blockBack) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [blockBack]);

  const leave = () => {
    if (target) router.replace(target as never);
    else if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const onPinSaved = () => {
    toast.show({ message: mode === 'change' ? t('set.changed') : t('set.saved'), tone: 'success' });
    leave();
  };

  const showSet = mode === 'set' || (mode === 'change' && verified);

  return (
    <>
      {blockBack ? <Stack.Screen options={{ gestureEnabled: false }} /> : null}
      <Screen
        testID="lock-screen"
        edges={['top', 'bottom']}
        scroll
        leading={
          router.canGoBack() ? <IconButton icon="close" accessibilityLabel={t('close')} onPress={() => router.back()} /> : undefined
        }>
        <View style={styles.center}>
          {showSet ? (
            <SetPinPanel onDone={onPinSaved} />
          ) : (
            <PinVerifyPanel
              title={mode === 'change' ? t('change.verifyTitle') : undefined}
              onSuccess={mode === 'change' ? () => setVerified(true) : leave}
            />
          )}
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flexGrow: 1, justifyContent: 'center', paddingVertical: 16 },
});
