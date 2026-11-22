/**
 * Sales tab: the period's profit and margin next to the money taken. Seller-only, follows the
 * shared eye toggle; taps through to the Profit screen. Items without a buying price are left
 * out and said so ("profit unknown"), never counted as 100 % profit.
 */
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { ProfitTotals } from '@/db/repo/profitMath';
import { MarginText, ProfitAmount } from '@/features/profit/components/ProfitBits';
import { formatMargin, formatProfit, profitState } from '@/features/profit/logic';
import { AppText, Icon, PressableScale } from '@/ui/components';
import { useTheme } from '@/ui/theme';

export function SalesProfitLine({ profit, visible, onOpen }: { profit: ProfitTotals; visible: boolean; onOpen: () => void }) {
  const { t } = useTranslation('profit');
  const { colors, space, radius } = useTheme();
  const state = profitState(profit);
  if (state === 'none') return null;
  const margin = formatMargin(profit.marginPct);
  const value = !visible
    ? t('hidden')
    : state === 'unknown'
      ? t('unknown')
      : `${formatProfit(profit.profitPaise)}${margin ? `, ${t('margin', { pct: margin })}` : ''}`;
  const unknown = visible && state === 'partial' ? t('unknownShort', { count: profit.unknownCostItems }) : null;

  return (
    <PressableScale
      testID="sales-profit"
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={[`${t('label')}: ${value}`, unknown].filter(Boolean).join('. ')}
      accessibilityHint={t('openA11y')}
      style={[styles.row, { gap: space.md, padding: space.md, minHeight: 56, borderRadius: radius.md, backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Icon name="insights" tone="meadow" />
      <View style={styles.flex}>
        <AppText variant="caption" muted>
          {t('label')}
        </AppText>
        {state === 'unknown' && visible ? (
          <AppText weight="semibold" tone="lowText" testID="sales-profit-unknown">
            {t('unknown')}
          </AppText>
        ) : (
          <View style={[styles.baseline, { gap: space.sm }]}>
            <ProfitAmount paise={profit.profitPaise} visible={visible} variant="title" testID="sales-profit-amount" />
            <MarginText pct={profit.marginPct} visible={visible} />
          </View>
        )}
        {unknown ? (
          <AppText variant="caption" tone="lowText">
            {unknown}
          </AppText>
        ) : null}
      </View>
      <Icon name="chevron-right" tone="textMuted" />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  baseline: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' },
  flex: { flex: 1, minWidth: 0 },
});
