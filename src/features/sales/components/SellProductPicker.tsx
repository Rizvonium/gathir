/** Product step of the Sell sheet: search + photo tiles (in stock and recently sold first). */
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { ProductListRow } from '@/db/repo/productQueries';
import { formatINR } from '@/lib/money';
import { AppText, Button, PieceBadge, PressableScale, TextField } from '@/ui/components';
import { useTheme } from '@/ui/theme';

import { ProductThumb } from './SaleBits';

export type SellProductPickerProps = {
  search: string;
  onSearch: (q: string) => void;
  shown: ProductListRow[];
  total: number;
  lowStockLevel: number;
  onPick: (row: ProductListRow) => void;
  onAddProduct: () => void;
};

const COLUMNS = 3;

export function SellProductPicker({ search, onSearch, shown, total, lowStockLevel, onPick, onAddProduct }: SellProductPickerProps) {
  const { space, radius, colors } = useTheme();
  const { t } = useTranslation('sales');
  const { width } = useWindowDimensions();
  const tile = Math.floor((width - space.lg * 2 - space.sm * (COLUMNS - 1)) / COLUMNS);
  const q = search.trim();

  if (total === 0 && !q) {
    return (
      <View style={{ gap: space.md }}>
        <AppText variant="title" accessibilityRole="header">
          {t('sell.product')}
        </AppText>
        <AppText muted>{t('sell.noProducts')}</AppText>
        <Button label={t('sell.addProduct')} icon="add" variant="secondary" onPress={onAddProduct} style={styles.start} />
      </View>
    );
  }

  return (
    <View style={{ gap: space.md }}>
      <AppText variant="title" accessibilityRole="header">
        {t('sell.product')}
      </AppText>
      <TextField
        testID="sell-search"
        label={t('sell.searchProducts')}
        value={search}
        onChangeText={onSearch}
        autoCorrect={false}
        returnKeyType="search"
      />
      {shown.length === 0 ? (
        <AppText muted testID="sell-no-match">
          {t('sell.noMatch', { query: q })}
        </AppText>
      ) : (
        <View style={[styles.grid, { gap: space.sm }]}>
          {shown.map((row) => {
            const out = row.totalPieces <= 0;
            const label = out
              ? t('sell.productSoldOut', { name: row.name })
              : t('sell.pickProduct', { name: row.name, rate: formatINR(row.ratePaise), pieces: t('common:pieces', { count: row.totalPieces }) });
            return (
              <PressableScale
                key={row.id}
                testID={`sell-product-${row.id}`}
                disabled={out}
                onPress={() => onPick(row)}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ disabled: out }}
                style={[styles.tile, { width: tile, gap: space.xs, opacity: out ? 0.55 : 1 }]}>
                <View style={{ borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceSunken }}>
                  <ProductThumb productId={row.id} name={row.name} thumb={row.coverThumb} size={tile} recyclingKey={row.id} />
                </View>
                <AppText variant="small" weight="semibold" numberOfLines={2}>
                  {row.name}
                </AppText>
                <PieceBadge count={row.totalPieces} lowThreshold={lowStockLevel} size="sm" subjectId={row.id} />
              </PressableScale>
            );
          })}
        </View>
      )}
      {total > shown.length && shown.length > 0 ? (
        <AppText variant="small" muted>
          {t('sell.moreResults', { shown: shown.length, total })}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  tile: { alignItems: 'flex-start' },
  start: { alignSelf: 'flex-start' },
});
