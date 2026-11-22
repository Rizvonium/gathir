/**
 * /profit (PLAN §3 "Buying price & profit"): seller-only. Period chips, the period's totals
 * (sales, bought for, profit, margin, items without a buying price) and breakdowns by day,
 * design, category and customer. Chips switch instantly (frequent peer switch: no animation).
 */
import { FlashList } from '@shopify/flash-list';
import { router, type Href } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import type { ProfitGroupRow } from '@/db/repo/profit';
import { isDayInRange, recentDays } from '@/features/report/period';
import { ProductThumb } from '@/features/sales/components/SaleBits';
import { addDays, formatDate, formatDay } from '@/lib/dates';
import { formatINR, formatNumber } from '@/lib/money';
import { AppText, Avatar, Card, Chip, ChipGroup, EmptyState, Icon, IconButton, PressableScale, Screen } from '@/ui/components';
import { useTheme } from '@/ui/theme';

import { useProfitScreen, type ProfitScreenActions, type ProfitScreenModel } from '../hooks/useProfitScreen';
import { barShare, BREAKDOWN_TABS, formatMargin, formatProfit, PROFIT_PERIODS, profitState, type BreakdownTab } from '../logic';
import { useProfitVisible } from '../privacy';
import { MarginText, ProfitAmount, ProfitEyeToggle, UnknownCostNote } from './ProfitBits';

const productHref = (id: string) => ({ pathname: '/product/[id]', params: { id } }) as unknown as Href;
const editHref = (id: string) => ({ pathname: '/product/[id]/edit', params: { id } }) as unknown as Href;
const customerHref = (id: string) => ({ pathname: '/customer/[id]', params: { id } }) as unknown as Href;

export function ProfitScreen() {
  const { model, actions } = useProfitScreen();
  return <ProfitView model={model} actions={actions} />;
}

export function ProfitView({ model, actions }: { model: ProfitScreenModel; actions: ProfitScreenActions }) {
  const { t } = useTranslation('profit');
  const { space } = useTheme();
  const visible = useProfitVisible();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/sales'));
  const empty = profitState(model.summary) === 'none';

  const header = (
    <View style={{ gap: space.lg, paddingBottom: space.md }}>
      <PeriodChips model={model} actions={actions} />
      <TotalsCard model={model} actions={actions} visible={visible} />
      {!empty ? (
        <View style={{ gap: space.sm }}>
          <AppText variant="title" accessibilityRole="header" style={{ paddingHorizontal: space.lg }}>
            {t('breakdown.title')}
          </AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.lg }}>
            <ChipGroup<BreakdownTab>
              mode="single"
              testID="profit-tab"
              accessibilityLabel={t('breakdown.title')}
              options={BREAKDOWN_TABS.map((k) => ({ value: k, label: t(`breakdown.${k}`) }))}
              value={model.tab}
              onChange={actions.setTab}
              style={styles.noWrap}
            />
          </ScrollView>
          {model.missingOnly ? (
            <View style={[styles.row, { paddingHorizontal: space.lg }]}>
              <Chip testID="profit-missing-clear" label={t('breakdown.missingOnly')} icon="close" selected onPress={actions.clearMissing} />
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  return (
    <Screen
      title={t('title')}
      subtitle={t('subtitle')}
      padded={false}
      edges={['top', 'bottom']}
      leading={<IconButton icon="arrow-back" accessibilityLabel={t('back')} onPress={back} testID="profit-back" />}
      actions={<ProfitEyeToggle />}
      testID="profit-screen">
      <FlashList
        data={empty ? [] : model.rows}
        keyExtractor={(r) => `${model.tab}-${r.key}`}
        renderItem={({ item }) => <BreakdownRow row={item} tab={model.tab} model={model} visible={visible} />}
        ListHeaderComponent={header}
        ListEmptyComponent={
          empty ? (
            <EmptyState title={t('empty.title')} body={t('empty.body')} />
          ) : (
            <AppText muted align="center" style={{ padding: space.xl }}>
              {t('breakdown.none')}
            </AppText>
          )
        }
        contentContainerStyle={{ paddingBottom: space.xxxl }}
      />
    </Screen>
  );
}

function PeriodChips({ model, actions }: { model: ProfitScreenModel; actions: ProfitScreenActions }) {
  const { t } = useTranslation('profit');
  const { space } = useTheme();
  const days = recentDays(model.today);
  const dayLabel = (i: number, day: number) => (i === 0 ? t('period.today') : i === 1 ? t('period.yesterday') : formatDay(day));
  return (
    <View style={{ gap: space.sm }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.lg }}>
        <ChipGroup
          mode="single"
          testID="profit-period"
          accessibilityLabel={t('period.label')}
          options={PROFIT_PERIODS.map((p) => ({ value: p, label: t(`period.${p}`), icon: p === 'custom' ? 'date-range' : undefined }))}
          value={model.period}
          onChange={actions.setPeriod}
          style={styles.noWrap}
        />
      </ScrollView>
      {model.period === 'custom' ? (
        <View style={{ gap: space.xs }}>
          <AppText variant="small" muted style={{ paddingHorizontal: space.lg }}>
            {t('period.customHint')}
          </AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.lg, gap: space.sm }}>
            {days.map((day, i) => (
              <Chip
                key={day}
                testID={`profit-day-${i}`}
                role="checkbox"
                label={dayLabel(i, day)}
                selected={isDayInRange(day, model.customFrom, model.customTo)}
                onPress={() => actions.pickDay(day)}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

function TotalsCard({ model, actions, visible }: { model: ProfitScreenModel; actions: ProfitScreenActions; visible: boolean }) {
  const { t } = useTranslation('profit');
  const { space } = useTheme();
  const s = model.summary;
  const state = profitState(s);
  const range = t('period.range', { from: formatDate(model.range.from), to: formatDate(model.range.to) });
  const margin = formatMargin(s.marginPct);
  const a11y =
    state === 'none'
      ? `${range}. ${t('empty.title')}`
      : !visible
        ? `${range}. ${t('hidden')}`
        : state === 'unknown'
          ? `${range}. ${t('totals.revenue')} ${formatINR(s.revenuePaise)}. ${t('unknown')}`
          : `${range}. ${t('totals.profit')} ${formatProfit(s.profitPaise)}${margin ? `, ${t('margin', { pct: margin })}` : ''}. ${t('totals.revenue')} ${formatINR(s.revenuePaise)}. ${t('totals.cost')} ${formatINR(s.knownCostPaise)}.`;

  return (
    <Card padding="lg" style={{ marginHorizontal: space.lg }} testID="profit-totals">
      <View style={{ gap: space.md }}>
        <View accessible accessibilityLabel={a11y} style={{ gap: space.xs }}>
          <AppText variant="small" muted importantForAccessibility="no">
            {range}
          </AppText>
          {state === 'none' ? (
            <AppText variant="title" importantForAccessibility="no">
              {t('empty.title')}
            </AppText>
          ) : (
            <>
              <AppText variant="small" weight="semibold" muted importantForAccessibility="no">
                {t('totals.profit')}
              </AppText>
              {state === 'unknown' && visible ? (
                <AppText variant="heading" tone="lowText" testID="profit-total-unknown">
                  {t('unknown')}
                </AppText>
              ) : (
                <ProfitAmount paise={s.profitPaise} visible={visible} variant="count" testID="profit-total" />
              )}
              <MarginText pct={state === 'unknown' ? null : s.marginPct} visible={visible} variant="body" />
            </>
          )}
        </View>
        {state !== 'none' ? (
          <View style={[styles.row, { gap: space.lg }]} importantForAccessibility="no-hide-descendants">
            <Figure label={t('totals.revenue')} value={formatINR(s.revenuePaise)} />
            <Figure label={t('totals.cost')} value={visible ? formatINR(s.knownCostPaise) : '••••'} />
            <Figure label={t('totals.pieces')} value={formatNumber(s.pieces)} />
          </View>
        ) : null}
        {visible ? (
          <UnknownCostNote
            count={s.unknownCostItems}
            all={state === 'unknown'}
            fixLabel={t('totals.showMissing')}
            onFix={actions.showMissing}
            testID="profit-totals-unknown"
          />
        ) : null}
      </View>
    </Card>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.flex}>
      <AppText variant="caption" muted numberOfLines={1}>
        {label}
      </AppText>
      <AppText weight="semibold" numeric numberOfLines={1}>
        {value}
      </AppText>
    </View>
  );
}

function rowLabel(row: ProfitGroupRow, tab: BreakdownTab, today: number, t: TFunction<'profit'>): string {
  if (tab === 'day') {
    const at = row.at ?? 0;
    if (at === today) return t('period.today');
    if (at === addDays(today, -1)) return t('period.yesterday');
    return formatDate(at);
  }
  if (row.label) return row.label;
  if (tab === 'category') return t('breakdown.noCategory');
  if (tab === 'customer') return t('breakdown.walkIn');
  return t('breakdown.unnamed');
}

function BreakdownRow({ row, tab, model, visible }: { row: ProfitGroupRow; tab: BreakdownTab; model: ProfitScreenModel; visible: boolean }) {
  const { t } = useTranslation('profit');
  const { colors, space, radius } = useTheme();
  const label = rowLabel(row, tab, model.today, t);
  const allUnknown = profitState(row) === 'unknown';
  const sub = t('breakdown.sub', { amount: formatINR(row.revenuePaise), pieces: t('breakdown.pieces', { count: row.pieces }) });
  const margin = formatMargin(row.marginPct);
  const share = barShare(row.profitPaise, model.rows);
  const live = tab === 'product' && model.liveProducts.has(row.key);

  const onPress =
    tab === 'product' && live
      ? () => router.push(productHref(row.key))
      : tab === 'customer' && row.key
        ? () => router.push(customerHref(row.key))
        : undefined;

  const profitText = !visible ? t('hidden') : allUnknown ? t('unknown') : `${formatProfit(row.profitPaise)}${margin ? `, ${t('margin', { pct: margin })}` : ''}`;
  const unknownText = visible && row.unknownCostItems > 0 && !allUnknown ? t('unknownShort', { count: row.unknownCostItems }) : null;
  const a11y = [label, sub, profitText, unknownText].filter(Boolean).join('. ');

  const leading =
    tab === 'product' ? (
      <ProductThumb productId={row.key} name={label} thumb={model.thumbs.get(row.key) ?? null} size={48} recyclingKey={row.key} />
    ) : tab === 'customer' ? (
      <Avatar name={row.key ? label : '?'} color={row.key ? colors.teal : colors.indigo} size={48} />
    ) : (
      <View style={[styles.iconBox, { backgroundColor: colors.surfaceSunken, borderRadius: radius.md }]}>
        <Icon name={tab === 'day' ? 'calendar-today' : 'category'} tone="textMuted" />
      </View>
    );

  const body = (
    <View style={[styles.row, { gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.sm, minHeight: 72 }]}>
      {leading}
      <View style={[styles.flex, { gap: space.xxs }]}>
        <AppText weight="semibold" numberOfLines={2}>
          {label}
        </AppText>
        <AppText variant="small" muted numeric numberOfLines={1}>
          {sub}
        </AppText>
        {visible && share > 0 ? (
          <View style={[styles.track, { backgroundColor: colors.surfaceSunken, borderRadius: radius.pill }]}>
            <View style={[styles.bar, { width: `${Math.round(share * 100)}%`, backgroundColor: colors.meadow, borderRadius: radius.pill }]} />
          </View>
        ) : null}
        {unknownText ? (
          <AppText variant="caption" tone="lowText">
            {unknownText}
          </AppText>
        ) : null}
      </View>
      <View style={styles.end}>
        {allUnknown && visible ? (
          <AppText variant="small" tone="lowText" align="end">
            {t('unknown')}
          </AppText>
        ) : (
          <ProfitAmount paise={row.profitPaise} visible={visible} variant="body" />
        )}
        <MarginText pct={allUnknown ? null : row.marginPct} visible={visible} variant="caption" />
        {tab === 'product' && live && visible && row.unknownCostItems > 0 ? (
          <PressableScale
            testID={`profit-fix-${row.key}`}
            accessibilityRole="button"
            accessibilityLabel={t('breakdown.addCostFor', { name: label })}
            onPress={() => router.push(editHref(row.key))}
            style={[styles.fix, { paddingVertical: space.xs }]}>
            <AppText variant="small" weight="semibold" tone="primary">
              {t('addCost')}
            </AppText>
          </PressableScale>
        ) : null}
      </View>
    </View>
  );

  if (!onPress) {
    return (
      <View accessible accessibilityLabel={a11y} testID={`profit-row-${row.key || 'none'}`}>
        {body}
      </View>
    );
  }
  const canFix = tab === 'product' && live && visible && row.unknownCostItems > 0;
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      // TalkBack reads the row as one item, so the inner "Add buying price" link is offered as an action.
      accessibilityActions={canFix ? [{ name: 'addCost', label: t('addCost') }] : undefined}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'addCost') router.push(editHref(row.key));
      }}
      testID={`profit-row-${row.key || 'none'}`}>
      {body}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  noWrap: { flexWrap: 'nowrap' },
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1, minWidth: 0 },
  end: { alignItems: 'flex-end', maxWidth: '45%' },
  iconBox: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  track: { height: 4, marginTop: 2, overflow: 'hidden' },
  bar: { height: 4 },
  fix: { minHeight: 48, justifyContent: 'center' },
});
