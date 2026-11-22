import { useEffect, useRef } from 'react';
import { StyleSheet, View, type AccessibilityActionEvent, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../theme';
import { touchTarget } from '../tokens';
import { playHaptic } from './haptics';
import { Icon } from './Icon';
import { PressableScale } from './PressableScale';
import { RollingNumber } from './RollingNumber';
import { useHoldRepeat } from './useHoldRepeat';

export type StepperProps = {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** What is being counted, for TalkBack ("Red pieces"). */
  accessibilityLabel: string;
  size?: 'md' | 'lg';
  disabled?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Big − / + stepper for piece counts. Tap = one step; hold = accelerating repeat. A selection
 * haptic per step; the count rolls like an odometer. Exposed to TalkBack as an adjustable
 * control with increment/decrement actions. Never goes outside [min, max].
 */
export function Stepper({
  value,
  onChange,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  step = 1,
  accessibilityLabel,
  size = 'lg',
  disabled = false,
  testID,
  style,
}: StepperProps) {
  const { colors, space, radius } = useTheme();
  const { t } = useTranslation('ui');
  // Latest value without waiting for the parent re-render (hold-repeat ticks faster than renders).
  const current = useRef(value);
  useEffect(() => {
    current.current = value;
  }, [value]);

  /** Applies one step; returns false when the bound blocks further steps. */
  const stepBy = (direction: 1 | -1): boolean => {
    const next = clamp(current.current + direction * step, min, max);
    if (next === current.current) return false;
    current.current = next;
    playHaptic('selection');
    onChange(next);
    return next !== (direction > 0 ? max : min);
  };

  const inc = useHoldRepeat(() => stepBy(1));
  const dec = useHoldRepeat(() => stepBy(-1));

  const onAccessibilityAction = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'increment') stepBy(1);
    if (e.nativeEvent.actionName === 'decrement') stepBy(-1);
  };

  const button = size === 'lg' ? 56 : touchTarget;
  const atMin = value <= min;
  const atMax = value >= max;

  const renderButton = (kind: 'dec' | 'inc') => {
    const isInc = kind === 'inc';
    const repeat = isInc ? inc : dec;
    const blocked = disabled || (isInc ? atMax : atMin);
    return (
      <PressableScale
        testID={testID ? `${testID}-${kind}` : undefined}
        accessibilityLabel={t(isInc ? 'stepper.increase' : 'stepper.decrease', { label: accessibilityLabel })}
        disabled={blocked}
        onPress={() => stepBy(isInc ? 1 : -1)}
        onLongPress={repeat.start}
        onPressOut={repeat.stop}
        delayLongPress={350}
        style={[
          styles.button,
          {
            width: button,
            height: button,
            borderRadius: radius.pill,
            backgroundColor: isInc ? colors.primary : colors.surfaceSunken,
            borderColor: colors.border,
          },
        ]}>
        <Icon name={isInc ? 'add' : 'remove'} size={28} color={isInc ? colors.onPrimary : colors.text} />
      </PressableScale>
    );
  };

  return (
    <View style={[styles.row, { gap: space.md }, style]}>
      {renderButton('dec')}
      <View
        testID={testID ? `${testID}-value` : undefined}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ min, max: max === Number.MAX_SAFE_INTEGER ? undefined : max, now: value, text: String(value) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={onAccessibilityAction}
        style={styles.value}>
        <RollingNumber accessible={false} value={value} variant={size === 'lg' ? 'count' : 'heading'} />
      </View>
      {renderButton('inc')}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  button: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  value: { minWidth: 64, alignItems: 'center', justifyContent: 'center' },
});
