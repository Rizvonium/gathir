/** /catalogue step 1: what to send. Photo-first: the shawls themselves are the choice. */
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';

import { formatINR } from '@/lib/money';
import { AppText, Button, ChipGroup, EmptyState, Icon, IconButton, PressableScale, Screen, type ChipOption } from '@/ui/components';
import { LoomEmptyState } from '@/ui/patterns';
import { useTheme } from '@/ui/theme';

import { useCatalogueSource, type TileProduct } from '../hooks/useCatalogueSource';
import { useExitFlow } from '../hooks/useExitFlow';
import type { SourceKind } from '../logic/selection';
import { ProductThumb } from './ProductThumb';

const COLUMNS = 3;

export function SourceStep() {
  const { t } = useTranslation('catalogue');
  const { space } = useTheme();
  const { width } = useWindowDimensions();
  const exit = useExitFlow();
  const s = useCatalogueSource();
  const tile = Math.floor((width - space.lg * 2 - space.sm * (COLUMNS - 1)) / COLUMNS);

  const kinds: ChipOption<SourceKind>[] = [
    { value: 'all', label: t('source.all'), icon: 'inventory-2' },
    { value: 'category', label: t('source.category'), icon: 'category' },
    { value: 'selected', label: t('source.selected'), icon: 'touch-app' },
  ];
  if (s.customer) kinds.push({ value: 'suggested', label: t('source.suggested', { name: s.customer.name }), icon: 'favorite' });
  // Their personal catalogue comes first: it is what the seller most likely opened the flow for.
  if (s.customer && (s.theirs.length > 0 || s.source.kind === 'customer')) {
    kinds.unshift({ value: 'customer', label: t('source.theirs', { name: s.customer.name, count: s.theirs.length }), icon: 'bookmark' });
  }

  return (
    <Screen
      title={t('flow.title')}
      subtitle={t('flow.step', { n: 1 })}
      leading={<IconButton icon="close" accessibilityLabel={t('flow.close')} onPress={exit} />}
      footer={
        <Button
          testID="source-next"
          label={s.canContinue ? t('flow.next', { count: s.count }) : t('flow.nextEmpty')}
          icon="arrow-forward"
          size="lg"
          fullWidth
          disabled={!s.canContinue}
          onPress={() => {
            s.confirm();
            router.push('/catalogue/options');
          }}
        />
      }>
      {s.products.length === 0 ? (
        <EmptyState
          illustration={<LoomEmptyState />}
          title={t('source.emptyTitle')}
          body={t('source.emptyBody')}
          actionLabel={t('source.addProduct')}
          actionIcon="add-a-photo"
          onAction={() => router.push('/product/new')}
        />
      ) : (
        <SourceBody s={s} kinds={kinds} tile={tile} />
      )}
    </Screen>
  );
}

type Source = ReturnType<typeof useCatalogueSource>;

function SourceBody({ s, kinds, tile }: { s: Source; kinds: ChipOption<SourceKind>[]; tile: number }) {
  const { t } = useTranslation('catalogue');
  const { space } = useTheme();

  const gridData: TileProduct[] =
    s.source.kind === 'selected' ? s.products : s.source.kind === 'suggested' ? s.suggested : s.source.kind === 'customer' ? s.theirs : [];
  const picked = new Set(s.source.productIds);

  const top = (
    <View style={{ gap: space.lg, paddingTop: space.lg, paddingBottom: space.md }}>
      <ChipGroup accessibilityLabel={t('source.kindsLabel')} mode="single" value={s.source.kind} onChange={s.setKind} options={kinds} testID="source-kinds" />
      {s.source.kind === 'all' ? <AllPreview s={s} /> : null}
      {s.source.kind === 'category' ? (
        s.categoryOptions.length === 0 ? (
          <AppText muted>{t('source.noCategories')}</AppText>
        ) : (
          <ChipGroup
            accessibilityLabel={t('source.categoriesLabel')}
            mode="single"
            value={s.source.categoryId}
            onChange={s.setCategory}
            options={s.categoryOptions.map((c) => ({ value: c.id, label: t('source.categoryCount', { name: c.name, count: c.inStock }) }))}
          />
        )
      ) : null}
      {s.source.kind === 'selected' ? (
        <View style={[styles.row, { gap: space.sm }]}>
          <AppText muted style={styles.flex}>
            {s.source.productIds.length > 0 ? t('source.pickedCount', { count: s.source.productIds.length }) : t('source.pickHint')}
          </AppText>
          {s.source.productIds.length > 0 ? <Button label={t('source.clearPicks')} variant="ghost" size="sm" onPress={s.clearPicks} /> : null}
        </View>
      ) : null}
      {s.source.kind === 'customer' && s.customer ? (
        <View style={{ gap: space.xs }}>
          <AppText muted>{s.theirs.length > 0 ? t('source.theirsHint', { name: s.customer.name }) : t('source.theirsEmpty', { name: s.customer.name })}</AppText>
          {s.theirSoldOut > 0 ? (
            <View style={[styles.row, { gap: space.xs }]} testID="source-theirs-sold-out">
              <Icon name="info-outline" size={18} tone="textMuted" />
              <AppText variant="small" muted style={styles.flex}>
                {t('source.theirsSoldOut', { count: s.theirSoldOut })}
              </AppText>
            </View>
          ) : null}
        </View>
      ) : null}
      {s.source.kind === 'suggested' && s.customer ? (
        <AppText muted>
          {s.suggested.length > 0 ? t('source.suggestedHint', { name: s.customer.name }) : t('source.noSuggestions', { name: s.customer.name })}
        </AppText>
      ) : null}
    </View>
  );

  return (
    <FlashList
      data={gridData}
      numColumns={COLUMNS}
      keyExtractor={(p) => p.id}
      ListHeaderComponent={top}
      extraData={s.source.productIds}
      contentContainerStyle={{ paddingBottom: space.xl }}
      renderItem={({ item }) => (
        <View style={{ paddingBottom: space.sm, alignItems: 'center' }}>
          <PickTile
            product={item}
            size={tile}
            picked={picked.has(item.id)}
            onToggle={s.source.kind === 'selected' ? () => s.toggleProduct(item.id) : undefined}
          />
        </View>
      )}
    />
  );
}

/** A loose fan of the newest covers, so "All in stock" shows what goes in. */
function AllPreview({ s }: { s: Source }) {
  const { t } = useTranslation('catalogue');
  const { colors, space, radius } = useTheme();
  const covers = s.products.filter((p) => p.totalPieces > 0).slice(0, 5);
  return (
    <View style={[styles.allCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.card, padding: space.lg, gap: space.md }]}>
      <View style={styles.fan} importantForAccessibility="no-hide-descendants">
        {covers.map((p, i) => (
          <View
            key={p.id}
            style={[
              styles.fanItem,
              { marginStart: i === 0 ? 0 : -22, zIndex: covers.length - i, borderColor: colors.surface, borderRadius: radius.md, transform: [{ rotate: `${(i - 2) * 4}deg` }] },
            ]}>
            <ProductThumb productId={p.id} name={p.name} coverThumb={p.coverThumb} size={64} />
          </View>
        ))}
      </View>
      <AppText>{t('source.allBody', { count: s.inStockCount })}</AppText>
    </View>
  );
}

export function PickTile({ product, size, picked, onToggle }: { product: TileProduct; size: number; picked: boolean; onToggle?: () => void }) {
  const { t } = useTranslation('catalogue');
  const { colors, space, radius } = useTheme();
  const soldOut = product.totalPieces <= 0;
  const label = t('source.pickLabel', { name: product.name, rate: formatINR(product.ratePaise) }) + (soldOut ? `. ${t('source.soldOut')}` : '');
  const body = (
    <View style={{ width: size, gap: space.xs }}>
      <View style={[{ width: size, height: size, borderRadius: radius.md, overflow: 'hidden' }, soldOut && styles.dim]}>
        <ProductThumb productId={product.id} name={product.name} coverThumb={product.coverThumb} size={size} />
        {picked ? (
          <View style={[StyleSheet.absoluteFill, styles.pickedRing, { borderColor: colors.primary, borderRadius: radius.md }]} />
        ) : null}
        {onToggle ? (
          <View
            style={[
              styles.check,
              { top: space.xs, end: space.xs, backgroundColor: picked ? colors.primary : colors.scrim, borderColor: colors.onPrimary, borderRadius: radius.pill },
            ]}>
            {picked ? <Icon name="check" size={18} color={colors.onPrimary} /> : null}
          </View>
        ) : null}
      </View>
      <AppText variant="caption" weight="semibold" numberOfLines={1}>
        {product.name}
      </AppText>
      <AppText variant="caption" muted numeric numberOfLines={1}>
        {soldOut ? t('source.soldOut') : formatINR(product.ratePaise)}
      </AppText>
    </View>
  );
  if (!onToggle) {
    return (
      <View accessible accessibilityLabel={label}>
        {body}
      </View>
    );
  }
  return (
    <PressableScale
      testID={`pick-${product.id}`}
      onPress={onToggle}
      haptic="selection"
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: picked }}>
      {body}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  allCard: { borderWidth: StyleSheet.hairlineWidth },
  fan: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  fanItem: { borderWidth: 3, overflow: 'hidden' },
  dim: { opacity: 0.45 },
  pickedRing: { borderWidth: 3 },
  check: { position: 'absolute', width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
});
