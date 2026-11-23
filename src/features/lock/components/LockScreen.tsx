/**
 * /lock?mode=set|verify|change&returnTo=
 * - set: choose a PIN (onboarding and Settings → App lock), then go to `returnTo` (or back).
 * - verify: unlock with PIN or fingerprint, then go to `returnTo` (or back).
 * - change: verify the current PIN, then choose a new one.
 *   `set` when a PIN already exists (a stale screen, or a link) is treated as `change`: the stored
 *   PIN is never replaced without entering it first.
 * In verify mode with a guarded `returnTo` (Showroom exit, see lockBlocksBack) Android back is blocked.
 */
import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useDbQuery } from '@/db/hooks';
import { grantShowroomLeave } from '@/features/showroom/logic/session';
import { IconButton, Screen, useToast } from '@/ui/components';

import { readPinFlag } from '../pinFlag';
import { effectiveLockMode, lockBlocksBack, safeReturnTo } from '../pinLogic';
import { isPinStored } from '../pinStore';
import { PinVerifyPanel } from './PinVerifyPanel';
import { SetPinPanel } from './SetPinPanel';

export type LockMode = 'set' | 'verify' | 'change';

export function parseLockMode(v: string | string[] | undefined): LockMode {
  const m = Array.isArray(v) ? v[0] : v;
  return m === 'set' || m === 'change' ? m : 'verify';
}

export function LockScreen({ mode: requested, returnTo }: { mode: LockMode; returnTo?: string | string[] }) {
  const { t } = useTranslation('lock');
  const toast = useToast();
  const [verified, setVerified] = useState(false);
  const pinFlag = useDbQuery(readPinFlag, [], { tables: ['shop_settings'] });
  // The device store is the truth for "a PIN exists" (the DB flag can lag after a restore).
  const [stored, setStored] = useState<boolean | null>(requested === 'set' ? null : false);
  useEffect(() => {
    if (requested !== 'set') return;
    let alive = true;
    void isPinStored().then((v) => {
      if (alive) setStored(v);
    });
    return () => {
      alive = false;
    };
  }, [requested]);
  const mode = effectiveLockMode(requested, pinFlag || stored === true);
  // Still checking whether a PIN exists: show nothing rather than a pad that could overwrite it.
  const checking = requested === 'set' && mode === 'set' && stored === null;
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
    // Leaving the Showroom: this correct PIN allows exactly one pass through /showroom/leave.
    if (blockBack) grantShowroomLeave();
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
          {checking ? null : showSet ? (
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
