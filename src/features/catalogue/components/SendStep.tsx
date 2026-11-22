/** /catalogue/send step 4: choose who gets it, open WhatsApp, then celebrate briefly. */
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { formatPhone } from '@/lib/phone';
import { AppText, Button, EmptyState, Icon, IconButton, Screen, useReduceMotionEnabled } from '@/ui/components';
import { PaisleyConfetti } from '@/ui/patterns';
import { useTheme } from '@/ui/theme';

import { useCatalogueSend, type SendPhase } from '../hooks/useCatalogueSend';
import { useCustomerBrief } from '../hooks/useCustomerBrief';
import { useExitFlow } from '../hooks/useExitFlow';
import type { Recipient } from '../logic/recipient';
import { RecipientPicker } from './RecipientPicker';

export function SendStep({ toCustomerId }: { toCustomerId?: string }) {
  const { t } = useTranslation('catalogue');
  const exit = useExitFlow();
  const s = useCatalogueSend();
  const preset = useCustomerBrief(toCustomerId);
  const autoSent = useRef(false);

  // "Send to Mrs Shah" on the preview: go straight to her chat once the catalogue is ready.
  useEffect(() => {
    if (preset && !autoSent.current && s.status === 'ready' && s.phase.kind === 'choose') {
      autoSent.current = true;
      void s.send({ kind: 'customer', id: preset.id, name: preset.name, phone: preset.phone });
    }
  }, [preset, s]);

  if (s.phase.kind === 'done') {
    return <SendDone phase={s.phase} onNextPart={s.sendNextPart} onAnother={s.sendAnother} onFinish={exit} />;
  }

  const working = s.phase.kind === 'working';
  return (
    <Screen
      title={t('send.title')}
      subtitle={t('send.subtitle')}
      leading={<IconButton icon="arrow-back" accessibilityLabel={t('flow.back')} onPress={() => router.back()} disabled={working} />}
      actions={<IconButton icon="close" accessibilityLabel={t('flow.close')} onPress={exit} disabled={working} />}>
      {s.status === 'error' ? (
        <EmptyState
          illustration={<Icon name="error-outline" size={48} tone="danger" />}
          title={t('preview.errorTitle')}
          body={t('preview.errorBody')}
          actionLabel={t('common:actions.retry')}
          onAction={s.retry}
        />
      ) : (
        <View style={styles.flex}>
          <RecipientPicker onPick={(r) => void s.send(r)} disabled={working || s.status !== 'ready'} />
          {working || s.status === 'loading' ? (
            <WorkingOverlay label={s.phase.kind === 'working' && s.phase.step === 'opening' ? t('send.opening') : t('send.making')} />
          ) : null}
        </View>
      )}
    </Screen>
  );
}

function WorkingOverlay({ label }: { label: string }) {
  const { colors, space, radius } = useTheme();
  return (
    <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: colors.scrim }]} accessibilityViewIsModal>
      <View style={[styles.center, { backgroundColor: colors.surface, borderRadius: radius.card, padding: space.xl, gap: space.md }]} accessibilityLiveRegion="polite">
        <ActivityIndicator color={colors.primary} size="large" />
        <AppText weight="semibold">{label}</AppText>
      </View>
    </View>
  );
}

function recipientLine(t: TFunction<'catalogue'>, r: Recipient): string {
  if (r.kind === 'customer') return t('done.sentTo', { name: r.name });
  if (r.kind === 'number') return t('done.sentNumber', { phone: formatPhone(r.phone) });
  return t('done.sentChat');
}

/** Success: a short paisley burst (≤ 1.2 s; a still check with reduced motion), then the next useful action. */
export function SendDone({
  phase,
  onNextPart,
  onAnother,
  onFinish,
}: {
  phase: Extract<SendPhase, { kind: 'done' }>;
  onNextPart: () => void;
  onAnother: () => void;
  onFinish: () => void;
}) {
  const { t } = useTranslation('catalogue');
  const { colors, space, radius } = useTheme();
  const reduced = useReduceMotionEnabled();
  const [celebrate, setCelebrate] = useState(!reduced);
  const morePartsLeft = phase.partsSent < phase.totalParts;

  return (
    <Screen
      edges={['top', 'bottom']}
      footer={
        <>
          {morePartsLeft ? (
            <Button
              testID="done-next-part"
              label={t('done.nextPart', { index: phase.partsSent + 1, total: phase.totalParts })}
              icon="send"
              size="lg"
              fullWidth
              onPress={onNextPart}
            />
          ) : null}
          <Button
            testID="done-another"
            label={t('done.another')}
            icon="person-add"
            variant={morePartsLeft ? 'secondary' : 'primary'}
            size="lg"
            fullWidth
            onPress={onAnother}
          />
          <Button testID="done-finish" label={t('done.finish')} variant="ghost" size="lg" fullWidth onPress={onFinish} />
        </>
      }>
      <View style={[styles.flex, styles.center, { gap: space.lg }]} accessibilityLiveRegion="polite">
        <View style={[styles.badge, { backgroundColor: colors.meadow, borderRadius: radius.pill }]}>
          <Icon name="check" size={56} color={colors.onAccent} />
        </View>
        <AppText variant="display" align="center" accessibilityRole="header">
          {t('done.title')}
        </AppText>
        <AppText variant="title" align="center">
          {recipientLine(t, phase.recipient)}
        </AppText>
        {phase.totalParts > 1 ? (
          <AppText muted align="center">
            {t('done.partsLeft', { sent: phase.partsSent, total: phase.totalParts })}
          </AppText>
        ) : null}
        {phase.recipient.kind === 'customer' ? (
          <AppText muted align="center">
            {t('done.logged', { name: phase.recipient.name })}
          </AppText>
        ) : null}
      </View>
      {celebrate ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <PaisleyConfetti originY={0.35} onDone={() => setCelebrate(false)} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  badge: { width: 104, height: 104, alignItems: 'center', justifyContent: 'center' },
});
