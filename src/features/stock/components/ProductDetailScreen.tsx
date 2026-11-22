import { router } from 'expo-router';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { formatINR } from '@/lib/money';
import { AppText, Button, Divider, EmptyState, IconButton, PieceBadge, RollingNumber, SectionHeader, warmShadow } from '@/ui/components';
import { PatternPlaceholder } from '@/ui/patterns';
import { useTheme } from '@/ui/theme';

import { useProductDetailScreen } from '../hooks/useProductDetailScreen';
import { ColourStockRow } from './ColourStockRow';
import { HistoryList } from './HistoryList';
import { PhotoGallery } from './PhotoGallery';
import { ReduceSheet } from './ReduceSheet';

/** Product detail (PLAN §4.4): photos, facts, colours & pieces, history, Sell / Send. */
export function ProductDetailScreen({ productId }: { productId: string | undefined }) {
  const { colors, space, radius, scheme } = useTheme();
  const { t } = useTranslation('stock');
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const s = useProductDetailScreen(productId);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/stock'));

  const topBar = (
    <View style={[styles.topBar, { top: insets.top + space.sm, paddingHorizontal: space.sm }]} pointerEvents="box-none">
      <IconButton icon="arrow-back" variant="tonal" accessibilityLabel={t('detail.back')} onPress={back} />
      {s.detail && s.detail.product.deletedAt === null ? (
        <View style={[styles.row, { gap: space.sm }]}>
          <IconButton icon="edit" variant="tonal" accessibilityLabel={t('detail.edit')} onPress={s.edit} testID="detail-edit" />
          <IconButton icon="delete-outline" variant="tonal" accessibilityLabel={t('detail.delete')} onPress={s.remove} testID="detail-delete" />
        </View>
      ) : null}
    </View>
  );

  if (!s.detail || s.detail.product.deletedAt !== null) {
    const deleted = !!s.detail;
    return (
      <View style={[styles.flex, { backgroundColor: colors.bg, paddingTop: insets.top + 64 }]}>
        <EmptyState
          title={deleted ? t('detail.deletedTitle') : t('detail.notFoundTitle')}
          body={deleted ? t('detail.deletedBody') : t('detail.notFoundBody')}
          actionLabel={deleted ? t('detail.restore') : undefined}
          actionIcon="restore"
          onAction={deleted ? s.restore : undefined}
        />
        {topBar}
      </View>
    );
  }

  const { product, category, colours, photos, totalPieces } = s.detail;
  const facts = [product.craft, product.material, product.size].filter(Boolean).join(' · ');
  const sellable = totalPieces > 0;

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: space.xxxl * 2 + insets.bottom }}>
        {photos.length > 0 ? (
          <PhotoGallery photos={photos} name={product.name} />
        ) : (
          <View style={{ width, height: Math.round(width * 0.9) }}>
            <PatternPlaceholder productId={product.id} name={product.name} radius={0} accessibilityLabel={t('noPhoto', { name: product.name })} />
            <Button
              label={t('detail.addPhotos')}
              icon="add-a-photo"
              variant="secondary"
              onPress={s.edit}
              style={[styles.addPhotos, { bottom: space.lg, end: space.lg }]}
            />
          </View>
        )}

        <View style={{ padding: space.lg, gap: space.xs }}>
          <AppText variant="display" accessibilityRole="header">
            {product.name}
          </AppText>
          <AppText muted>
            {[t('detail.code', { code: product.code }), category?.name].filter(Boolean).join(' · ')}
          </AppText>
          {facts ? <AppText>{facts}</AppText> : null}
        </View>

        <View style={[styles.row, { paddingHorizontal: space.lg, gap: space.md }]}>
          <View
            style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.card, padding: space.lg }, warmShadow(scheme)]}
            accessible
            accessibilityLabel={`${t('detail.rate')}: ${formatINR(product.ratePaise)}`}>
            <AppText variant="small" muted>
              {t('detail.rate')}
            </AppText>
            <AppText variant="heading" weight="bold" numeric>
              {formatINR(product.ratePaise)}
            </AppText>
          </View>
          <View
            style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.card, padding: space.lg, gap: space.xs }, warmShadow(scheme)]}>
            <AppText variant="small" muted>
              {t('detail.totalPieces')}
            </AppText>
            <RollingNumber value={totalPieces} variant="heading" weight="bold" accessibilityLabel={t('common:pieces', { count: totalPieces })} />
            <PieceBadge count={totalPieces} lowThreshold={s.lowThreshold} size="sm" />
          </View>
        </View>

        {product.costPaise !== null ? (
          <View style={[styles.row, styles.between, { paddingHorizontal: space.lg, paddingTop: space.md, gap: space.md }]}>
            <View style={styles.flex}>
              <AppText variant="small" muted>
                {t('detail.cost')}
              </AppText>
              <AppText weight="semibold" numeric>
                {s.costVisible ? formatINR(product.costPaise) : t('detail.costHidden')}
              </AppText>
              {s.costVisible ? (
                <AppText variant="caption" muted>
                  {t('detail.costOnlyYou')}
                </AppText>
              ) : null}
            </View>
            <IconButton
              icon={s.costVisible ? 'visibility-off' : 'visibility'}
              variant="tonal"
              accessibilityLabel={s.costVisible ? t('detail.hideCost') : t('detail.showCost')}
              onPress={s.toggleCost}
              testID="detail-cost-toggle"
            />
          </View>
        ) : null}

        <View style={{ paddingHorizontal: space.lg, paddingTop: space.xl }}>
          <SectionHeader title={product.oneOfAKind ? t('detail.oneOfAKind') : t('detail.colours')} />
          {product.oneOfAKind ? (
            <AppText variant="small" muted>
              {t('detail.oneOfAKindBody')}
            </AppText>
          ) : null}
          {colours.length === 0 ? <AppText muted>{t('detail.noColours')}</AppText> : null}
          {colours.map((c, i) => (
            <View key={c.id}>
              {i > 0 ? <Divider /> : null}
              <ColourStockRow
                colour={c}
                oneOfAKind={product.oneOfAKind}
                lowThreshold={s.lowThreshold}
                resetKey={s.resetKey}
                onRestock={s.restock}
                onRequestReduce={s.requestReduce}
                onSell={s.sell}
              />
            </View>
          ))}
        </View>

        {product.notes ? (
          <View style={{ paddingHorizontal: space.lg, paddingTop: space.xl, gap: space.xs }}>
            <SectionHeader title={t('detail.notes')} />
            <AppText selectable>{product.notes}</AppText>
          </View>
        ) : null}

        <View style={{ paddingHorizontal: space.lg, paddingTop: space.xl }}>
          <SectionHeader title={t('detail.history')} />
          <HistoryList rows={s.history} now={s.now} />
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: insets.bottom + space.md, gap: space.sm, backgroundColor: colors.bg, borderTopColor: colors.border },
        ]}>
        <Button label={t('detail.send')} icon="send" variant="tonal" size="lg" onPress={s.send} style={styles.flex} testID="detail-send" />
        <Button label={t('detail.sell')} icon="sell" size="lg" disabled={!sellable} onPress={() => s.sell()} style={styles.flex} testID="detail-sell" />
      </View>

      {topBar}
      <ReduceSheet target={s.reduceTarget} onQty={s.setReduceQty} onPick={s.pickReason} onClose={s.closeReduce} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  between: { justifyContent: 'space-between' },
  topBar: { position: 'absolute', start: 0, end: 0, flexDirection: 'row', justifyContent: 'space-between' },
  stat: { flex: 1, borderWidth: 1, alignSelf: 'stretch' },
  addPhotos: { position: 'absolute' },
  footer: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth },
});
