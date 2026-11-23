/** /catalogue/card: preview the product card picture and send it on WhatsApp. */
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useShowroomActive } from '@/features/showroom/hooks/useShowroomActive';
import { formatPhone } from '@/lib/phone';
import { ProductCardImage } from '@/share';
import { AppText, Button, EmptyState, Icon, IconButton, Screen, useReduceMotionEnabled } from '@/ui/components';
import { PaisleyConfetti } from '@/ui/patterns';
import { useTheme } from '@/ui/theme';

import { useCustomerBrief } from '../hooks/useCustomerBrief';
import { useExitFlow } from '../hooks/useExitFlow';
import { useProductCardSend } from '../hooks/useProductCardSend';
import { needsConsentCheck } from '../logic/consent';
import type { Recipient } from '../logic/recipient';
import { NoConsentSheet } from './NoConsentSheet';
import { RecipientPicker } from './RecipientPicker';

/** Layout size of ProductCardImage in dp (it is captured at 1080×1350). */
const CARD_DP = { width: 360, height: 450 };

export function CardScreen({ productId, customerId }: { productId?: string; customerId?: string }) {
  const { t } = useTranslation('catalogue');
  const { space } = useTheme();
  const exit = useExitFlow();
  const card = useProductCardSend(productId);
  const customer = useCustomerBrief(customerId);
  const [pickOther, setPickOther] = useState(false);
  // Opened from the Showroom: the phone may be in the customer's hands, so no "Someone else"
  // (that list is the whole customer book). The chosen customer only.
  const showroom = useShowroomActive();
  const [confirming, setConfirming] = useState(false);

  const back = <IconButton icon="arrow-back" accessibilityLabel={t('flow.back')} onPress={exit} />;

  if (!card.detail || card.detail.product.deletedAt) {
    return (
      <Screen title={t('card.title')} leading={back} edges={['top', 'bottom']}>
        <EmptyState illustration={<Icon name="image-not-supported" size={48} tone="textMuted" />} title={t('card.missingTitle')} body={t('card.missingBody')} />
      </Screen>
    );
  }

  if (card.phase.kind === 'done') {
    return <CardDone recipient={card.phase.recipient} onAnother={card.again} onFinish={exit} />;
  }

  const working = card.phase.kind === 'working';
  const preview = <CardPreview name={card.data.name} node={<ProductCardImage data={card.data} />} />;
  const direct = customer && !pickOther;
  const sendDirect = () => {
    if (!customer) return;
    setConfirming(false);
    void card.send({ kind: 'customer', id: customer.id, name: customer.name, phone: customer.phone });
  };

  return (
    <Screen
      title={t('card.title')}
      subtitle={t('card.subtitle')}
      leading={back}
      edges={direct ? ['top', 'bottom'] : ['top']}
      footer={
        direct ? (
          <View style={[styles.row, { gap: space.sm }]}>
            {showroom ? null : (
              <Button testID="card-someone-else" label={t('card.someoneElse')} variant="secondary" size="lg" onPress={() => setPickOther(true)} disabled={working} />
            )}
            <Button
              testID="card-send-customer"
              label={t('card.sendTo', { name: customer.name })}
              icon="send"
              size="lg"
              style={styles.flex}
              loading={working}
              onPress={() => (needsConsentCheck(customer) ? setConfirming(true) : sendDirect())}
            />
          </View>
        ) : undefined
      }>
      {card.cardNode}
      {direct ? (
        <View style={[styles.flex, { paddingTop: space.md, gap: space.md }]}>
          {preview}
          {needsConsentCheck(customer) ? (
            <AppText muted align="center" testID="card-no-consent">
              {t('consent.directNote', { name: customer.name })}
            </AppText>
          ) : null}
          <NoConsentSheet name={confirming ? customer.name : null} onCancel={() => setConfirming(false)} onSend={sendDirect} />
        </View>
      ) : (
        <View style={styles.flex}>
          <RecipientPicker header={preview} onPick={(r) => void card.send(r)} disabled={working} />
          {working ? (
            <View style={[StyleSheet.absoluteFill, styles.center]}>
              <ActivityIndicator size="large" />
            </View>
          ) : null}
        </View>
      )}
    </Screen>
  );
}

/** The real card component, scaled to fit the screen width (what WhatsApp will show). */
function CardPreview({ name, node }: { name: string; node: ReactNode }) {
  const { t } = useTranslation('catalogue');
  const { width } = useWindowDimensions();
  const { space, radius } = useTheme();
  const target = Math.min(width - space.lg * 2, 320);
  const scale = target / CARD_DP.width;
  return (
    <View
      style={[styles.center, { width: '100%' }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={t('card.previewLabel', { name })}>
      <View style={{ width: target, height: CARD_DP.height * scale, borderRadius: radius.sm, overflow: 'hidden' }} importantForAccessibility="no-hide-descendants">
        <View style={{ width: CARD_DP.width, height: CARD_DP.height, transform: [{ translateX: (target - CARD_DP.width) / 2 }, { translateY: (CARD_DP.height * scale - CARD_DP.height) / 2 }, { scale }] }}>
          {node}
        </View>
      </View>
    </View>
  );
}

function CardDone({ recipient, onAnother, onFinish }: { recipient: Recipient; onAnother: () => void; onFinish: () => void }) {
  const { t } = useTranslation('catalogue');
  const { colors, space, radius } = useTheme();
  const reduced = useReduceMotionEnabled();
  const [celebrate, setCelebrate] = useState(!reduced);
  const line =
    recipient.kind === 'customer'
      ? t('done.sentTo', { name: recipient.name })
      : recipient.kind === 'number'
        ? t('done.sentNumber', { phone: formatPhone(recipient.phone) })
        : t('done.sentChat');
  return (
    <Screen
      edges={['top', 'bottom']}
      footer={
        <>
          <Button testID="card-done-finish" label={t('done.finish')} size="lg" fullWidth onPress={onFinish} />
          <Button label={t('card.sendAnother')} variant="ghost" size="lg" fullWidth onPress={onAnother} />
        </>
      }>
      <View style={[styles.flex, styles.center, { gap: space.lg }]} accessibilityLiveRegion="polite">
        <View style={[styles.badge, { backgroundColor: colors.meadow, borderRadius: radius.pill }]}>
          <Icon name="check" size={48} color={colors.onAccent} />
        </View>
        <AppText variant="display" align="center" accessibilityRole="header">
          {t('card.doneTitle')}
        </AppText>
        <AppText variant="title" align="center">
          {line}
        </AppText>
      </View>
      {celebrate ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <PaisleyConfetti count={20} originY={0.35} onDone={() => setCelebrate(false)} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row' },
  center: { alignItems: 'center', justifyContent: 'center' },
  badge: { width: 88, height: 88, alignItems: 'center', justifyContent: 'center' },
});
