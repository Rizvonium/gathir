/**
 * "Profit on this sale ₹2,500 (38%)" under the Sell button: small, seller-only, follows the
 * shared eye toggle. Turns into a warning (icon + words + red) when an item is priced below its
 * buying price, and says "Profit unknown" (never ₹0 or 100 %) when no buying price is saved.
 */
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ProfitEyeToggle } from '@/features/profit/components/ProfitBits';
import { formatMargin, formatProfit, profitState, profitTone, type CartProfit } from '@/features/profit/logic';
import { HIDDEN_FIGURE } from '@/features/profit/privacy';
import { AppText, Icon } from '@/ui/components';
import { useTheme } from '@/ui/theme';

export function SellProfit({ profit, visible, testID = 'sell-profit' }: { profit: CartProfit; visible: boolean; testID?: string }) {
  const { t } = useTranslation('profit');
  const { colors, space, radius } = useTheme();
  const state = profitState(profit);
  if (state === 'none') return null;

  const warn = visible && (profit.belowCost || profit.loss);
  const margin = formatMargin(profit.marginPct);
  const amount = state === 'unknown' ? null : `${formatProfit(profit.profitPaise)}${margin ? ` (${margin})` : ''}`;

  let text: string;
  if (!visible) text = `${t('sell.line')} ${HIDDEN_FIGURE}`;
  else if (state === 'unknown') text = t('sell.unknown');
  else text = `${t('sell.line')} ${amount}`;
  const a11y = !visible
    ? `${t('sell.line')}: ${t('hidden')}`
    : state === 'unknown'
      ? t('sell.unknown')
      : t('sell.lineA11y', { amount: formatProfit(profit.profitPaise), margin: margin ? `, ${t('margin', { pct: margin })}` : '' });

  return (
    <View
      testID={testID}
      style={[
        styles.row,
        { gap: space.xs, paddingStart: space.sm, borderRadius: radius.md },
        warn ? { backgroundColor: colors.surfaceSunken, borderColor: colors.danger, borderWidth: 1 } : null,
      ]}>
      <Icon name={warn ? 'warning-amber' : state === 'unknown' && visible ? 'help-outline' : 'trending-up'} size={18} tone={warn ? 'danger' : 'textMuted'} />
      <View style={styles.flex} accessible accessibilityLabel={warn ? `${t('sell.belowCost')}. ${a11y}` : a11y} accessibilityLiveRegion="polite">
        {warn ? (
          <AppText variant="small" weight="bold" tone="danger" testID={`${testID}-warning`}>
            {t('sell.belowCost')}
          </AppText>
        ) : null}
        <AppText
          variant="small"
          numeric
          weight={state === 'unknown' ? 'regular' : 'semibold'}
          tone={!visible || state === 'unknown' ? 'textMuted' : warn ? 'danger' : profitTone(profit.profitPaise) === 'meadow' ? 'text' : profitTone(profit.profitPaise)}
          testID={`${testID}-text`}>
          {text}
        </AppText>
        {visible && state === 'partial' ? (
          <AppText variant="caption" muted>
            {t('sell.partial', { count: profit.unknownCostItems })}
          </AppText>
        ) : null}
      </View>
      <ProfitEyeToggle testID={`${testID}-eye`} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1, minWidth: 0 },
});
