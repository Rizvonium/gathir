/**
 * Sale detail: items with photos, qty × rate, discount, total, payment, customer, bill no and
 * time. Send bill (PDF to the customer's WhatsApp) and Return sale.
 *
 * Return is confirmed in a sheet, not undone with a toast: it moves money and stock, and the
 * repo has no "un-return" (re-selling makes a new bill), so an Undo would not be honest
 * (product-design: rule/undo-only-when-honest, rule/irreversible-action-safeguard).
 */
import { router, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { SaleDetail } from '@/db/repo/saleQueries';
import { formatDate, formatTime } from '@/lib/dates';
import { formatINR } from '@/lib/money';
import { formatPhone } from '@/lib/phone';
import { AppSheet, AppText, Avatar, Button, ColourSwatch, Divider, EmptyState, Icon, IconButton, ListRow, PressableScale, Screen } from '@/ui/components';
import { useTheme } from '@/ui/theme';

import { ProfitEyeToggle, UnknownCostNote } from '@/features/profit/components/ProfitBits';
import { formatMargin, formatProfit, profitState, profitTone } from '@/features/profit/logic';
import { HIDDEN_FIGURE, useProfitVisible } from '@/features/profit/privacy';

import { useSaleDetail, type SaleDetailActions } from '../hooks/useSaleDetail';
import { PaymentLabel, ProductThumb } from './SaleBits';

const productHref = (id: string) => ({ pathname: '/product/[id]', params: { id } }) as unknown as Href;
const customerHref = (id: string) => ({ pathname: '/customer/[id]', params: { id } }) as unknown as Href;

export function SaleDetailScreen({ id }: { id: string | undefined }) {
  const { detail, actions } = useSaleDetail(id);
  return <SaleDetailView detail={detail} actions={actions} />;
}

export function SaleDetailView({ detail, actions }: { detail: SaleDetail | null; actions: SaleDetailActions }) {
  const { colors, space, radius } = useTheme();
  const { t } = useTranslation('sales');
  const { t: tp } = useTranslation('profit');
  const profitVisible = useProfitVisible();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/sales'));
  const backButton = <IconButton icon="arrow-back" accessibilityLabel={t('detail.back')} onPress={back} testID="sale-back" />;

  if (!detail) {
    return (
      <Screen leading={backButton} edges={['top', 'bottom']}>
        <EmptyState title={t('detail.notFound')} actionLabel={t('list.title')} onAction={back} />
      </Screen>
    );
  }

  const { sale, items, customer, profit } = detail;
  const pState = profitState(profit);
  const returned = sale.cancelledAt !== null;
  const subtotal = items.reduce((s, i) => s + i.qty * i.ratePaise, 0);
  const pieces = items.reduce((n, i) => n + i.qty, 0);
  const customerName = sale.customerNameSnapshot ?? customer?.name ?? null;
  const customerLive = !!customer && customer.deletedAt === null;
  const phone = sale.customerPhoneSnapshot ?? customer?.phone ?? null;

  const footer = (
    <View style={[styles.row, { gap: space.sm }]}>
      {!returned ? (
        <Button label={t('detail.return')} icon="assignment-return" variant="secondary" size="lg" onPress={actions.askReturn} testID="sale-return" />
      ) : null}
      <Button
        label={t('detail.sendBill')}
        icon="send"
        size="lg"
        loading={actions.sending}
        onPress={actions.sendBill}
        accessibilityHint={t('detail.sendBillHint')}
        testID="sale-send-bill"
        style={styles.flex}
      />
    </View>
  );

  return (
    <Screen
      leading={backButton}
      title={formatINR(sale.totalPaise)}
      subtitle={t('detail.billLine', { no: sale.billNo, date: formatDate(sale.createdAt), time: formatTime(sale.createdAt) })}
      edges={['top', 'bottom']}
      scroll
      footer={footer}
      actions={<ProfitEyeToggle />}
      testID="sale-detail">
      {returned ? (
        <View
          testID="sale-returned"
          accessibilityLiveRegion="polite"
          style={[styles.row, { gap: space.sm, padding: space.md, borderRadius: radius.md, backgroundColor: colors.surfaceSunken, borderColor: colors.danger, borderWidth: 1 }]}>
          <Icon name="undo" tone="danger" />
          <AppText weight="semibold" style={styles.flex}>
            {t('detail.returnedBanner', { date: formatDate(sale.cancelledAt ?? sale.createdAt) })}
          </AppText>
        </View>
      ) : null}

      <View style={{ gap: space.sm }}>
        <AppText variant="title" accessibilityRole="header">
          {t('detail.items')}
        </AppText>
        {items.map((it, i) => (
          <PressableScale
            key={it.id}
            testID={`sale-item-${it.id}`}
            onPress={() => router.push(productHref(it.productId))}
            accessibilityRole="button"
            accessibilityLabel={`${t('sell.cartLine', { name: it.productNameSnapshot, colour: it.colourNameSnapshot, qty: it.qty })}, ${formatINR(it.qty * it.ratePaise)}`}
            accessibilityHint={t('detail.openProduct', { name: it.productNameSnapshot })}
            style={[styles.row, { gap: space.md, minHeight: 72 }]}>
            <ProductThumb productId={it.productId} name={it.productNameSnapshot} thumb={it.photoSnapshotName} size={64} />
            <View style={styles.flex}>
              <AppText weight="semibold" numberOfLines={2} style={returned ? styles.struck : undefined}>
                {it.productNameSnapshot}
              </AppText>
              <View style={[styles.row, { gap: space.xs }]}>
                <ColourSwatch hex={it.colourHexSnapshot} name={it.colourNameSnapshot} size={16} />
                <AppText variant="small" muted>
                  {it.colourNameSnapshot}
                </AppText>
              </View>
              <AppText variant="small" muted numeric>
                {t('detail.qtyRate', { qty: it.qty, rate: formatINR(it.ratePaise) })}
              </AppText>
              {profitVisible && !returned ? <ItemProfit costPaise={it.costPaiseSnapshot} profitPaise={profit.lines[i]?.profitPaise ?? null} testID={`sale-item-profit-${it.id}`} /> : null}
            </View>
            <AppText weight="semibold" numeric>
              {formatINR(it.qty * it.ratePaise)}
            </AppText>
          </PressableScale>
        ))}
      </View>

      <View style={{ gap: space.sm }}>
        <Divider />
        {sale.discountPaise > 0 ? (
          <>
            <Line label={t('detail.subtotal')} value={formatINR(subtotal)} />
            <Line label={t('detail.discount')} value={`− ${formatINR(sale.discountPaise)}`} />
          </>
        ) : null}
        <Line label={t('detail.total')} value={formatINR(sale.totalPaise)} strong struck={returned} />
        <View style={[styles.row, styles.between]}>
          <AppText muted>{t('detail.payment')}</AppText>
          <PaymentLabel payment={sale.payment} muted={false} />
        </View>
        {returned ? (
          <AppText variant="small" muted testID="sale-profit-returned">
            {tp('sale.returned')}
          </AppText>
        ) : !profitVisible ? (
          <Line label={tp('sale.profit')} value={HIDDEN_FIGURE} a11yValue={tp('hidden')} testID="sale-profit" />
        ) : pState === 'unknown' ? (
          <Line label={tp('sale.profit')} value={tp('unknown')} tone="lowText" testID="sale-profit" />
        ) : (
          <>
            <Line
              label={tp('sale.profit')}
              value={`${formatProfit(profit.profitPaise)}${formatMargin(profit.marginPct) ? ` (${formatMargin(profit.marginPct)})` : ''}`}
              tone={profitTone(profit.profitPaise)}
              testID="sale-profit"
            />
            <UnknownCostNote count={profit.unknownCostItems} testID="sale-profit-unknown" />
          </>
        )}
      </View>

      <View style={{ gap: space.xs }}>
        <AppText variant="title" accessibilityRole="header">
          {t('detail.customer')}
        </AppText>
        {customerName ? (
          <ListRow
            testID="sale-customer"
            title={customerLive ? customerName : t('detail.customerDeleted', { name: customerName })}
            subtitle={phone ? formatPhone(phone) : undefined}
            leading={<Avatar name={customerName} color={colors.teal} />}
            onPress={customerLive && sale.customerId ? () => router.push(customerHref(sale.customerId as string)) : undefined}
            accessibilityLabel={customerLive ? t('detail.openCustomer', { name: customerName }) : undefined}
            style={styles.flushRow}
          />
        ) : (
          <ListRow title={t('walkInCustomer')} leading={<Avatar name="?" color={colors.indigo} />} style={styles.flushRow} />
        )}
      </View>

      {sale.note ? (
        <View style={{ gap: space.xs }}>
          <AppText variant="title" accessibilityRole="header">
            {t('detail.note')}
          </AppText>
          <AppText selectable>{sale.note}</AppText>
        </View>
      ) : null}

      <AppSheet visible={actions.returnOpen} onClose={actions.cancelReturn} title={t('detail.returnTitle')} testID="return-sheet">
        <AppText>{t('detail.returnBody', { count: pieces, amount: formatINR(sale.totalPaise) })}</AppText>
        <AppText muted>{t('detail.returnNote')}</AppText>
        <Button label={t('detail.returnConfirm')} icon="assignment-return" variant="danger" size="lg" fullWidth onPress={actions.confirmReturn} testID="return-confirm" />
        <Button label={t('detail.returnKeep')} variant="secondary" size="lg" fullWidth onPress={actions.cancelReturn} testID="return-keep" />
      </AppSheet>
    </Screen>
  );
}

/** "Bought at ₹4,000 · profit ₹2,500" under a sold item (seller-only), or "profit unknown". */
function ItemProfit({ costPaise, profitPaise, testID }: { costPaise: number | null; profitPaise: number | null; testID: string }) {
  const { t } = useTranslation('profit');
  if (costPaise === null || profitPaise === null) {
    return (
      <AppText variant="small" tone="lowText" testID={testID}>
        {t('sale.itemUnknown')}
      </AppText>
    );
  }
  const tone = profitTone(profitPaise);
  return (
    <AppText variant="small" numeric tone={tone === 'text' ? 'textMuted' : tone} testID={testID}>
      {t('sale.itemProfit', { cost: formatINR(costPaise), profit: formatProfit(profitPaise) })}
    </AppText>
  );
}

function Line({
  label,
  value,
  strong,
  struck,
  tone,
  a11yValue,
  testID,
}: {
  label: string;
  value: string;
  strong?: boolean;
  struck?: boolean;
  tone?: 'meadow' | 'danger' | 'text' | 'lowText';
  a11yValue?: string;
  testID?: string;
}) {
  return (
    <View style={[styles.row, styles.between]} accessible accessibilityLabel={`${label}: ${a11yValue ?? value}`} testID={testID}>
      <AppText muted={!strong} weight={strong ? 'bold' : 'regular'} variant={strong ? 'title' : 'body'}>
        {label}
      </AppText>
      <AppText numeric tone={tone} weight={strong ? 'bold' : 'medium'} variant={strong ? 'title' : 'body'} style={struck ? styles.struck : undefined}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center' },
  between: { justifyContent: 'space-between' },
  struck: { textDecorationLine: 'line-through' },
  flushRow: { paddingHorizontal: 0 },
});
