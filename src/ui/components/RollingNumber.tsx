import { useEffect } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';

import { formatNumber } from '@/lib/money';
import { timing } from '../motion';
import type { ColorTokens } from '../tokens';
import { AppText, type TextVariant, type TextWeight } from './AppText';

export type RollingNumberProps = {
  value: number;
  /** Formats the number for display, e.g. formatINR for paise. Default: Indian-grouped integer. */
  format?: (value: number) => string;
  variant?: TextVariant;
  weight?: TextWeight;
  tone?: keyof ColorTokens;
  color?: string;
  /** Set false when a parent already announces the value (e.g. Stepper). Default true. */
  accessible?: boolean;
  /** TalkBack label; defaults to the formatted value. */
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

type TextLook = { variant: TextVariant; weight?: TextWeight; tone?: keyof ColorTokens; color?: string };

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

/**
 * Odometer-style number: each digit column rolls to its new value in 180 ms when `value`
 * changes (transform only, UI thread). With "Remove animations" on it jumps instantly
 * (ReduceMotion.System). Separators and symbols render statically.
 */
export function RollingNumber({
  value,
  format = formatNumber,
  variant = 'count',
  weight,
  tone,
  color,
  accessible = true,
  accessibilityLabel,
  testID,
  style,
}: RollingNumberProps) {
  const text = format(value);
  const chars = Array.from(text);
  const look: TextLook = { variant, weight, tone, color };
  return (
    <View
      testID={testID}
      accessible={accessible}
      accessibilityLabel={accessible ? (accessibilityLabel ?? text) : undefined}
      importantForAccessibility={accessible ? 'yes' : 'no-hide-descendants'}
      style={[styles.row, style]}>
      {chars.map((ch, i) => {
        const fromEnd = chars.length - i;
        const isDigit = ch >= '0' && ch <= '9';
        return isDigit ? (
          <DigitColumn key={`${fromEnd}-d`} digit={Number(ch)} look={look} />
        ) : (
          <AppText key={`${fromEnd}-${ch}`} {...look} numeric importantForAccessibility="no">
            {ch}
          </AppText>
        );
      })}
    </View>
  );
}

function DigitColumn({ digit, look }: { digit: number; look: TextLook }) {
  const position = useSharedValue(digit);
  const cellHeight = useSharedValue(0);

  useEffect(() => {
    position.set(withTiming(digit, timing.count));
  }, [digit, position]);

  const onLayout = (e: LayoutChangeEvent) => cellHeight.set(e.nativeEvent.layout.height);

  return (
    <View style={styles.cell} importantForAccessibility="no-hide-descendants">
      {/* Invisible sizer: tabular digits share one width, so "0" sizes every column. */}
      <AppText {...look} numeric style={styles.sizer} onLayout={onLayout}>
        0
      </AppText>
      <DigitStrip position={position} cellHeight={cellHeight} look={look} />
    </View>
  );
}

function DigitStrip({ position, cellHeight, look }: { position: SharedValue<number>; cellHeight: SharedValue<number>; look: TextLook }) {
  const strip = useAnimatedStyle(() => ({
    transform: [{ translateY: -position.get() * cellHeight.get() }],
  }));
  return (
    <Animated.View style={[styles.strip, strip]}>
      {DIGITS.map((d) => (
        <AppText key={d} {...look} numeric>
          {d}
        </AppText>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Numbers read left-to-right even in Urdu RTL layouts.
  row: { flexDirection: 'row', alignItems: 'flex-start', direction: 'ltr' },
  cell: { overflow: 'hidden' },
  sizer: { opacity: 0 },
  strip: { position: 'absolute', top: 0, start: 0, end: 0 },
});
