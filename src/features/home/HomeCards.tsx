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

import type { AttentionItem, BackupReminder, Comparison, ReportStatus } from './homeLogic';

/* ---------- Stock ---------- */

export function StockCard({ pieces, designs, valuePaise }: { pieces: number; designs: number; valuePaise: number }) {
  const { t } = useTranslation('home');
  const { space } = useTheme();
  const router = useRouter();
  return (
    <Card
      testID="home-stock"
      onPress={() => router.navigate('/stock')}
      accessibilityLabel={t('stock.a11y', { pieces: formatNumber(pieces), designs: formatNumber(designs), value: formatINR(valuePaise) })}
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
          <Figure label={t('stock.value')} value={valuePaise} format={formatINR} />
        </View>
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

export function TodayCard({ pieces, amountPaise, compare }: { pieces: number; amountPaise: number; compare: Comparison }) {
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
  return (
    <Card
      testID="home-today"
      onPress={() => router.navigate('/sales')}
      accessibilityLabel={t('today.a11y', { pieces: formatNumber(pieces), amount: formatINR(amountPaise), compare: compareText })}>
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
    </Card>
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
        onAction={() => router.navigate('/stock')}
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
              onPress={() => router.push(`/product/${p.id}` as Href)}
              style={{ width: ATTENTION_SIZE, gap: space.xs }}>
              {p.coverThumb ? (
                <Thumbnail uri={thumbUri(p.coverThumb)} size={ATTENTION_SIZE} rounded="md" />
              ) : (
                <PatternPlaceholder productId={p.id} name={p.name} width={ATTENTION_SIZE} height={ATTENTION_SIZE} radius={12} />
              )}
              <AppText variant="caption" weight="semibold" numberOfLines={2}>
                {p.name}
              </AppText>
              <PieceBadge count={p.totalPieces} lowThreshold={lowStockLevel} size="sm" />
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
          onPress={() => router.push('/report' as Href)}
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
        onAction={() => router.navigate('/customers')}
      />
      <Card padding="none">
        {shown.map((f, i) => (
          <View key={f.eventId}>
            {i > 0 ? <Divider inset={16} /> : null}
            <View style={[styles.row, styles.center, { paddingStart: space.lg, paddingEnd: space.sm, paddingVertical: space.sm, gap: space.xs, minHeight: 64 }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={f.note ? `${f.customerName}, ${f.note}` : f.customerName}
                onPress={() => router.push(`/customer/${f.customerId}` as Href)}
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
        <Button label={t('backup.action')} icon="cloud-upload" variant="secondary" fullWidth onPress={() => router.push('/backup' as Href)} />
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
