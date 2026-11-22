/**
 * The 4-digit PIN pad: four big dots and a 3 × 4 keypad (72 dp keys, thumb zone).
 * Wrong PIN → the dots shake once (feedback, 4 × 60 ms). Reduced motion → no movement,
 * the dots turn danger-red instead; the message line always says what happened.
 */
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { easings } from '@/ui/motion';
import { AppText, Icon, PressableScale, useReduceMotionEnabled, type IconName } from '@/ui/components';
import { useTheme } from '@/ui/theme';

import { PIN_LENGTH, type PadKey } from '../pinLogic';

export type PinPadProps = {
  title: string;
  subtitle?: string;
  /** Status line under the dots (wrong PIN, pause countdown). Read out by TalkBack. */
  message?: string;
  messageTone?: 'muted' | 'danger';
  /** Digits typed so far. */
  value: string;
  onKey: (key: PadKey) => void;
  disabled?: boolean;
  /** Increment to shake the dots once (wrong PIN). */
  shakeSignal?: number;
  /** Optional key in the bottom-start slot (fingerprint). */
  extraKey?: { icon: IconName; label: string; onPress: () => void };
  testID?: string;
};

const KEY_SIZE = 72;
const ROWS: PadKey[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
];
const SHAKE = { duration: 60, easing: easings.inOut, reduceMotion: ReduceMotion.System } as const;

export function PinPad({ title, subtitle, message, messageTone = 'muted', value, onKey, disabled, shakeSignal = 0, extraKey, testID }: PinPadProps) {
  const { t } = useTranslation('lock');
  const { colors, space } = useTheme();
  const reduced = useReduceMotionEnabled();
  const x = useSharedValue(0);

  useEffect(() => {
    if (shakeSignal === 0 || reduced) return;
    x.set(withSequence(withTiming(-12, SHAKE), withTiming(12, SHAKE), withTiming(-8, SHAKE), withTiming(0, SHAKE)));
  }, [shakeSignal, reduced, x]);

  const dotsStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  const showError = messageTone === 'danger';
  const dotColour = showError && value.length === 0 ? colors.danger : colors.primary;

  return (
    <View testID={testID} style={[styles.root, { gap: space.xl }]}>
      <View style={[styles.head, { gap: space.sm }]}>
        <Icon name="lock" size={32} tone="primary" />
        <AppText variant="heading" align="center" accessibilityRole="header">
          {title}
        </AppText>
        {subtitle ? (
          <AppText muted align="center">
            {subtitle}
          </AppText>
        ) : null}
      </View>

      <Animated.View
        style={[styles.dots, { gap: space.lg }, dotsStyle]}
        accessible
        accessibilityLabel={t('pad.entered', { count: value.length, total: PIN_LENGTH })}
        testID={testID ? `${testID}-dots` : undefined}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => {
          const filled = i < value.length;
          return (
            <View
              key={i}
              style={[
                styles.dot,
                { borderColor: dotColour, backgroundColor: filled ? dotColour : 'transparent' },
              ]}
            />
          );
        })}
      </Animated.View>

      <AppText
        testID={testID ? `${testID}-message` : undefined}
        align="center"
        tone={showError ? 'danger' : 'textMuted'}
        weight={showError ? 'semibold' : 'regular'}
        accessibilityLiveRegion="polite"
        style={styles.message}>
        {message ?? ' '}
      </AppText>

      <View style={[styles.pad, { gap: space.md }]}>
        {ROWS.map((row) => (
          <View key={row.join('')} style={[styles.row, { gap: space.xl }]}>
            {row.map((k) => (
              <DigitKey key={k} digit={k} disabled={disabled} onPress={() => onKey(k)} testID={testID ? `${testID}-key-${k}` : undefined} />
            ))}
          </View>
        ))}
        <View style={[styles.row, { gap: space.xl }]}>
          {extraKey ? (
            <PressableScale
              testID={testID ? `${testID}-extra` : undefined}
              onPress={extraKey.onPress}
              accessibilityRole="button"
              accessibilityLabel={extraKey.label}
              haptic="light"
              style={[styles.key, { backgroundColor: colors.surfaceSunken }]}>
              <Icon name={extraKey.icon} size={32} tone="primary" />
            </PressableScale>
          ) : (
            <View style={styles.key} />
          )}
          <DigitKey digit="0" disabled={disabled} onPress={() => onKey('0')} testID={testID ? `${testID}-key-0` : undefined} />
          <PressableScale
            testID={testID ? `${testID}-key-back` : undefined}
            onPress={() => onKey('back')}
            disabled={disabled || value.length === 0}
            accessibilityRole="button"
            accessibilityLabel={t('pad.delete')}
            haptic="selection"
            style={styles.key}>
            <Icon name="backspace" size={28} tone="text" />
          </PressableScale>
        </View>
      </View>
    </View>
  );
}

function DigitKey({ digit, onPress, disabled, testID }: { digit: string; onPress: () => void; disabled?: boolean; testID?: string }) {
  const { colors } = useTheme();
  return (
    <PressableScale
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      haptic="selection"
      accessibilityRole="button"
      accessibilityLabel={digit}
      style={[styles.key, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
      <AppText variant="display" numeric>
        {digit}
      </AppText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', alignSelf: 'stretch' },
  head: { alignItems: 'center', paddingHorizontal: 16 },
  dots: { flexDirection: 'row', justifyContent: 'center' },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2 },
  message: { minHeight: 24, paddingHorizontal: 16 },
  pad: { alignItems: 'center' },
  row: { flexDirection: 'row' },
  key: { width: KEY_SIZE, height: KEY_SIZE, borderRadius: KEY_SIZE / 2, alignItems: 'center', justifyContent: 'center' },
});
