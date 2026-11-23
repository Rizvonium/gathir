/**
 * Sales tab: period and payment filters, the period's totals (rolling numbers), and sales
 * grouped by day with sticky day totals. Returned sales stay in the list, struck through.
 * Filters switch instantly (frequent action: no animation): the totals jump on a filter change
 * (RollingNumber snapKey) and roll only when a sale changes them.
 */
import { FlashList } from '@shopify/flash-list';
import { router, type Href } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { PAYMENT_METHODS, type PaymentMethod } from '@/db/schema';
import { formatINR, formatNumber } from '@/lib/money';
import { AppText, Button, ChipGroup, EmptyState, IconButton, RollingNumber, Screen } from '@/ui/components';
import { LoomEmptyState } from '@/ui/patterns';
import { useTheme } from '@/ui/theme';

import { openProfit, ProfitEyeToggle } from '@/features/profit/components/ProfitBits';
import { useProfitVisible } from '@/features/profit/privacy';

import { useSalesList, type SalesListActions, type SalesListModel } from '../hooks/useSalesList';
import { PAYMENT_ICONS, SALES_PERIODS, type SalesListItem, type SalesPeriod } from '../logic/salesList';
import { DayHeader, SaleRow } from './SaleRow';
import { SalesProfitLine } from './SalesProfitLine';

const SELL = '/sell' as const;
const saleHref = (id: string) => ({ pathname: '/sale/[id]', params: { id } }) as unknown as Href;

export function SalesScreen() {
  const { model, actions } = useSalesList();
  return <SalesView model={model} actions={actions} />;
}

export function SalesView({ model, actions }: { model: SalesListModel; actions: SalesListActions }) {
  const { space } = useTheme();
  const { t } = useTranslation('sales');
  const { t: tp } = useTranslation('profit');
  const profitVisible = useProfitVisible();
  const periodWord = t(`list.periodLower.${model.period}`);
  const openSale = (id: string) => router.push(saleHref(id));
  const sell = () => router.push(SELL);
  const ALL = 'all' as const;

  const filters = (
    <View style={{ gap: space.sm, paddingBottom: space.sm }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.lg }}>
        <ChipGroup<SalesPeriod>
          mode="single"
          testID="sales-period"
          accessibilityLabel={t('list.period')}
          options={SALES_PERIODS.map((p) => ({ value: p, label: t(`list.${p}`) }))}
          value={model.period}
          onChange={actions.setPeriod}
          style={styles.noWrap}
        />
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.lg }}>
        <ChipGroup<PaymentMethod | typeof ALL>
          mode="single"
          testID="sales-payment"
          accessibilityLabel={t('list.paymentFilter')}
          options={[
            { value: ALL, label: t('list.allPayments') },
            ...PAYMENT_METHODS.map((p) => ({ value: p, label: t(`payment.${p}`), icon: PAYMENT_ICONS[p] })),
          ]}
          value={model.payment ?? ALL}
          onChange={(v) => actions.setPayment(v === ALL ? null : v)}
          style={styles.noWrap}
        />
      </ScrollView>
    </View>
  );

  const filterKey = `${model.period}:${model.payment ?? 'all'}`;
  const salesWord = t('list.sales', { count: model.totals.count });
  const piecesWord = t('list.pieces', { count: model.totals.pieces });
  const summary = (
    <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.lg, gap: space.sm }}>
      <View
        testID="sales-summary"
        accessible
        accessibilityLabel={t('list.summaryA11y', { period: t(`list.${model.period}`), amount: formatINR(model.totals.amountPaise), sales: salesWord, pieces: piecesWord })}
        style={{ gap: space.xs }}>
        <AppText variant="small" muted>
          {t('list.summaryLabel', { period: periodWord })}
        </AppText>
        <RollingNumber value={model.totals.amountPaise} format={formatINR} variant="count" snapKey={filterKey} accessible={false} testID="sales-amount" />
        <View style={[styles.inline, { gap: space.xs }]}>
          <RollingNumber value={model.totals.pieces} format={formatNumber} variant="body" weight="semibold" snapKey={filterKey} accessible={false} />
          <AppText weight="semibold">{t('list.piecesWord', { count: model.totals.pieces })}</AppText>
          <AppText muted>·</AppText>
          <AppText muted>{salesWord}</AppText>
        </View>
      </View>
      {model.profit && model.totals.count > 0 ? <SalesProfitLine profit={model.profit} visible={profitVisible} onOpen={openProfit} /> : null}
    </View>
  );

  const renderItem = ({ item }: { item: SalesListItem }) =>
    item.type === 'day' ? <DayHeader day={item.day} today={model.today} totals={item} /> : <SaleRow sale={item.sale} onPress={openSale} />;

  return (
    <Screen
      title={t('list.title')}
      padded={false}
      testID="sales-screen"
      actions={
        <View style={styles.inlineCenter}>
          <ProfitEyeToggle testID="sales-profit-eye" />
          <IconButton icon="insights" accessibilityLabel={tp('openA11y')} onPress={openProfit} testID="sales-open-profit" />
        </View>
      }>
      {filters}
      {model.empty === 'none' ? (
        <FlashList
          data={model.items}
          renderItem={renderItem}
          keyExtractor={(item) => item.key}
          getItemType={(item) => item.type}
          stickyHeaderIndices={model.stickyIndices}
          ListHeaderComponent={summary}
          contentContainerStyle={{ paddingBottom: 96 }}
        />
      ) : (
        <SalesEmpty model={model} actions={actions} onSell={sell} />
      )}
      <View pointerEvents="box-none" style={[styles.fab, { end: space.lg, bottom: space.lg }]}>
        <Button label={t('list.sell')} icon="point-of-sale" size="lg" onPress={sell} testID="sales-sell" />
      </View>
    </Screen>
  );
}

function SalesEmpty({ model, actions, onSell }: { model: SalesListModel; actions: SalesListActions; onSell: () => void }) {
  const { t } = useTranslation('sales');
  const period = t(`list.periodLower.${model.period}`);
  switch (model.empty) {
    case 'never':
      return <EmptyState illustration={<LoomEmptyState />} title={t('list.emptyTitle')} body={t('list.emptyBody')} actionLabel={t('list.sell')} actionIcon="point-of-sale" onAction={onSell} />;
    case 'today':
      return <EmptyState title={t('list.emptyTodayTitle')} body={t('list.emptyTodayBody')} actionLabel={t('list.showAll')} actionIcon="history" onAction={() => actions.setPeriod('all')} />;
    case 'payment':
      return (
        <EmptyState
          title={t('list.emptyFilteredTitle', { payment: model.payment ? t(`payment.${model.payment}`) : '', period })}
          body={t('list.emptyFilteredBody')}
          actionLabel={t('list.showAllPayments')}
          onAction={() => actions.setPayment(null)}
        />
      );
    default:
      return <EmptyState title={t('list.emptyPeriodTitle', { period })} body={t('list.emptyPeriodBody')} actionLabel={t('list.showAll')} actionIcon="history" onAction={() => actions.setPeriod('all')} />;
  }
}

const styles = StyleSheet.create({
  noWrap: { flexWrap: 'nowrap' },
  inline: { flexDirection: 'row', alignItems: 'baseline' },
  inlineCenter: { flexDirection: 'row', alignItems: 'center' },
  fab: { position: 'absolute' },
});
