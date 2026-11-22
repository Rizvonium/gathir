/**
 * App lock (PLAN §3): when a PIN is set, the app opens behind the PIN pad on a cold start and
 * after more than 5 minutes in the background. The pad is an overlay above the navigator (not a
 * route), so Back cannot skip it and the seller returns exactly where they were.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, BackHandler, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { db } from '@/db/client';
import { useDbQuery } from '@/db/hooks';
import { updateSettings } from '@/db/repo/settings';
import { useTheme } from '@/ui/theme';

import { PinVerifyPanel } from './components/PinVerifyPanel';
import { readPinFlag } from './pinFlag';
import { shouldLockOnResume } from './pinLogic';
import { isPinStored } from './pinStore';

export function AppLockGate({ children }: { children: ReactNode }) {
  const pinSet = useDbQuery(readPinFlag, []);
  // Cold start: locked from the first frame when a PIN is set (no flash of shop data).
  const [locked, setLocked] = useState(pinSet);
  const backgroundAt = useRef<number | null>(null);
  const pinSetRef = useRef(pinSet);

  useEffect(() => {
    pinSetRef.current = pinSet;
    if (!pinSet) setLocked(false);
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
      if (state === 'background') {
        backgroundAt.current ??= Date.now();
      } else if (state === 'active') {
        if (shouldLockOnResume(backgroundAt.current, Date.now())) setLocked(true);
        backgroundAt.current = null;
      }
    });
    return () => sub.remove();
  }, []);

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
      {locked ? <LockOverlay onUnlock={() => setLocked(false)} /> : null}
    </View>
  );
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
