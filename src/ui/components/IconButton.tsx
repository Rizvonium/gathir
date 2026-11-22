import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme';
import { touchTarget } from '../tokens';
import type { HapticKind } from './haptics';
import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';

export type IconButtonVariant = 'ghost' | 'tonal' | 'filled';

export type IconButtonProps = {
  icon: IconName;
  /** Required: icon-only controls must be named for TalkBack. */
  accessibilityLabel: string;
  onPress?: () => void;
  variant?: IconButtonVariant;
  /** Visual diameter. Touch area is always at least 48dp. */
  size?: number;
  disabled?: boolean;
  /** Icon colour override (e.g. on an inverse surface). Defaults by variant. */
  color?: string;
  haptic?: HapticKind;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

/** Round icon-only button (48dp). ghost = no fill, tonal = sunken fill, filled = primary. */
export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  variant = 'ghost',
  size = touchTarget,
  disabled,
  color,
  haptic,
  testID,
  style,
}: IconButtonProps) {
  const { colors, radius } = useTheme();
  const bg = variant === 'filled' ? colors.primary : variant === 'tonal' ? colors.surfaceSunken : 'transparent';
  const fg = color ?? (variant === 'filled' ? colors.onPrimary : colors.text);
  const slop = Math.max(0, (touchTarget - size) / 2);
  return (
    <PressableScale
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      haptic={haptic}
      accessibilityLabel={accessibilityLabel}
      hitSlop={slop}
      style={[styles.base, { width: size, height: size, borderRadius: radius.pill, backgroundColor: bg }, style]}>
      <Icon name={icon} size={Math.round(size * 0.5)} color={fg} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
});
