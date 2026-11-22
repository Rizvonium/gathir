/**
 * Sell sheet (formSheet route). One scrolling sheet, step-light: product → colour → how many →
 * rate → payment → customer, with discount/note tucked away and the big "Sell · ₹X" button in
 * the thumb zone. From product detail a one-colour sale is 2 taps (Sell, Sell · ₹X).
 * After selling: success haptic, two chinar leaves drift for 900 ms while the count rolls
 * down, then the sheet closes and a toast offers Undo. With a customer picked the sheet stays
 * on the done panel so the bill can go to their WhatsApp.
 */
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { PAYMENT_METHODS } from '@/db/schema';
import { formatINR } from '@/lib/money';
import {
  AppText,
  Button,
  ChipGroup,
  ColourSwatch,
  Icon,
  IconButton,
  MoneyInput,
  RollingNumber,
  Screen,
  Stepper,
  TextField,
  useToast,
} from '@/ui/components';
import { ChinarLeaves } from '@/ui/patterns';
import { useTheme } from '@/ui/theme';

import { cartProfit } from '@/features/profit/logic';
import { useProfitVisible } from '@/features/profit/privacy';

import { useSellSheet, type SellParams, type SoldSale } from '../hooks/useSellSheet';
import { useSendBill } from '../hooks/useSendBill';
import { soldMessage } from '../logic/saleMessages';
import { availableFor, type SellBlocker } from '../logic/sellCart';
import { PAYMENT_ICONS } from '../logic/salesList';
import { CustomerPickerField } from './CustomerPickerField';
import { ProductThumb } from './SaleBits';
import { SellProductPicker } from './SellProductPicker';
import { SellProfit } from './SellProfit';

const NEW_PRODUCT = '/product/new' as const;
const SALES = '/sales' as const;

const BLOCKER_KEY: Record<Exclude<SellBlocker, null>, string> = {
  needs_product: 'sell.needsProduct',
  needs_colour: 'sell.needsColour',
  needs_rate: 'sell.needsRate',
  discount_too_high: 'sell.discountTooHigh',
  customer_name: 'customer.nameNeeded',
};

export function SellScreen({ params }: { params: SellParams }) {
  const { colors, space, radius } = useTheme();
  const { t } = useTranslation('sales');
  const toast = useToast();
  const c = useSellSheet(params);
  const bill = useSendBill();
  const profitVisible = useProfitVisible();
  const [sold, setSold] = useState<SoldSale | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const [showMore, setShowMore] = useState(() => c.state.discountPaise !== null || c.state.note !== '');
  const toastShown = useRef(false);
  const soldRef = useRef<SoldSale | null>(null);

  // The "Sold … · Undo" toast appears on the screen underneath, however the sheet was closed.
  const announce = () => {
    const s = soldRef.current;
    if (!s || toastShown.current) return;
    toastShown.current = true;
    toast.show({
      message: soldMessage(t, s.lines, s.totalPaise),
      tone: 'success',
      actionLabel: t('common:actions.undo'),
      onAction: () => {
        if (c.undo(s.saleId)) toast.show({ message: t('sell.undone') });
      },
    });
  };
  const announceRef = useRef(announce);
  useEffect(() => {
    announceRef.current = announce;
  });
  useEffect(() => () => announceRef.current(), []);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace(SALES);
  };

  const onSell = () => {
    const result = c.submit();
    if (!result) return;
    soldRef.current = result;
    setSold(result);
    setCelebrating(true);
  };

  const onCelebrated = () => {
    setCelebrating(false);
    // Walk-in: nothing more to do here. A named customer may want the bill on WhatsApp.
    if (sold && !sold.customerId) close();
  };

  const onSendBill = async () => {
    if (!sold) return;
    const outcome = await bill.send(sold.saleId);
    if (outcome && (outcome.status === 'sent' || outcome.status === 'fallback_shared')) close();
  };

  if (sold) {
    const line = sold.lines.length === 1 ? sold.lines[0] : null;
    const colour = line && c.product ? c.product.colours.find((x) => x.id === line.colourId) : null;
    return (
      <Screen edges={['bottom']} testID="sell-done">
        <View style={[styles.done, { gap: space.lg, padding: space.xl }]}>
          <View style={[styles.check, { backgroundColor: colors.meadow, borderRadius: radius.pill }]}>
            <Icon name="check" size={40} color={colors.onAccent} />
          </View>
          <AppText variant="display" align="center" accessibilityRole="header">
            {t('sell.doneTitle')}
          </AppText>
          <AppText variant="title" align="center" testID="sell-done-message">
            {soldMessage(t, sold.lines, sold.totalPaise)}
          </AppText>
          {line && colour ? (
            <View style={styles.leftRow}>
              <RollingNumber value={colour.pieces} variant="count" testID="sell-done-left" accessibilityLabel={`${colour.pieces} ${t('sell.piecesLeft', { colour: line.colourName })}`} />
              <AppText muted style={{ marginStart: space.sm }}>
                {t('sell.piecesLeft', { colour: line.colourName })}
              </AppText>
            </View>
          ) : null}
          <View style={styles.stretch}>
            <SellProfit profit={cartProfit(sold.lines, c.state.discountPaise)} visible={profitVisible} testID="sell-done-profit" />
          </View>
          {!celebrating && sold.customerId ? (
            <View style={[styles.stretch, { gap: space.sm }]}>
              <Button
                label={t('sell.sendBill')}
                icon="send"
                size="lg"
                fullWidth
                loading={bill.sending}
                onPress={() => void onSendBill()}
                accessibilityHint={t('detail.sendBillHint')}
                testID="sell-send-bill"
              />
              <Button label={t('sell.done')} variant="secondary" size="lg" fullWidth onPress={close} testID="sell-done-close" />
            </View>
          ) : null}
        </View>
        {celebrating ? <ChinarLeaves count={2} onDone={onCelebrated} /> : null}
      </Screen>
    );
  }

  const product = c.product;
  const summary = c.summary;
  const blocker = summary.blocker;
  const draftReady = summary.lines.length > c.state.lines.length;
  const rate = c.state.draft.ratePaise;

  const colourOptions =
    product?.colours.map((col) => {
      const left = availableFor(col, c.state.lines);
      return {
        value: col.id,
        label: left > 0 ? t('sell.colourLeft', { name: col.name, count: left }) : t('sell.colourOut', { name: col.name }),
        leading: <ColourSwatch hex={col.hex} name={col.name} size={20} />,
        disabled: left < 1,
      };
    }) ?? [];

  const footer = (
    <>
      {summary.lines.length > 0 ? <SellProfit profit={cartProfit(summary.lines, c.state.discountPaise)} visible={profitVisible} /> : null}
      {c.error ? (
        <View style={[styles.row, { gap: space.sm }]} accessibilityLiveRegion="polite">
          <Icon name="error-outline" tone="danger" size={20} />
          <AppText variant="small" tone="danger" style={styles.flex} testID="sell-error">
            {c.error}
          </AppText>
        </View>
      ) : blocker && blocker !== 'needs_product' ? (
        <AppText variant="small" muted align="center" testID="sell-blocker">
          {t(BLOCKER_KEY[blocker])}
        </AppText>
      ) : null}
      <Button
        testID="sell-submit"
        label={summary.lines.length > 0 ? t('sell.sellButton', { amount: formatINR(summary.totalPaise) }) : t('sell.sellButtonEmpty')}
        icon="point-of-sale"
        size="lg"
        fullWidth
        disabled={!!blocker}
        loading={c.submitting}
        onPress={onSell}
      />
    </>
  );

  return (
    <Screen
      title={t('sell.title')}
      edges={['bottom']}
      scroll
      footer={footer}
      actions={<IconButton icon="close" accessibilityLabel={t('sell.close')} onPress={close} testID="sell-close" />}
      testID="sell-screen">
      {c.state.lines.length > 0 ? (
        <View style={{ gap: space.sm }} testID="sell-cart">
          <AppText variant="title" accessibilityRole="header">
            {t('sell.cart')}
          </AppText>
          {c.state.lines.map((l) => (
            <View key={l.key} style={[styles.row, { gap: space.md }]}>
              <ProductThumb productId={l.productId} name={l.productName} thumb={l.thumb} size={48} />
              <View style={styles.flex}>
                <AppText weight="semibold" numberOfLines={1}>
                  {t('sell.cartLine', { name: l.productName, colour: l.colourName, qty: l.qty })}
                </AppText>
                <AppText variant="small" muted numeric>
                  {formatINR(l.qty * l.ratePaise)}
                </AppText>
              </View>
              <IconButton
                icon="close"
                accessibilityLabel={t('sell.removeLine', { name: l.productName, colour: l.colourName })}
                onPress={() => c.removeLine(l.key)}
                testID={`sell-remove-${l.key}`}
              />
            </View>
          ))}
        </View>
      ) : null}

      {!product ? (
        <SellProductPicker
          search={c.search}
          onSearch={c.setSearch}
          shown={c.picker.shown}
          total={c.picker.total}
          lowStockLevel={c.picker.lowStockLevel}
          onPick={c.choose}
          onAddProduct={() => router.push(NEW_PRODUCT)}
        />
      ) : (
        <>
          <View style={[styles.row, { gap: space.md }]} testID="sell-product">
            <ProductThumb productId={product.id} name={product.name} thumb={product.thumb} size={72} rounded="card" />
            <View style={styles.flex}>
              <AppText variant="title" numberOfLines={2}>
                {product.name}
              </AppText>
              <AppText muted numeric>
                {formatINR(product.ratePaise)}
              </AppText>
            </View>
            <Button label={t('sell.change')} variant="ghost" size="sm" onPress={c.changeProduct} accessibilityHint={t('sell.changeProduct')} testID="sell-change-product" />
          </View>

          <View style={{ gap: space.sm }}>
            <AppText variant="title" accessibilityRole="header">
              {t('sell.colour')}
            </AppText>
            <ChipGroup mode="single" testID="sell-colour" accessibilityLabel={t('sell.colour')} options={colourOptions} value={c.state.draft.colourId} onChange={c.chooseColour} />
          </View>

          {c.state.draft.colourId && c.maxQty > 0 ? (
            <>
              <View style={{ gap: space.sm }}>
                <AppText variant="title" accessibilityRole="header">
                  {t('sell.quantity')}
                </AppText>
                <View style={[styles.row, { gap: space.lg }]}>
                  <Stepper testID="sell-qty" value={Math.min(c.state.draft.qty, c.maxQty)} onChange={c.setQty} min={1} max={c.maxQty} accessibilityLabel={t('sell.quantityLabel')} />
                  <AppText variant="small" muted style={styles.flex}>
                    {t('sell.maxLeft', { count: c.maxQty })}
                  </AppText>
                </View>
              </View>
              <MoneyInput
                testID="sell-rate"
                label={t('sell.rate')}
                value={rate}
                onChange={c.setRate}
                error={rate === null ? t('sell.rateMissing') : undefined}
                helper={rate !== null && rate !== product.ratePaise ? t('sell.rateHelper', { rate: formatINR(product.ratePaise) }) : undefined}
              />
              <Button
                label={t('sell.addAnother')}
                icon="add-shopping-cart"
                variant="secondary"
                disabled={!draftReady}
                onPress={c.addAnother}
                testID="sell-add-another"
                style={styles.start}
              />
            </>
          ) : null}
        </>
      )}

      <View style={{ gap: space.sm }}>
        <AppText variant="title" accessibilityRole="header">
          {t('payment.label')}
        </AppText>
        <ChipGroup
          mode="single"
          testID="sell-payment"
          accessibilityLabel={t('payment.label')}
          options={PAYMENT_METHODS.map((p) => ({ value: p, label: t(`payment.${p}`), icon: PAYMENT_ICONS[p] }))}
          value={c.state.payment}
          onChange={c.setPayment}
        />
      </View>

      <CustomerPickerField
        value={c.state.customer}
        onChange={c.setCustomer}
        nameError={blocker === 'customer_name' ? t('customer.nameNeeded') : undefined}
      />

      {showMore ? (
        <View style={{ gap: space.md }} testID="sell-more">
          <MoneyInput
            testID="sell-discount"
            label={t('sell.discount')}
            value={c.state.discountPaise}
            onChange={c.setDiscount}
            error={blocker === 'discount_too_high' ? t('sell.discountTooHigh') : undefined}
          />
          <TextField
            testID="sell-note"
            label={t('sell.note')}
            placeholder={t('sell.notePlaceholder')}
            value={c.state.note}
            onChangeText={c.setNote}
            multiline
          />
        </View>
      ) : (
        <Button label={t('sell.more')} icon="edit-note" variant="ghost" onPress={() => setShowMore(true)} testID="sell-show-more" style={styles.start} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center' },
  start: { alignSelf: 'flex-start' },
  stretch: { alignSelf: 'stretch' },
  done: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  check: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  leftRow: { flexDirection: 'row', alignItems: 'baseline' },
});
