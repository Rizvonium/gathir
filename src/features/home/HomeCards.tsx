/** Home ("My Shop") building blocks. Each reads only what it is given. */
import { useRouter, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { DueFollowUp } from '@/db/repo/events';
import { formatINR, formatNumber } from '@/lib/money';
import { thumbUri } from '@/lib/photos';
import {
  AppText,
  Button,
  Card,
  Divider,
  Icon,
  IconButton,
  PieceBadge,
  PressableScale,
  RollingNumber,
  SectionHeader,
  Thumbnail,
  type IconName,
} from '@/ui/components';
import { PatternPlaceholder } from '@/ui/patterns';
import { useTheme } from '@/ui/theme';
import { touchTarget } from '@/ui/tokens';

import { dueCustomersHref } from '@/features/customers/logic/links';
import { MarginText, ProfitAmount } from '@/features/profit/components/ProfitBits';
import { formatMargin, formatProfit } from '@/features/profit/logic';
import { HIDDEN_FIGURE } from '@/features/profit/privacy';
import { attentionStockHref } from '@/features/stock/logic/links';

import type { AttentionItem, BackupReminder, Comparison, ReportStatus } from './homeLogic';

/* ---------- Stock ---------- */

export type StockCardProps = {
  pieces: number;
  designs: number;
  valuePaise: number;
  /** Seller-only: pieces × buying price for pieces that have one. Omit to leave the line out. */
  costValuePaise?: number;
  /** Pieces in stock without a buying price (left out of costValuePaise). */
  costUnknownPieces?: number;
  /** Profit figures shown (the shared eye toggle). */
  profitVisible?: boolean;
};

export function StockCard({ pieces, designs, valuePaise, costValuePaise, costUnknownPieces = 0, profitVisible = true }: StockCardProps) {
  const { t } = useTranslation('home');
  const { space } = useTheme();
  const router = useRouter();
  const showCost = costValuePaise !== undefined && pieces > 0;
  const costA11y = !showCost
    ? ''
    : !profitVisible
      ? ` ${t('stock.costHiddenA11y')}`
      : ` ${t('stock.costA11y', { value: formatINR(costValuePaise) })}${costUnknownPieces > 0 ? ` ${t('stock.costUnknown', { count: costUnknownPieces })}` : ''}`;
  return (
    <Card
      testID="home-stock"
      onPress={() => router.navigate('/stock')}
      accessibilityLabel={t('stock.a11y', { pieces: formatNumber(pieces), designs: formatNumber(designs), value: formatINR(valuePaise), cost: costA11y })}
      padding="xl">
      <View importantForAccessibility="no-hide-descendants" style={{ gap: space.lg }}>
        <View style={{ gap: space.xxs }}>
          <AppText variant="small" weight="semibold" muted>
            {t('stock.title')}
          </AppText>
          <View style={[styles.row, styles.baseline, { gap: space.sm }]}>
            <RollingNumber value={pieces} variant="count" accessible={false} testID="home-stock-pieces" />
            <AppText weight="semibold" muted style={styles.shrink}>
              {t('stock.piecesLabel', { count: pieces })}
            </AppText>
          </View>
        </View>
        <Divider />
        <View style={[styles.row, { gap: space.lg }]}>
          <Figure label={t('stock.designs')} value={designs} />
          <Figure label={showCost ? t('stock.valueAtRate') : t('stock.value')} value={valuePaise} format={formatINR} />
        </View>
        {showCost ? (
          <View style={{ gap: space.xxs }} testID="home-stock-cost">
            <View style={[styles.row, { gap: space.lg }]}>
              <View style={styles.flex} />
              <View style={styles.flex}>
                <AppText variant="caption" muted>
                  {t('stock.valueAtCost')}
                </AppText>
                {profitVisible ? (
                  <RollingNumber value={costValuePaise} format={formatINR} variant="title" accessible={false} testID="home-stock-cost-value" />
                ) : (
                  <AppText variant="title" muted>
                    {HIDDEN_FIGURE}
                  </AppText>
                )}
              </View>
            </View>
            {profitVisible && costUnknownPieces > 0 ? (
              <AppText variant="caption" tone="lowText" align="end">
                {t('stock.costUnknown', { count: costUnknownPieces })}
              </AppText>
            ) : null}
          </View>
        ) : null}
      </View>
    </Card>
  );
}

function Figure({ label, value, format }: { label: string; value: number; format?: (n: number) => string }) {
  return (
    <View style={styles.flex}>
      <AppText variant="caption" muted>
        {label}
      </AppText>
      <RollingNumber value={value} format={format} variant="title" accessible={false} />
    </View>
  );
}

/* ---------- Today ---------- */

export type TodayProfit = {
  profitPaise: number;
  marginPct: number | null;
  /** Items sold today without a buying price (their profit is not counted). */
  unknownItems: number;
};

export function TodayCard({
  pieces,
  amountPaise,
  compare,
  profit,
  profitVisible = true,
}: {
  pieces: number;
  amountPaise: number;
  compare: Comparison;
  /** Seller-only "Today's profit"; omit to leave the row out. */
  profit?: TodayProfit;
  profitVisible?: boolean;
}) {
  const { t } = useTranslation('home');
  const { colors, space } = useTheme();
  const router = useRouter();
  const nothingYet = pieces === 0 && compare.direction !== 'down';
  const compareText = nothingYet
    ? t('today.noneYet')
    : compare.direction === 'same'
      ? t('today.vsYesterdaySame')
      : t(compare.direction === 'up' ? 'today.vsYesterdayUp' : 'today.vsYesterdayDown', { value: formatINR(compare.diff) });
  const icon: IconName = nothingYet || compare.direction === 'same' ? 'trending-flat' : compare.direction === 'up' ? 'trending-up' : 'trending-down';
  const tone = compare.direction === 'up' && !nothingYet ? colors.meadow : colors.textMuted;
  const salesPart = (
    <View importantForAccessibility="no-hide-descendants" style={{ gap: space.md }}>
      <AppText variant="small" weight="semibold" muted>
        {t('today.title')}
      </AppText>
      <View style={[styles.row, { gap: space.lg }]}>
        <View style={styles.flex}>
          <RollingNumber value={pieces} variant="heading" accessible={false} />
          <AppText variant="caption" muted>
            {t('today.sold')}
          </AppText>
        </View>
        <View style={styles.flex2}>
          <RollingNumber value={amountPaise} format={formatINR} variant="heading" accessible={false} />
          <AppText variant="caption" muted>
            {t('today.amount')}
          </AppText>
        </View>
      </View>
      <View style={[styles.row, styles.center, { gap: space.xs }]}>
        <Icon name={icon} size={18} color={tone} />
        <AppText variant="small" color={tone} style={styles.flex} testID="home-today-compare">
          {compareText}
        </AppText>
      </View>
    </View>
  );
  const a11y = t('today.a11y', { pieces: formatNumber(pieces), amount: formatINR(amountPaise), compare: compareText });

  if (!profit) {
    return (
      <Card testID="home-today" onPress={() => router.navigate('/sales')} accessibilityLabel={a11y}>
        {salesPart}
      </Card>
    );
  }
  return (
    <Card testID="home-today" padding="none">
      <PressableScale
        testID="home-today-sales"
        onPress={() => router.navigate('/sales')}
        accessibilityRole="button"
        accessibilityLabel={a11y}
        style={{ padding: space.lg }}>
        {salesPart}
      </PressableScale>
      <Divider />
      <TodayProfitRow profit={profit} visible={profitVisible} soldToday={pieces > 0} />
    </Card>
  );
}

/** "Today's profit ₹5,000 · 38% margin" → the Profit screen. */
function TodayProfitRow({ profit, visible, soldToday }: { profit: TodayProfit; visible: boolean; soldToday: boolean }) {
  const { t } = useTranslation('home');
  const { space } = useTheme();
  const router = useRouter();
  const unknownAll = profit.unknownItems > 0 && profit.profitPaise === 0 && profit.marginPct === null;
  const margin = formatMargin(profit.marginPct);
  const value = !soldToday
    ? t('profit.noSales')
    : !visible
    ? t('profit.hidden')
    : unknownAll
      ? t('profit.unknown')
      : `${formatProfit(profit.profitPaise)}${margin ? `, ${t('profit.margin', { pct: margin })}` : ''}`;
  const unknownText = soldToday && visible && !unknownAll && profit.unknownItems > 0 ? t('profit.unknownItems', { count: profit.unknownItems }) : null;
  return (
    <PressableScale
      testID="home-today-profit"
      onPress={() => router.push('/profit')}
      accessibilityRole="button"
      accessibilityLabel={[`${t('profit.title')}: ${value}`, unknownText].filter(Boolean).join('. ')}
      accessibilityHint={t('profit.openHint')}
      style={[styles.row, styles.center, { gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, minHeight: 56 }]}>
      <View style={styles.flex} importantForAccessibility="no-hide-descendants">
        <AppText variant="caption" muted>
          {t('profit.title')}
        </AppText>
        {!soldToday ? (
          <AppText variant="small" muted>
            {t('profit.noSales')}
          </AppText>
        ) : visible && unknownAll ? (
          <AppText weight="semibold" tone="lowText">
            {t('profit.unknown')}
          </AppText>
        ) : (
          <View style={[styles.row, styles.baseline, { gap: space.sm }]}>
            <ProfitAmount paise={profit.profitPaise} visible={visible} variant="title" testID="home-today-profit-amount" />
            <MarginText pct={profit.marginPct} visible={visible} />
          </View>
        )}
        {unknownText ? (
          <AppText variant="caption" tone="lowText">
            {unknownText}
          </AppText>
        ) : null}
      </View>
      <Icon name="chevron-right" tone="textMuted" />
    </PressableScale>
  );
}

/* ---------- Quick actions ---------- */

const ACTIONS: { key: 'sell' | 'addProduct' | 'showroom' | 'catalogue'; icon: IconName; href: Href }[] = [
  { key: 'sell', icon: 'point-of-sale', href: '/sell' as Href },
  { key: 'addProduct', icon: 'add-a-photo', href: '/product/new' as Href },
  { key: 'showroom', icon: 'slideshow', href: '/showroom' as Href },
  { key: 'catalogue', icon: 'picture-as-pdf', href: '/catalogue' as Href },
];

/** 2×2 grid. Sell is the filled, primary tile: the most frequent job on Home. */
export function QuickActions() {
  const { t } = useTranslation('home');
  const { colors, space, radius } = useTheme();
  const router = useRouter();
  return (
    <View style={[styles.grid, { gap: space.md }]}>
      {ACTIONS.map((a) => {
        const primary = a.key === 'sell';
        const fg = primary ? colors.onPrimary : colors.text;
        return (
          <PressableScale
            key={a.key}
            testID={`home-action-${a.key}`}
            accessibilityLabel={t(`actions.${a.key}`)}
            onPress={() => router.push(a.href)}
            style={[
              styles.tile,
              {
                backgroundColor: primary ? colors.primary : colors.surface,
                borderColor: primary ? colors.primary : colors.border,
                borderRadius: radius.card,
                padding: space.lg,
                gap: space.sm,
              },
            ]}>
            <Icon name={a.icon} size={28} color={primary ? colors.onPrimary : colors.primary} />
            <AppText weight="bold" color={fg} numberOfLines={2}>
              {t(`actions.${a.key}`)}
            </AppText>
          </PressableScale>
        );
      })}
    </View>
  );
}

/* ---------- Needs attention ---------- */

const ATTENTION_SIZE = 104;

export function AttentionStrip({ items, total, lowStockLevel }: { items: AttentionItem[]; total: number; lowStockLevel: number }) {
  const { t } = useTranslation('home');
  const { space } = useTheme();
  const router = useRouter();
  if (items.length === 0) return null;
  return (
    <View testID="home-attention">
      <SectionHeader
        title={t('attention.title')}
        actionLabel={total > items.length || total > 3 ? t('attention.seeAll') : undefined}
        onAction={() => router.navigate(attentionStockHref(
            items.map((i) => i.status),
            total > items.length,
          ))}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -space.lg }}
        contentContainerStyle={{ paddingHorizontal: space.lg, gap: space.md }}>
        {items.map((p) => {
          const status = p.status === 'out' ? t('attention.soldOut') : t('attention.low', { count: p.totalPieces });
          return (
            <PressableScale
              key={p.id}
              testID={`home-attention-${p.id}`}
              accessibilityLabel={t('attention.a11y', { name: p.name, status })}
              onPress={() => router.push(`/product/${p.id}`)}
              style={{ width: ATTENTION_SIZE, gap: space.xs }}>
              {p.coverThumb ? (
                <Thumbnail uri={thumbUri(p.coverThumb)} size={ATTENTION_SIZE} rounded="md" />
              ) : (
                <PatternPlaceholder productId={p.id} name={p.name} width={ATTENTION_SIZE} height={ATTENTION_SIZE} radius={12} />
              )}
              <AppText variant="caption" weight="semibold" numberOfLines={2}>
                {p.name}
              </AppText>
              <PieceBadge count={p.totalPieces} lowThreshold={lowStockLevel} size="sm" subjectId={p.id} />
            </PressableScale>
          );
        })}
      </ScrollView>
    </View>
  );
}

/* ---------- Owner report ---------- */

export function ReportCard({ status }: { status: ReportStatus }) {
  const { t } = useTranslation('home');
  const { space } = useTheme();
  const router = useRouter();
  const sent =
    status.kind === 'never'
      ? t('report.never')
      : status.daysAgo === 0
        ? t('report.sentToday')
        : status.daysAgo === 1
          ? t('report.sentYesterday')
          : t('report.sentDaysAgo', { count: status.daysAgo });
  const newSales = status.newSales === 0 ? t('report.newSales_zero') : t('report.newSales', { count: status.newSales });
  return (
    <Card testID="home-report">
      <View style={{ gap: space.md }}>
        <View style={[styles.row, { gap: space.md }]}>
          <Icon name="send" tone="teal" />
          <View style={styles.flex} accessible accessibilityLabel={`${t('report.title')}. ${sent}. ${newSales}`}>
            <AppText variant="title" accessibilityRole="header">
              {t('report.title')}
            </AppText>
            <AppText muted testID="home-report-status">
              {sent}
            </AppText>
            {status.kind === 'sent' || status.newSales > 0 ? (
              <AppText weight="semibold" tone={status.newSales > 0 ? 'text' : 'textMuted'}>
                {newSales}
              </AppText>
            ) : null}
          </View>
        </View>
        <Button
          testID="home-report-send"
          label={status.kind === 'never' ? t('report.sendFirst') : t('report.send')}
          icon="send"
          variant={status.newSales > 0 || status.kind === 'never' ? 'primary' : 'secondary'}
          fullWidth
          onPress={() => router.push('/report')}
        />
      </View>
    </Card>
  );
}

/* ---------- Follow-ups ---------- */

const MAX_FOLLOW_UPS = 5;

export function FollowUps({
  items,
  onMessage,
  onDone,
}: {
  items: DueFollowUp[];
  onMessage: (f: DueFollowUp) => void;
  onDone: (f: DueFollowUp) => void;
}) {
  const { t } = useTranslation('home');
  const { space } = useTheme();
  const router = useRouter();
  if (items.length === 0) return null;
  const shown = items.slice(0, MAX_FOLLOW_UPS);
  return (
    <View testID="home-followups">
      <SectionHeader
        title={t('followUps.title')}
        actionLabel={items.length > MAX_FOLLOW_UPS ? t('attention.seeAll') : undefined}
        onAction={() => router.navigate(dueCustomersHref())}
      />
      <Card padding="none">
        {shown.map((f, i) => (
          <View key={f.eventId}>
            {i > 0 ? <Divider inset={16} /> : null}
            <View style={[styles.row, styles.center, { paddingStart: space.lg, paddingEnd: space.sm, paddingVertical: space.sm, gap: space.xs, minHeight: 64 }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={f.note ? `${f.customerName}, ${f.note}` : f.customerName}
                onPress={() => router.push(`/customer/${f.customerId}`)}
                style={({ pressed }) => [styles.flex, { opacity: pressed ? 0.6 : 1, minHeight: touchTarget, justifyContent: 'center' }]}>
                <AppText weight="semibold" numberOfLines={1}>
                  {f.customerName}
                </AppText>
                {f.note ? (
                  <AppText variant="small" muted numberOfLines={2}>
                    {f.note}
                  </AppText>
                ) : !f.phone ? (
                  <AppText variant="small" muted>
                    {t('followUps.noPhone')}
                  </AppText>
                ) : null}
              </Pressable>
              <IconButton
                testID={`home-followup-wa-${f.eventId}`}
                icon="chat"
                variant="tonal"
                disabled={!f.phone}
                accessibilityLabel={t('followUps.whatsapp', { name: f.customerName })}
                onPress={() => onMessage(f)}
              />
              <IconButton
                testID={`home-followup-done-${f.eventId}`}
                icon="check"
                accessibilityLabel={t('followUps.done', { name: f.customerName })}
                onPress={() => onDone(f)}
              />
            </View>
          </View>
        ))}
      </Card>
    </View>
  );
}

/* ---------- Sample data and backup ---------- */

export function SampleBanner({ onClear }: { onClear: () => void }) {
  const { t } = useTranslation('home');
  const { colors, space, radius } = useTheme();
  return (
    <View
      testID="home-sample"
      style={[styles.row, styles.center, { backgroundColor: colors.surfaceSunken, borderColor: colors.saffron, borderWidth: 1, borderRadius: radius.md, paddingStart: space.md, paddingEnd: space.xs, gap: space.sm, minHeight: 56 }]}>
      <Icon name="auto-awesome" size={20} color={colors.lowText} />
      <AppText variant="small" weight="semibold" style={styles.flex}>
        {t('sample.banner')}
      </AppText>
      <Button testID="home-sample-clear" label={t('sample.clear')} variant="ghost" size="sm" accessibilityHint={t('sample.clearA11y')} onPress={onClear} />
    </View>
  );
}

export function BackupCard({ reminder }: { reminder: BackupReminder }) {
  const { t } = useTranslation('home');
  const { space } = useTheme();
  const router = useRouter();
  if (reminder.kind === 'none') return null;
  const title = reminder.kind === 'never' ? t('backup.never') : t('backup.old', { count: reminder.daysAgo });
  const body = reminder.kind === 'never' ? t('backup.neverBody') : t('backup.oldBody');
  return (
    <Card testID="home-backup">
      <View style={{ gap: space.md }}>
        <View style={[styles.row, { gap: space.md }]}>
          <Icon name="backup" tone="indigo" />
          <View style={styles.flex}>
            <AppText variant="title" accessibilityRole="header">
              {title}
            </AppText>
            <AppText muted>{body}</AppText>
          </View>
        </View>
        <Button label={t('backup.action')} icon="cloud-upload" variant="secondary" fullWidth onPress={() => router.push('/backup')} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  center: { alignItems: 'center' },
  baseline: { alignItems: 'flex-end', flexWrap: 'wrap' },
  flex: { flex: 1, minWidth: 0 },
  flex2: { flex: 2, minWidth: 0 },
  shrink: { flexShrink: 1, paddingBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  tile: { flexBasis: '46%', flexGrow: 1, minHeight: 96, borderWidth: 1, justifyContent: 'space-between' },
});
