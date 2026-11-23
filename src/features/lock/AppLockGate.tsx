/**
 * App lock (PLAN §3): when a PIN is set, the app opens behind the PIN pad on a cold start and
 * after more than 5 minutes in the background. The pad is an overlay above the navigator (not a
 * route), so Back cannot skip it and the seller returns exactly where they were.
 *
 * Leaving the app (when a PIN is set) puts a plain cover over the screen at once, so the first
 * frame on return never shows shop data before the lock decides, and Android versions without
 * the Recents setting (plugins/withRecentsPrivacy, Android 13+) snapshot the cover, not the data.
 *
 * Sheets (@expo/ui, each in its own dialog window above this one) and toasts cannot be covered
 * by a view here, so the gate publishes "locked" (setScreenLocked): sheets are taken down until
 * the PIN is entered and toasts wait for it. See ui/components/overlayStore.
 *
 * The gate only applies once first-launch setup has finished: a PIN set on the onboarding
 * `/app-lock` step must not lock a seller out of their own unfinished setup after a restart.
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, BackHandler, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { db } from '@/db/client';
import { useDbQuery } from '@/db/hooks';
import { updateSettings } from '@/db/repo/settings';
import { readOnboarded } from '@/features/onboarding/onboardingData';
import { setScreenLocked } from '@/ui/components/overlayStore';
import { useTheme } from '@/ui/theme';

import { PinVerifyPanel } from './components/PinVerifyPanel';
import { readPinFlag } from './pinFlag';
import { lockGateActive, shouldLockOnResume } from './pinLogic';
import { isPinStored } from './pinStore';

export function AppLockGate({ children }: { children: ReactNode }) {
  const pinFlag = useDbQuery(readPinFlag, [], { tables: ['shop_settings'] });
  const onboarded = useDbQuery(readOnboarded, [], { tables: ['shop_settings'] });
  const pinSet = lockGateActive(pinFlag, onboarded);
  // Cold start: locked from the first frame when a PIN is set (no flash of shop data).
  const [lockedState, setLocked] = useState(pinSet);
  // Removing the PIN (flag off) opens the gate at once.
  const locked = lockedState && pinSet;
  const [coveredState, setCovered] = useState(false);
  const covered = coveredState && pinSet;
  const backgroundAt = useRef<number | null>(null);
  const pinSetRef = useRef(pinSet);

  useEffect(() => {
    pinSetRef.current = pinSet;
  }, [pinSet]);

  // The flag says "PIN set" but this phone has no PIN (e.g. secure storage was cleared): never lock out.
  useEffect(() => {
    if (!locked) return;
    let alive = true;
    void isPinStored().then((stored) => {
      if (!alive || stored) return;
      setLocked(false);
      try {
        updateSettings(db, { pinHashSet: false });
      } catch {
        // The gate stays open either way.
      }
    });
    return () => {
      alive = false;
    };
  }, [locked]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (!pinSetRef.current) return;
      if (state === 'background' || state === 'inactive') {
        setCovered(true);
        if (state === 'background') backgroundAt.current ??= Date.now();
      } else if (state === 'active') {
        if (shouldLockOnResume(backgroundAt.current, Date.now())) setLocked(true);
        backgroundAt.current = null;
        setCovered(false);
      }
    });
    return () => sub.remove();
  }, []);

  useLayoutEffect(() => {
    setScreenLocked(locked);
  }, [locked]);
  useEffect(() => () => setScreenLocked(false), []);

  useEffect(() => {
    if (!locked) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [locked]);

  return (
    <View style={styles.flex}>
      <View style={styles.flex} importantForAccessibility={locked ? 'no-hide-descendants' : 'auto'}>
        {children}
      </View>
      {locked ? <LockOverlay onUnlock={() => setLocked(false)} /> : covered ? <PrivacyCover /> : null}
    </View>
  );
}

/** Plain background while the app is away: nothing of the shop shows in Recents or on return. */
function PrivacyCover() {
  const { colors } = useTheme();
  return <View testID="app-privacy-cover" style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg }]} />;
}

function LockOverlay({ onUnlock }: { onUnlock: () => void }) {
  const { colors, space } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      testID="app-lock-overlay"
      accessibilityViewIsModal
      style={[
        StyleSheet.absoluteFill,
        styles.overlay,
        { backgroundColor: colors.bg, paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.xl },
      ]}>
      <PinVerifyPanel onSuccess={onUnlock} testID="app-lock" />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: { justifyContent: 'center' },
});
