/**
 * The corner mark that leaves the Showroom: hold it 1.5 s while a ring fills (the ring is the
 * explanation, so it fills even with reduced motion). TalkBack gets a "Leave showroom" action.
 */
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Easing, ReduceMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { Icon, playHaptic } from '@/ui/components';
import { touchTarget } from '@/ui/tokens';

import { EXIT_HOLD_MS } from '../logic/showroom';

const SIZE = 56;
const STROKE = 3;

export type ExitMarkProps = {
  onExit: () => void;
  /** Ring and glyph colour. */
  color: string;
  /** Faint track behind the ring. */
  trackColor: string;
};

export function ExitMark({ onExit, color, trackColor }: ExitMarkProps) {
  const { t } = useTranslation('showroom');
  const progress = useSharedValue(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ring = useMemo(() => Skia.Path.Circle(SIZE / 2, SIZE / 2, SIZE / 2 - STROKE), []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const begin = () => {
    progress.set(withTiming(1, { duration: EXIT_HOLD_MS, easing: Easing.linear, reduceMotion: ReduceMotion.Never }));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      playHaptic('medium');
      onExit();
    }, EXIT_HOLD_MS);
  };
  const cancel = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    progress.set(withTiming(0, { duration: 160, reduceMotion: ReduceMotion.Never }));
  };

  return (
    <Pressable
      testID="showroom-exit"
      onPressIn={begin}
      onPressOut={cancel}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={t('exit.label')}
      accessibilityHint={t('exit.hint')}
      accessibilityActions={[{ name: 'activate' }, { name: 'longpress' }]}
      onAccessibilityAction={() => onExit()}
      style={styles.box}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Canvas style={styles.canvas}>
          <Path path={ring} style="stroke" strokeWidth={STROKE} color={trackColor} />
          <Path path={ring} style="stroke" strokeWidth={STROKE} strokeCap="round" color={color} start={0} end={progress} />
        </Canvas>
      </View>
      <Icon name="filter-vintage" size={22} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { width: Math.max(SIZE, touchTarget), height: Math.max(SIZE, touchTarget), alignItems: 'center', justifyContent: 'center' },
  canvas: { width: SIZE, height: SIZE, transform: [{ rotate: '-90deg' }] },
});
