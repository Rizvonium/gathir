import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme, type Theme } from '../theme';
import { touchTarget } from '../tokens';
import { AppText } from './AppText';
import type { HapticKind } from './haptics';
import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';

export type ButtonVariant = 'primary' | 'secondary' | 'tonal' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Leading Material icon (start side). */
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  haptic?: HapticKind;
  /** Extra context for TalkBack when the label alone is not enough. */
  accessibilityHint?: string;
  testID?: string;
  /** Layout overrides only (margin, flex). */
  style?: StyleProp<ViewStyle>;
};

function variantColors(colors: Theme['colors'], variant: ButtonVariant) {
  switch (variant) {
    case 'primary':
      return { bg: colors.primary, fg: colors.onPrimary, border: colors.primary };
    case 'secondary':
      return { bg: colors.surface, fg: colors.text, border: colors.border };
    case 'tonal':
      return { bg: colors.saffron, fg: colors.onSaffron, border: colors.saffron };
    case 'ghost':
      return { bg: 'transparent', fg: colors.primary, border: 'transparent' };
    case 'danger':
      return { bg: colors.danger, fg: colors.onPrimary, border: colors.danger };
  }
}

/** sm keeps a 48dp touch area via hitSlop even though it draws 40dp tall. */
const sizeSpec = {
  sm: { minHeight: 40, padH: 'md', text: 'small', icon: 18 },
  md: { minHeight: touchTarget, padH: 'lg', text: 'body', icon: 20 },
  lg: { minHeight: 56, padH: 'xl', text: 'title', icon: 24 },
} as const;

/**
 * Text button. primary = chinar red (main action, e.g. Sell), secondary = outlined surface,
 * tonal = saffron, ghost = text-only, danger = destructive (prefer Undo over confirming).
 * While loading it keeps its width, shows a spinner and reports busy to TalkBack.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  disabled = false,
  fullWidth = false,
  haptic,
  accessibilityHint,
  testID,
  style,
}: ButtonProps) {
  const theme = useTheme();
  const c = variantColors(theme.colors, variant);
  const spec = sizeSpec[size];
  const iconSlot = loading ? (
    <ActivityIndicator size="small" color={c.fg} />
  ) : icon ? (
    <Icon name={icon} size={spec.icon} color={c.fg} />
  ) : null;

  return (
    <PressableScale
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      haptic={haptic}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ busy: loading }}
      hitSlop={size === 'sm' ? (touchTarget - spec.minHeight) / 2 : undefined}
      style={[
        styles.base,
        {
          minHeight: spec.minHeight,
          paddingHorizontal: theme.space[spec.padH],
          backgroundColor: c.bg,
          borderColor: c.border,
          borderRadius: theme.radius.pill,
          gap: theme.space.sm,
        },
        fullWidth && styles.fullWidth,
        style,
      ]}>
      {iconSlot ? <View style={styles.iconSlot}>{iconSlot}</View> : null}
      <AppText variant={spec.text} weight="bold" color={c.fg} numberOfLines={2} align="center">
        {label}
      </AppText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    paddingVertical: 8,
  },
  fullWidth: { alignSelf: 'stretch' },
  iconSlot: { alignItems: 'center', justifyContent: 'center' },
});
