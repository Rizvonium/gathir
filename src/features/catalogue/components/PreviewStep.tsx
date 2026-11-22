/**
 * /catalogue/preview step 3: the real catalogue HTML (the exact source of the PDF) in a WebView,
 * pages fanning in once (PLAN §10), with the estimated size and automatic parts.
 */
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import WebView from 'react-native-webview';
import { useTranslation } from 'react-i18next';

import { formatBytes } from '@/pdf';
import { AppText, Button, ChipGroup, EmptyState, Icon, IconButton, Screen, Skeleton, useReduceMotionEnabled } from '@/ui/components';
import { useTheme } from '@/ui/theme';

import { useCataloguePreview } from '../hooks/useCataloguePreview';
import { useCustomerBrief } from '../hooks/useCustomerBrief';
import { useExitFlow } from '../hooks/useExitFlow';
import { previewHtml } from '../logic/previewHtml';
import { useCatalogueFlow } from '../store';

export function PreviewStep() {
  const { t } = useTranslation('catalogue');
  const { colors, space } = useTheme();
  const reduced = useReduceMotionEnabled();
  const exit = useExitFlow();
  const p = useCataloguePreview();
  const customer = useCustomerBrief(useCatalogueFlow((s) => s.customerId));
  const stats = p.stats[p.partIndex];

  const footer =
    p.status === 'ready' ? (
      customer ? (
        <View style={[styles.row, { gap: space.sm }]}>
          <Button
            label={t('preview.someoneElse')}
            variant="secondary"
            size="lg"
            onPress={() => router.push({ pathname: '/catalogue/send', params: { choose: '1' } })}
          />
          <Button
            testID="preview-send"
            label={t('preview.sendTo', { name: customer.name })}
            icon="send"
            size="lg"
            style={styles.flex}
            onPress={() => router.push({ pathname: '/catalogue/send', params: { to: customer.id } })}
          />
        </View>
      ) : (
        <Button testID="preview-send" label={t('preview.chooseRecipient')} icon="send" size="lg" fullWidth onPress={() => router.push('/catalogue/send')} />
      )
    ) : undefined;

  return (
    <Screen
      title={t('preview.title')}
      subtitle={stats ? t('preview.summary', { count: stats.items, pages: stats.pages, size: formatBytes(stats.estimatedBytes) }) : t('flow.step', { n: 3 })}
      leading={<IconButton icon="arrow-back" accessibilityLabel={t('flow.back')} onPress={() => router.back()} />}
      actions={<IconButton icon="close" accessibilityLabel={t('flow.close')} onPress={exit} />}
      padded={false}
      footer={footer}>
      {p.status === 'loading' ? <PreparingPages /> : null}
      {p.status === 'error' ? (
        <EmptyState
          illustration={<Icon name="error-outline" size={48} tone="danger" />}
          title={t('preview.errorTitle')}
          body={t('preview.errorBody')}
          actionLabel={t('common:actions.retry')}
          actionIcon="refresh"
          onAction={p.retry}
        />
      ) : null}
      {p.status === 'empty' ? (
        <EmptyState
          illustration={<Icon name="inventory-2" size={48} tone="textMuted" />}
          title={t('preview.emptyTitle')}
          body={t('preview.emptyBody')}
          actionLabel={t('preview.changeOptions')}
          actionIcon="tune"
          onAction={() => router.back()}
        />
      ) : null}
      {p.status === 'ready' && p.html ? (
        <View style={styles.flex}>
          {p.docs.length > 1 ? (
            <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm, gap: space.sm }}>
              <AppText variant="small" muted>
                {t('preview.split', { max: p.maxPerPart, parts: p.docs.length })}
              </AppText>
              <ChipGroup
                accessibilityLabel={t('preview.partsLabel')}
                mode="single"
                value={p.partIndex}
                onChange={p.setPartIndex}
                options={p.docs.map((_, i) => ({ value: i, label: t('preview.part', { index: i + 1 }) }))}
              />
            </View>
          ) : null}
          <WebView
            testID="catalogue-webview"
            key={p.partIndex}
            originWhitelist={['about:blank', 'data:*']}
            source={{ html: previewHtml(p.html, { background: colors.surfaceSunken, shadow: colors.scrim, reducedMotion: reduced }) }}
            style={[styles.flex, { backgroundColor: colors.surfaceSunken }]}
            javaScriptEnabled={false}
            setBuiltInZoomControls
            setDisplayZoomControls={false}
            textZoom={100}
            overScrollMode="never"
            accessibilityLabel={t('preview.pagesLabel')}
          />
        </View>
      ) : null}
    </Screen>
  );
}

/** Paper-shaped skeletons while photos are embedded: the layout does not jump when pages arrive. */
function PreparingPages() {
  const { t } = useTranslation('catalogue');
  const { colors, space } = useTheme();
  return (
    <View style={[styles.flex, { backgroundColor: colors.surfaceSunken, padding: space.xl, gap: space.lg, alignItems: 'center' }]} accessibilityLiveRegion="polite">
      <View style={{ gap: space.xs, alignItems: 'center' }}>
        <AppText weight="semibold">{t('preview.preparing')}</AppText>
        <AppText variant="small" muted align="center">
          {t('preview.preparingBody')}
        </AppText>
      </View>
      <View style={[styles.paper, { backgroundColor: colors.surface }]}>
        <Skeleton height={28} width="60%" rounded="sm" />
        <View style={[styles.row, { gap: space.md }]}>
          <Skeleton height={120} width="47%" rounded="md" />
          <Skeleton height={120} width="47%" rounded="md" />
        </View>
        <View style={[styles.row, { gap: space.md }]}>
          <Skeleton height={120} width="47%" rounded="md" />
          <Skeleton height={120} width="47%" rounded="md" />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row' },
  paper: { width: '86%', aspectRatio: 210 / 297, padding: 20, gap: 16, borderRadius: 2 },
});
