/**
 * Small seller-only profit pieces shared by Home, Sales, Sale detail, the Sell sheet, product
 * detail and the Profit screen. Never render these on Showroom, catalogues, product cards or bills.
 */
import { router } from 'expo-router';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { formatINR } from '@/lib/money';
import { AppText, Button, Icon, IconButton, RollingNumber, type TextVariant, type TextWeight } from '@/ui/components';
import { useTheme } from '@/ui/theme';

import { formatMargin, formatProfit, profitTone } from '../logic';
import { HIDDEN_FIGURE, useProfitPrivacy } from '../privacy';

export const PROFIT_PATH = '/profit' as const;

/** The eye button: hides or shows every profit figure in the app (in memory, default shown). */
export function ProfitEyeToggle({ testID = 'profit-eye', size = 48 }: { testID?: string; size?: number }) {
  const { t } = useTranslation('profit');
  const hidden = useProfitPrivacy((s) => s.hidden);
  const toggle = useProfitPrivacy((s) => s.toggle);
  return (
    <IconButton
      testID={testID}
      icon={hidden ? 'visibility' : 'visibility-off'}
      size={size}
      accessibilityLabel={hidden ? t('show') : t('hide')}
      onPress={toggle}
      haptic="selection"
    />
  );
}

/**
 * A profit (or loss) amount: rolls like every money figure, green for profit and red for a loss
 * (with a "Loss" word, never colour alone). Hidden → dots, announced as "Hidden".
 */
export function ProfitAmount({
  paise,
  visible,
  variant = 'title',
  weight = 'bold',
  testID,
}: {
  paise: number;
  visible: boolean;
  variant?: TextVariant;
  weight?: TextWeight;
  testID?: string;
}) {
  const { t } = useTranslation('profit');
  if (!visible) {
    return (
      <AppText variant={variant} weight={weight} muted testID={testID} accessibilityLabel={t('hidden')}>
        {HIDDEN_FIGURE}
      </AppText>
    );
  }
  const label = paise < 0 ? t('lossA11y', { amount: formatINR(-paise) }) : formatProfit(paise);
  return <RollingNumber value={paise} format={formatProfit} variant={variant} weight={weight} tone={profitTone(paise)} accessibilityLabel={label} testID={testID} />;
}

/** "23.5% margin" (or nothing). */
export function MarginText({ pct, visible, variant = 'small' }: { pct: number | null; visible: boolean; variant?: TextVariant }) {
  const { t } = useTranslation('profit');
  const text = formatMargin(pct);
  if (!visible || !text) return null;
  return (
    <AppText variant={variant} muted numeric>
      {t('margin', { pct: text })}
    </AppText>
  );
}

/**
 * "2 items have no buying price: their profit is not counted." with an optional fix link.
 * Shown wherever a total leaves items out, so missing costs are never read as 100 % profit.
 */
export function UnknownCostNote({
  count,
  all = false,
  fixLabel,
  onFix,
  testID = 'profit-unknown',
  style,
}: {
  count: number;
  /** Every item is missing a buying price (there is no profit figure at all). */
  all?: boolean;
  fixLabel?: string;
  onFix?: () => void;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { t } = useTranslation('profit');
  const { space } = useTheme();
  if (count <= 0) return null;
  return (
    <View style={[{ gap: space.xs }, style]} testID={testID}>
      <View style={[styles.row, { gap: space.xs }]}>
        <Icon name="help-outline" size={18} tone="lowText" />
        <AppText variant="small" tone="lowText" style={styles.flex}>
          {all ? t('unknownAll', { count }) : t('unknownItems', { count })}
        </AppText>
      </View>
      {onFix ? (
        <>
          <Button label={fixLabel ?? t('addCost')} icon="edit" variant="ghost" size="sm" onPress={onFix} style={styles.start} testID={`${testID}-fix`} />
          {/* Each sale keeps the buying price it had when sold: adding one now only helps new sales. */}
          <AppText variant="caption" muted>
            {t('addCostHelp')}
          </AppText>
        </>
      ) : null}
    </View>
  );
}

/** Opens the Profit screen. */
export function openProfit(): void {
  router.push(PROFIT_PATH);
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1, minWidth: 0 },
  start: { alignSelf: 'flex-start' },
});
