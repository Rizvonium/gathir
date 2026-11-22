import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { formatNumber } from '@/lib/money';
import { useTheme } from '../theme';
import { AppText } from './AppText';
import { Card } from './Card';
import { Icon, type IconName } from './Icon';
import { RollingNumber } from './RollingNumber';

export type StatCardProps = {
  label: string;
  value: number;
  /** Formatter for value and delta (e.g. formatINR for paise). Default: Indian-grouped integer. */
  format?: (value: number) => string;
  /** Change vs yesterday (same unit as value). Omit to hide. */
  delta?: number;
  icon?: IconName;
  onPress?: () => void;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

/** Home-screen figure: label, rolling number, optional "▲ 3 vs yesterday" line and icon. */
export function StatCard({ label, value, format = formatNumber, delta, icon, onPress, testID, style }: StatCardProps) {
  const { colors, space } = useTheme();
  const { t } = useTranslation('ui');
  const formatted = format(value);
  const deltaText =
    delta === undefined
      ? undefined
      : delta === 0
        ? t('stat.same')
        : t(delta > 0 ? 'stat.up' : 'stat.down', { value: format(Math.abs(delta)) });
  const deltaColor = delta === undefined || delta === 0 ? colors.textMuted : delta > 0 ? colors.meadow : colors.danger;
  const deltaIcon: IconName = !delta ? 'trending-flat' : delta > 0 ? 'trending-up' : 'trending-down';

  return (
    <Card
      testID={testID}
      onPress={onPress}
      accessibilityLabel={[label, formatted, deltaText].filter(Boolean).join(', ')}
      style={style}>
      <View style={[styles.top, { gap: space.sm }]} importantForAccessibility="no-hide-descendants">
        <AppText variant="small" muted weight="semibold" style={styles.flex} numberOfLines={2}>
          {label}
        </AppText>
        {icon ? <Icon name={icon} size={20} tone="textMuted" /> : null}
      </View>
      <View importantForAccessibility="no-hide-descendants" style={{ marginTop: space.xs }}>
        <RollingNumber value={value} format={format} variant="heading" accessible={false} />
      </View>
      {deltaText ? (
        <View style={[styles.delta, { gap: space.xxs }]} importantForAccessibility="no-hide-descendants">
          <Icon name={deltaIcon} size={16} color={deltaColor} />
          <AppText variant="caption" numeric color={deltaColor}>
            {deltaText}
          </AppText>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'flex-start' },
  delta: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
});
