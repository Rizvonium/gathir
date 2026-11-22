/**
 * /report — "Send report to owner" (PLAN §7). One screen, thumb-first:
 * period (Since last report is pre-picked) → live summary → options → Send.
 * From Home that is 2 taps (Send report → Send to owner), well under the 20 s target.
 * "See the PDF" opens the real preview for sellers who want to check first.
 */
import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { formatDate, relativeDaysKey, startOfDay } from '@/lib/dates';
import { formatPhone } from '@/lib/phone';
import { formatINR, formatNumber } from '@/lib/money';
import { PaisleyConfetti } from '@/ui/patterns';
import { AppSheet, AppText, Button, Card, Icon, IconButton, RollingNumber, Screen, SectionHeader } from '@/ui/components';
import { useTheme } from '@/ui/theme';

import { ToggleRow } from '@/features/settings/components/ToggleRow';

import { useReportPeriod } from '../hooks/useReportPeriod';
import { useReportSend } from '../hooks/useReportSend';
import type { SalesSummary } from '@/db/repo/saleQueries';

import type { Range } from '../period';
import { useReportFlow, type SentReport } from '../store';
import { PeriodPicker } from './PeriodPicker';

export const OWNER_SETTINGS_FROM_REPORT = `/settings/owner?returnTo=${encodeURIComponent('/report')}`;

/** `initialFrom/To` (epoch ms) open the screen on Choose dates, e.g. "Make again" from history. */
export function ReportScreen({ initialFrom, initialTo }: { initialFrom?: number; initialTo?: number } = {}) {
  const { t } = useTranslation('report');
  const { space } = useTheme();
  const reset = useReportFlow((s) => s.reset);
  useEffect(() => {
    reset(Date.now());
    if (initialFrom !== undefined && initialTo !== undefined) {
      useReportFlow.getState().set({ kind: 'custom', customFrom: startOfDay(initialFrom), customTo: startOfDay(initialTo) });
    }
    // Once per visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reset]);

  const p = useReportPeriod();
  const s = useReportSend(p);
  const celebrate = useReportFlow((st) => st.celebrate);
  const setFlow = useReportFlow((st) => st.set);

  const relativeLabel = (ms: number, now: number) => {
    const r = relativeDaysKey(ms, now);
    return t(`common:relative.${r.key}`, { count: r.count });
  };
  const lastSent = p.basics.lastSentAt === null ? t('screen.neverSent') : t('screen.lastSent', { when: relativeLabel(p.basics.lastSentAt, p.now) });
  const sendLabel = s.phase === 'preparing' ? t('send.preparing') : s.phase === 'sharing' ? t('send.opening') : t('send.button');

  const footer = s.owner ? (
    <View style={{ gap: space.xs }}>
      <Button testID="report-send" label={sendLabel} icon="send" size="lg" fullWidth loading={s.busy && s.phase !== 'photos'} disabled={s.busy} onPress={s.send} />
      <AppText variant="small" muted align="center">
        {t('send.to', { phone: formatPhone(s.owner) })}
      </AppText>
    </View>
  ) : (
    <Button testID="report-add-owner" label={t('owner.add')} icon="person-add" size="lg" fullWidth onPress={() => router.push(OWNER_SETTINGS_FROM_REPORT as never)} />
  );

  return (
    <View style={styles.flex}>
      <Screen
        testID="report-screen"
        title={t('screen.title')}
        subtitle={lastSent}
        scroll
        edges={['top', 'bottom']}
        footer={footer}
        leading={<IconButton icon="arrow-back" accessibilityLabel={t('screen.back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />}
        actions={<IconButton testID="report-history" icon="history" accessibilityLabel={t('history.title')} onPress={() => router.push('/report/history')} />}>
        {s.sent ? <SentCard sent={s.sent} alsoPhotos={s.alsoPhotos} sendingPhotos={s.phase === 'photos'} busy={s.busy} onSendPhotos={s.sendPhotos} /> : null}

        <View style={{ gap: space.sm }}>
          <SectionHeader title={t('period.title')} />
          <PeriodPicker kind={p.kind} onKind={p.setKind} now={p.now} customFrom={p.customFrom} customTo={p.customTo} onPickDay={p.pickDay} />
        </View>

        <SummaryCard summary={p.summary} range={p.range} />

        <Card padding="md">
          <ToggleRow
            testID="report-phones"
            label={t('options.phones')}
            helper={t('options.phonesHelp')}
            value={p.includePhones}
            onChange={p.setIncludePhones}
          />
          <ToggleRow
            testID="report-photos"
            label={t('options.photos')}
            helper={t('options.photosHelp')}
            value={p.alsoPhotos}
            onChange={p.setAlsoPhotos}
          />
        </Card>

        <Button testID="report-preview" label={t('preview.open')} icon="picture-as-pdf" variant="secondary" fullWidth onPress={() => router.push('/report/preview')} />
        {!s.owner ? (
          <AppText variant="small" muted align="center">
            {t('owner.missing')}
          </AppText>
        ) : null}
      </Screen>

      {celebrate ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none" importantForAccessibility="no-hide-descendants">
          <PaisleyConfetti originY={0.35} onDone={() => setFlow({ celebrate: false })} />
        </View>
      ) : null}

      <AppSheet visible={s.needOwner} onClose={s.closeOwnerPrompt} title={t('owner.title')}>
        <AppText>{t('owner.body')}</AppText>
        <Button
          label={t('owner.add')}
          icon="person-add"
          size="lg"
          fullWidth
          onPress={() => {
            s.closeOwnerPrompt();
            router.push(OWNER_SETTINGS_FROM_REPORT as never);
          }}
        />
      </AppSheet>
    </View>
  );
}

/** Big, plain numbers for the chosen period: what the owner will see on page 1. */
export function SummaryCard({ summary: sum, range }: { summary: SalesSummary; range: Range }) {
  const { t } = useTranslation('report');
  const { space } = useTheme();
  const period = t('period.range', { from: formatDate(range.from), to: formatDate(range.to) });
  const payments = (['cash', 'upi', 'card', 'other'] as const)
    .filter((m) => sum.byPayment[m].count > 0)
    .map((m) => `${t(`pdf.payment.${m}`)} ${formatINR(sum.byPayment[m].amountPaise)}`)
    .join('   ');

  return (
    <Card testID="report-summary" padding="lg">
      <View style={{ gap: space.md }}>
        <AppText muted testID="report-period-label">
          {period}
        </AppText>
        {sum.count === 0 ? (
          <View style={[styles.row, { gap: space.md }]}>
            <Icon name="info-outline" tone="textMuted" />
            <AppText style={styles.flex}>{t('summary.empty')}</AppText>
          </View>
        ) : (
          <>
            <View style={[styles.row, { gap: space.xl }]}>
              <Figure label={t('summary.pieces', { count: sum.pieces })} value={sum.pieces} />
              <Figure label={t('summary.amount')} value={sum.amountPaise} money />
            </View>
            <AppText variant="small" muted>
              {t('summary.bills', { count: sum.count, n: formatNumber(sum.count) })}
              {sum.discountsPaise > 0 ? `   ${t('summary.discounts', { amount: formatINR(sum.discountsPaise) })}` : ''}
            </AppText>
            {payments ? (
              <AppText variant="small" muted>
                {payments}
              </AppText>
            ) : null}
          </>
        )}
      </View>
    </Card>
  );
}

function Figure({ label, value, money }: { label: string; value: number; money?: boolean }) {
  return (
    <View style={styles.figure}>
      <RollingNumber value={value} format={money ? formatINR : formatNumber} variant="count" accessibilityLabel={`${money ? formatINR(value) : formatNumber(value)} ${label}`} />
      <AppText variant="small" muted>
        {label}
      </AppText>
    </View>
  );
}

/** After sending: what went, plus the optional photos follow-up. */
function SentCard({
  sent,
  alsoPhotos,
  sendingPhotos,
  busy,
  onSendPhotos,
}: {
  sent: SentReport;
  alsoPhotos: boolean;
  sendingPhotos: boolean;
  busy: boolean;
  onSendPhotos: () => void;
}) {
  const { t } = useTranslation('report');
  const { space } = useTheme();
  const photos = sent.photoNames.length;
  return (
    <Card testID="report-sent" padding="lg">
      <View style={{ gap: space.md }}>
        <View style={[styles.row, { gap: space.md }]}>
          <Icon name="check-circle" size={32} tone="meadow" />
          <View style={styles.flex}>
            <AppText variant="title" accessibilityRole="header" accessibilityLiveRegion="polite">
              {t('sent.title', { number: sent.number })}
            </AppText>
            <AppText muted>{t('sent.body', { count: sent.saleCount, amount: formatINR(sent.amountPaise) })}</AppText>
          </View>
        </View>
        {alsoPhotos && photos > 0 ? (
          <Button
            testID="report-send-photos"
            label={t('photos.send', { count: photos })}
            icon="photo-library"
            variant="tonal"
            fullWidth
            loading={sendingPhotos}
            disabled={busy}
            onPress={onSendPhotos}
          />
        ) : null}
        {alsoPhotos && photos === 0 ? (
          <AppText variant="small" muted>
            {t('photos.none')}
          </AppText>
        ) : null}
        <Button label={t('sent.done')} variant="secondary" fullWidth onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  figure: { flex: 1, minWidth: 0 },
});
