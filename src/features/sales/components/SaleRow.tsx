/** One sale in the Sales list, and the sticky day header with that day's total. */
import type { TFunction } from 'i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { SaleListRow } from '@/db/repo/saleQueries';
import { formatDay, formatTime } from '@/lib/dates';
import { formatINR } from '@/lib/money';
import { AppText, Icon } from '@/ui/components';
import { useTheme } from '@/ui/theme';

import { dayLabel, itemSummary, type SalesTotals } from '../logic/salesList';
import { PaymentLabel, ProductThumb } from './SaleBits';

type T = TFunction<'sales'>;

/** "Sozni stole (Red) × 2" plus "+1 more". */
export function saleItemsText(t: T, items: SaleListRow['items']): { main: string; more: string | null } {
  const s = itemSummary(items);
  if (!s) return { main: '', more: null };
  return {
    main: t('sell.cartLine', { name: s.name, colour: s.colour, qty: s.qty }),
    more: s.more > 0 ? t('list.more', { count: s.more }) : null,
  };
}

export function SaleRow({ sale, onPress }: { sale: SaleListRow; onPress: (id: string) => void }) {
  const { colors, space, radius } = useTheme();
  const { t } = useTranslation('sales');
  const returned = sale.cancelledAt !== null;
  const first = sale.items[0];
  const second = sale.items[1];
  const items = saleItemsText(t, sale.items);
  const itemsText = items.more ? `${items.main} ${items.more}` : items.main;
  const customer = sale.customerName ?? t('walkIn');
  const time = formatTime(sale.createdAt);
  const amount = formatINR(sale.totalPaise);
  const a11y = returned
    ? t('list.rowReturnedA11y', { items: itemsText, customer, time, amount })
    : t('list.rowA11y', { items: itemsText, customer, time, amount, payment: t(`payment.${sale.payment}`) });

  return (
    <Pressable
      testID={`sale-row-${sale.id}`}
      onPress={() => onPress(sale.id)}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => [
        styles.row,
        { paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.md },
        pressed && { backgroundColor: colors.surfaceSunken },
      ]}>
      <View style={[styles.thumbs, returned && styles.dim]}>
        {second ? (
          <View style={[styles.back, { borderRadius: radius.md, borderColor: colors.bg }]}>
            <ProductThumb productId={second.productId} name={second.productNameSnapshot} thumb={second.photoSnapshotName} size={44} recyclingKey={`${sale.id}-2`} />
          </View>
        ) : null}
        {first ? (
          <View style={[styles.front, { borderRadius: radius.md, borderColor: colors.bg }]}>
            <ProductThumb productId={first.productId} name={first.productNameSnapshot} thumb={first.photoSnapshotName} size={52} recyclingKey={`${sale.id}-1`} />
          </View>
        ) : null}
      </View>
      <View style={styles.text}>
        <AppText weight="semibold" numberOfLines={1} muted={returned}>
          {items.main}
        </AppText>
        <AppText variant="small" muted numberOfLines={1}>
          {items.more ? `${items.more} · ` : ''}
          {customer} · {time}
        </AppText>
      </View>
      <View style={[styles.end, { gap: space.xxs }]}>
        <AppText
          weight="bold"
          numeric
          muted={returned}
          style={returned ? styles.struck : undefined}
          testID={`sale-amount-${sale.id}`}>
          {amount}
        </AppText>
        {returned ? (
          <View style={[styles.inline, { gap: space.xs }]}>
            <Icon name="undo" size={16} tone="danger" />
            <AppText variant="small" tone="danger" weight="semibold">
              {t('list.returned')}
            </AppText>
          </View>
        ) : (
          <PaymentLabel payment={sale.payment} />
        )}
      </View>
    </Pressable>
  );
}

export function DayHeader({ day, today, totals }: { day: number; today: number; totals: SalesTotals }) {
  const { colors, space } = useTheme();
  const { t } = useTranslation('sales');
  const label = dayLabel(day, today);
  const name = label.kind === 'today' ? t('list.dayToday') : label.kind === 'yesterday' ? t('list.dayYesterday') : formatDay(day);
  const amount = formatINR(totals.amountPaise);
  const pieces = t('list.pieces', { count: totals.pieces });
  return (
    <View
      testID={`day-${day}`}
      accessible
      accessibilityRole="header"
      accessibilityLabel={t('list.dayA11y', { day: name, amount, pieces })}
      style={[styles.day, { backgroundColor: colors.bg, paddingHorizontal: space.lg, paddingVertical: space.sm, borderBottomColor: colors.border }]}>
      <AppText weight="bold" style={styles.text}>
        {name}
      </AppText>
      <AppText variant="small" weight="semibold" muted numeric>
        {t('list.dayTotal', { amount, pieces })}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 72 },
  thumbs: { width: 60, height: 56, justifyContent: 'center' },
  back: { position: 'absolute', end: 0, top: 0, borderWidth: 2, overflow: 'hidden', opacity: 0.8 },
  front: { position: 'absolute', start: 0, bottom: 0, borderWidth: 2, overflow: 'hidden' },
  dim: { opacity: 0.6 },
  text: { flex: 1, minWidth: 0 },
  end: { alignItems: 'flex-end' },
  inline: { flexDirection: 'row', alignItems: 'center' },
  struck: { textDecorationLine: 'line-through' },
  day: { flexDirection: 'row', alignItems: 'center', minHeight: 44, borderBottomWidth: StyleSheet.hairlineWidth },
});
