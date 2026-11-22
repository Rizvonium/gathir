/**
 * /customer/[id]/add-pieces: pick designs for a customer's personal catalogue. Search and category
 * chips narrow the grid; tap to tick (several at once); designs already in their catalogue are
 * marked and cannot be ticked again. One button adds them all, with Undo.
 */
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useCategories, useCustomerCatalogue, useCustomerProfile, useProducts } from '@/db/hooks';
import type { ProductListRow } from '@/db/repo/productQueries';
import { ProductThumb } from '@/features/catalogue/components/ProductThumb';
import { formatINR } from '@/lib/money';
import { AppText, Button, ChipGroup, EmptyState, Icon, IconButton, PressableScale, Screen, TextField } from '@/ui/components';
import { useTheme } from '@/ui/theme';

import { useTheirCatalogueActions } from '../hooks/useTheirCatalogue';
import { filterPickerProducts, idsToAdd } from '../logic/theirCatalogue';

const COLUMNS = 3;
const ALL = '';

const back = () => (router.canGoBack() ? router.back() : router.replace('/customers'));

export function AddPiecesScreen({ customerId }: { customerId: string | undefined }) {
  const { t } = useTranslation('customers');
  const { space } = useTheme();
  const { width } = useWindowDimensions();
  const profile = useCustomerProfile(customerId);
  const rows = useCustomerCatalogue(customerId);
  const products = useProducts({ sort: 'newest' });
  const categories = useCategories();
  const name = profile?.customer.name ?? '';
  const actions = useTheirCatalogueActions(customerId, name);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string>(ALL);
  const [picked, setPicked] = useState<string[]>([]);

  const already = new Set(rows.map((r) => r.productId));
  const toAdd = idsToAdd(picked, already);
  const shown = filterPickerProducts(products, { search, categoryId: categoryId || null });
  const usedCategories = categories.filter((c) => products.some((p) => p.categoryId === c.id));
  const tile = Math.floor((width - space.lg * 2 - space.sm * (COLUMNS - 1)) / COLUMNS);
  const closeButton = <IconButton icon="close" accessibilityLabel={t('profile.back')} onPress={back} testID="add-pieces-close" />;

  if (!profile || profile.customer.deletedAt !== null) {
    return (
      <Screen leading={closeButton}>
        <EmptyState title={t('profile.notFoundTitle')} body={t('profile.notFoundBody')} actionLabel={t('profile.back')} actionIcon="arrow-back" onAction={back} />
      </Screen>
    );
  }

  const header = (
    <View style={{ gap: space.md, paddingTop: space.md, paddingBottom: space.md }}>
      <TextField testID="add-pieces-search" label={t('theirCatalogue.picker.search')} value={search} onChangeText={setSearch} autoCorrect={false} returnKeyType="search" />
      {usedCategories.length > 0 ? (
        <ChipGroup
          accessibilityLabel={t('theirCatalogue.picker.categories')}
          mode="single"
          value={categoryId}
          onChange={setCategoryId}
          options={[{ value: ALL, label: t('list.all') }, ...usedCategories.map((c) => ({ value: c.id, label: c.name }))]}
        />
      ) : null}
      <AppText variant="small" muted>
        {t('theirCatalogue.picker.hint', { name })}
      </AppText>
    </View>
  );

  return (
    <Screen
      title={t('theirCatalogue.picker.title', { name })}
      leading={closeButton}
      edges={['top', 'bottom']}
      footer={
        <Button
          testID="add-pieces-confirm"
          label={toAdd.length > 0 ? t('theirCatalogue.picker.add', { count: toAdd.length }) : t('theirCatalogue.picker.addNone')}
          icon="playlist-add"
          size="lg"
          fullWidth
          disabled={toAdd.length === 0}
          onPress={() => {
            if (actions.add(toAdd, already)) back();
          }}
        />
      }>
      {products.length === 0 ? (
        <EmptyState title={t('theirCatalogue.picker.noProducts')} actionLabel={t('theirCatalogue.picker.addProduct')} actionIcon="add-a-photo" onAction={() => router.push('/product/new')} />
      ) : (
        <FlashList
          data={shown}
          numColumns={COLUMNS}
          keyExtractor={(p) => p.id}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={header}
          ListEmptyComponent={<AppText muted>{t('theirCatalogue.picker.noMatch')}</AppText>}
          extraData={`${picked.join()}|${[...already].join()}`}
          contentContainerStyle={{ paddingBottom: space.xl }}
          renderItem={({ item }) => (
            <View style={{ paddingBottom: space.md, alignItems: 'center' }}>
              <PieceTile
                product={item}
                size={tile}
                state={already.has(item.id) ? 'added' : picked.includes(item.id) ? 'picked' : 'none'}
                onToggle={() => setPicked((ids) => (ids.includes(item.id) ? ids.filter((x) => x !== item.id) : [...ids, item.id]))}
              />
            </View>
          )}
        />
      )}
    </Screen>
  );
}

function PieceTile({ product, size, state, onToggle }: { product: ProductListRow; size: number; state: 'none' | 'picked' | 'added'; onToggle: () => void }) {
  const { t } = useTranslation('customers');
  const { colors, space, radius } = useTheme();
  const soldOut = product.totalPieces <= 0;
  const added = state === 'added';
  const picked = state === 'picked';
  const label = [product.name, formatINR(product.ratePaise), soldOut ? t('theirCatalogue.availability.out') : null, added ? t('theirCatalogue.alreadyIn') : null]
    .filter(Boolean)
    .join('. ');
  return (
    <PressableScale
      testID={`add-pieces-${product.id}`}
      onPress={added ? undefined : onToggle}
      disabled={added}
      haptic="selection"
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: picked || added, disabled: added }}>
      <View style={{ width: size, gap: space.xs }}>
        <View style={[{ width: size, height: size, borderRadius: radius.md, overflow: 'hidden' }, (soldOut || added) && styles.dim]}>
          <ProductThumb productId={product.id} name={product.name} coverThumb={product.coverThumb} size={size} />
          {picked ? <View style={[StyleSheet.absoluteFill, styles.ring, { borderColor: colors.primary, borderRadius: radius.md }]} /> : null}
        </View>
        <View
          style={[
            styles.check,
            {
              top: space.xs,
              end: space.xs,
              backgroundColor: added ? colors.meadow : picked ? colors.primary : colors.scrim,
              borderColor: colors.onPrimary,
              borderRadius: radius.pill,
            },
          ]}>
          {picked || added ? <Icon name="check" size={18} color={colors.onPrimary} /> : null}
        </View>
        <AppText variant="caption" weight="semibold" numberOfLines={1}>
          {product.name}
        </AppText>
        <AppText variant="caption" muted numeric numberOfLines={1}>
          {added ? t('theirCatalogue.alreadyIn') : soldOut ? t('theirCatalogue.availability.out') : formatINR(product.ratePaise)}
        </AppText>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  dim: { opacity: 0.45 },
  ring: { borderWidth: 3 },
  check: { position: 'absolute', width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
});
