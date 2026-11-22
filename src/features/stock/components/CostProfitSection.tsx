/**
 * Product detail, seller-only: buying price (design + colour overrides), profit at the current
 * rate, and the profit earned on this design so far. Hidden behind the eye toggle (hidden on
 * open: the seller may be showing the photos to a customer).
 */
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { ProductDetail } from '@/db/repo/productQueries';
import type { ProductProfit } from '@/db/repo/profit';
import { MarginText, ProfitAmount, UnknownCostNote } from '@/features/profit/components/ProfitBits';
import { formatMargin, formatProfit, profitState, rateMargin } from '@/features/profit/logic';
import { formatINR } from '@/lib/money';
import { AppText, Button, ColourSwatch, Divider, IconButton, warmShadow } from '@/ui/components';
import { useTheme } from '@/ui/theme';

export type CostProfitSectionProps = {
  detail: ProductDetail;
  profit: ProductProfit | null;
  visible: boolean;
  onToggle: () => void;
  onAddCost: () => void;
};

export function CostProfitSection({ detail, profit, visible, onToggle, onAddCost }: CostProfitSectionProps) {
  const { t } = useTranslation('stock');
  const { colors, space, radius, scheme } = useTheme();
  const { product, colours } = detail;
  const overrides = colours.filter((c) => c.costPaise !== null && c.costPaise !== undefined);
  const hasAnyCost = product.costPaise !== null || overrides.length > 0;

  return (
    <View
      testID="detail-cost"
      style={[
        styles.card,
        { marginHorizontal: space.lg, marginTop: space.md, padding: space.lg, gap: space.md, backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.card },
        warmShadow(scheme),
      ]}>
      <View style={[styles.row, { gap: space.md }]}>
        <View style={styles.flex} accessible accessibilityLabel={visible ? t('detail.costSection') : `${t('detail.costSection')}: ${t('detail.costHidden')}`}>
          <AppText variant="small" weight="semibold" muted>
            {t('detail.costSection')}
          </AppText>
          {!visible ? <AppText weight="semibold">{t('detail.costHidden')}</AppText> : null}
        </View>
        <IconButton
          icon={visible ? 'visibility-off' : 'visibility'}
          variant="tonal"
          accessibilityLabel={visible ? t('detail.hideCost') : t('detail.showCost')}
          onPress={onToggle}
          testID="detail-cost-toggle"
        />
      </View>

      {visible ? (
        <>
          <View style={{ gap: space.xxs }}>
            <AppText variant="caption" muted>
              {t('detail.cost')}
            </AppText>
            {product.costPaise !== null ? (
              <AppText variant="title" weight="bold" numeric testID="detail-cost-value">
                {formatINR(product.costPaise)}
              </AppText>
            ) : (
              <AppText weight="semibold" tone="lowText">
                {t('detail.costNone')}
              </AppText>
            )}
            <MarginLine ratePaise={product.ratePaise} costPaise={product.costPaise} />
            {overrides.map((c) => {
              const pct = formatMargin(rateMargin(product.ratePaise, c.costPaise ?? null)?.marginPct);
              return (
                <View key={c.id} style={[styles.row, { gap: space.xs }]}>
                  <ColourSwatch hex={c.hex} name={c.name} size={16} />
                  <AppText variant="small" numeric style={styles.flex}>
                    {t('detail.colourCost', { name: c.name, cost: formatINR(c.costPaise ?? 0) })}
                    {pct ? ` · ${pct}` : ''}
                  </AppText>
                </View>
              );
            })}
            {!hasAnyCost ? (
              <>
                <AppText variant="small" muted>
                  {t('detail.costNoneHelp')}
                </AppText>
                <Button label={t('detail.addCost')} icon="edit" variant="ghost" size="sm" onPress={onAddCost} style={styles.start} testID="detail-add-cost" />
              </>
            ) : (
              <AppText variant="caption" muted>
                {t('detail.costOnlyYou')}
              </AppText>
            )}
          </View>
          <Divider />
          <Earned profit={profit} />
        </>
      ) : null}
    </View>
  );
}

function MarginLine({ ratePaise, costPaise }: { ratePaise: number; costPaise: number | null }) {
  const { t } = useTranslation('stock');
  const m = rateMargin(ratePaise, costPaise);
  if (!m) return null;
  if (m.profitPaise < 0) {
    return (
      <AppText variant="small" tone="danger" weight="semibold" testID="detail-margin">
        {t('detail.marginLoss', { amount: formatINR(-m.profitPaise) })}
      </AppText>
    );
  }
  return (
    <AppText variant="small" numeric testID="detail-margin">
      {`${t('detail.marginAtRate')}: ${t('detail.marginLine', { profit: formatProfit(m.profitPaise), pct: formatMargin(m.marginPct) ?? '0%' })}`}
    </AppText>
  );
}

function Earned({ profit }: { profit: ProductProfit | null }) {
  const { t } = useTranslation('stock');
  const { space } = useTheme();
  const state = profit ? profitState(profit) : 'none';
  return (
    <View style={{ gap: space.xxs }} testID="detail-earned">
      <AppText variant="caption" muted>
        {t('detail.earned')}
      </AppText>
      {!profit || state === 'none' ? (
        <AppText muted>{t('detail.earnedNone')}</AppText>
      ) : state === 'unknown' ? (
        <AppText tone="lowText">{t('detail.earnedUnknown')}</AppText>
      ) : (
        <>
          <ProfitAmount paise={profit.profitPaise} visible variant="title" testID="detail-earned-value" />
          <MarginText pct={profit.marginPct} visible />
        </>
      )}
      {profit && state !== 'none' ? (
        <AppText variant="small" muted numeric>
          {t('detail.earnedSub', { count: profit.pieces, amount: formatINR(profit.revenuePaise) })}
        </AppText>
      ) : null}
      {profit && state === 'partial' ? <UnknownCostNote count={profit.unknownCostItems} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1, minWidth: 0 },
  start: { alignSelf: 'flex-start' },
});
