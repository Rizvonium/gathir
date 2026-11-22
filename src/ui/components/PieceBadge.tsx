import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { useTheme, type Theme } from '../theme';
import { AppText } from './AppText';
import { colorTransition } from './cssMotion';
import { Icon, type IconName } from './Icon';
import { DEFAULT_LOW_THRESHOLD, stockStatusOf, type StockStatus } from './stockStatus';
import { useReduceMotionEnabled } from './useReduceMotionEnabled';

export type PieceBadgeProps = {
  count: number;
  /** At or below this count the badge shows "Low". Default 2 (pass the shop setting). */
  lowThreshold?: number;
  size?: 'sm' | 'md';
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

const icons: Record<StockStatus, IconName> = { ok: 'check-circle', low: 'error-outline', out: 'remove-circle-outline' };

function statusColors(colors: Theme['colors'], status: StockStatus) {
  switch (status) {
    case 'ok':
      return { bg: colors.stockOk, fg: colors.onAccent };
    case 'low':
      return { bg: colors.stockLow, fg: colors.onSaffron };
    case 'out':
      return { bg: colors.stockOut, fg: colors.onPrimary };
  }
}

/**
 * Piece count + stock status pill. Status is told three ways: text ("Only 2 left",
 * "Sold out"), icon and colour; colour cross-fades 160 ms when crossing the low line.
 */
export function PieceBadge({ count, lowThreshold = DEFAULT_LOW_THRESHOLD, size = 'md', testID, style }: PieceBadgeProps) {
  const { colors, space, radius } = useTheme();
  const { t } = useTranslation('ui');
  const reduced = useReduceMotionEnabled();
  const status = stockStatusOf(count, lowThreshold);
  const c = statusColors(colors, status);
  const label = t(`pieceBadge.${status}`, { count });
  const a11y = t(`pieceBadge.a11y.${status}`, { count });
  const small = size === 'sm';

  return (
    <Animated.View
      testID={testID}
      accessible
      accessibilityRole="text"
      accessibilityLabel={a11y}
      style={[
        styles.pill,
        {
          backgroundColor: c.bg,
          borderRadius: radius.pill,
          paddingHorizontal: small ? space.sm : space.md,
          paddingVertical: small ? space.xxs : space.xs,
          gap: space.xs,
          ...colorTransition(['backgroundColor'], reduced),
        },
        style,
      ]}>
      <Icon name={icons[status]} size={small ? 14 : 18} color={c.fg} />
      <AppText variant={small ? 'caption' : 'small'} weight="bold" numeric color={c.fg}>
        {label}
      </AppText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
});
