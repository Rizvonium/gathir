/** /report/preview — the real report (the exact HTML the PDF is printed from), with Send at the thumb. */
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import WebView from 'react-native-webview';
import { useTranslation } from 'react-i18next';

import { formatDate } from '@/lib/dates';
import { AppText, Button, EmptyState, Icon, IconButton, Screen, Skeleton } from '@/ui/components';
import { useTheme } from '@/ui/theme';

import { useReportPreview } from '../hooks/useReportPreview';
import { useReportSend } from '../hooks/useReportSend';
import { previewHtml } from '../previewHtml';
import { OWNER_SETTINGS_FROM_REPORT } from './ReportScreen';

export function ReportPreviewScreen() {
  const { t } = useTranslation('report');
  const { colors, space } = useTheme();
  const pv = useReportPreview();
  const s = useReportSend(pv.period, { fromPreview: true });
  const sendLabel = s.phase === 'preparing' ? t('send.preparing') : s.phase === 'sharing' ? t('send.opening') : t('send.button');

  const footer =
    pv.status === 'ready' ? (
      s.owner ? (
        <Button testID="preview-send" label={sendLabel} icon="send" size="lg" fullWidth loading={s.busy} disabled={s.busy} onPress={s.send} />
      ) : (
        <Button testID="preview-add-owner" label={t('owner.add')} icon="person-add" size="lg" fullWidth onPress={() => router.push(OWNER_SETTINGS_FROM_REPORT as never)} />
      )
    ) : undefined;

  return (
    <Screen
      testID="report-preview-screen"
      title={t('preview.title')}
      subtitle={t('period.range', { from: formatDate(pv.range.from), to: formatDate(pv.range.to) })}
      padded={false}
      edges={['top', 'bottom']}
      footer={footer}
      leading={<IconButton icon="arrow-back" accessibilityLabel={t('screen.back')} onPress={() => router.back()} />}>
      {pv.status === 'loading' ? (
        <View style={[styles.loading, { padding: space.lg, gap: space.md }]} accessibilityLabel={t('preview.loading')} accessible>
          <AppText muted accessibilityLiveRegion="polite">
            {t('preview.loading')}
          </AppText>
          <Skeleton height={420} rounded="md" />
        </View>
      ) : null}
      {pv.status === 'error' ? (
        <EmptyState
          illustration={<Icon name="error-outline" size={48} tone="danger" />}
          title={t('preview.errorTitle')}
          body={t('preview.errorBody')}
          actionLabel={t('common:actions.retry')}
          actionIcon="refresh"
          onAction={pv.retry}
        />
      ) : null}
      {pv.status === 'ready' && pv.html ? (
        <WebView
          testID="report-preview-webview"
          source={{ html: previewHtml(pv.html, { background: colors.surfaceSunken, shadow: colors.scrim }) }}
          style={[styles.flex, { backgroundColor: colors.surfaceSunken }]}
          javaScriptEnabled={false}
          setBuiltInZoomControls
          setDisplayZoomControls={false}
          accessibilityLabel={t('preview.a11y')}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loading: { flex: 1 },
});
