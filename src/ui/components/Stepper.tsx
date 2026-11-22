import { useRef } from 'react';
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
  /**
   * Controlled value: the stepper always shows it, and every tap steps from it. To reset the
   * stepper (e.g. after a cancelled "−"), just keep or set `value`; no remount (`key`) needed.
   */
  value: number;
  /** Called with value ± step. The parent decides whether `value` follows. */
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
  // Only a hold-to-repeat runs ahead of the parent's renders: it counts from `value` at the start
  // of the hold. Taps and TalkBack actions always step from the controlled `value`.
  const holding = useRef(value);

  /** One step from `base`; returns the new value, or null when a bound blocks it. */
  const stepFrom = (base: number, direction: 1 | -1): number | null => {
    const next = clamp(base + direction * step, min, max);
    if (next === base) return null;
    playHaptic('selection');
    onChange(next);
    return next;
  };

  const holdTick = (direction: 1 | -1): boolean => {
    const next = stepFrom(holding.current, direction);
    if (next === null) return false;
    holding.current = next;
    return next !== (direction > 0 ? max : min);
  };

  const inc = useHoldRepeat(() => holdTick(1));
  const dec = useHoldRepeat(() => holdTick(-1));
  const startHold = (direction: 1 | -1) => {
    holding.current = value;
    (direction > 0 ? inc : dec).start();
  };

  const onAccessibilityAction = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'increment') stepFrom(value, 1);
    if (e.nativeEvent.actionName === 'decrement') stepFrom(value, -1);
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
        onPress={() => stepFrom(value, isInc ? 1 : -1)}
        onLongPress={() => startHold(isInc ? 1 : -1)}
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
