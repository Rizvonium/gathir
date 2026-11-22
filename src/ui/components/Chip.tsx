import type { ReactNode } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { useTheme } from '../theme';
import { touchTarget } from '../tokens';
import { colorTransition } from './cssMotion';
import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';
import { useReduceMotionEnabled } from './useReduceMotionEnabled';

export type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** Leading Material icon. */
  icon?: IconName;
  /** Leading custom slot, e.g. <ColourSwatch size={18} />. Wins over `icon`. */
  leading?: ReactNode;
  /** TalkBack role: radio in single-select groups, checkbox in multi-select. Default button. */
  role?: 'button' | 'radio' | 'checkbox';
  disabled?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Pill-shaped choice (48dp tall). Selected = chinar fill; background, border and label
 * colours cross-fade in 160 ms (instant with reduced motion). Selection haptic on tap.
 */
export function Chip({ label, selected = false, onPress, icon, leading, role = 'button', disabled, testID, style }: ChipProps) {
  const { colors, fonts, type, space, radius } = useTheme();
  const reduced = useReduceMotionEnabled();
  const fg = selected ? colors.onPrimary : colors.text;

  return (
    <PressableScale
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      haptic="selection"
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={role === 'button' ? { selected } : { checked: selected }}
      style={style}>
      <Animated.View
        style={[
          styles.pill,
          {
            borderRadius: radius.pill,
            paddingHorizontal: space.lg,
            gap: space.sm,
            backgroundColor: selected ? colors.primary : colors.surface,
            borderColor: selected ? colors.primary : colors.border,
            ...colorTransition(['backgroundColor', 'borderColor'], reduced),
          },
        ]}>
        {leading ?? (icon ? <Icon name={icon} size={18} color={fg} /> : null)}
        {/* Animated.Text (not AppText) so the label colour cross-fades with the fill. */}
        <Animated.Text
          numberOfLines={1}
          style={[
            type.small,
            { fontFamily: fonts.bodySemi, color: fg, ...colorTransition(['color'], reduced) },
          ]}>
          {label}
        </Animated.Text>
      </Animated.View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', minHeight: touchTarget, borderWidth: 1 },
});
