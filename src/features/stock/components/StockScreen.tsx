import { FlashList } from '@shopify/flash-list';
import { router, useIsFocused } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { ProductListRow } from '@/db/repo/productQueries';
import { Button, EmptyState, IconButton, Screen, useToast } from '@/ui/components';
import { LoomEmptyState } from '@/ui/patterns';
import { useTheme } from '@/ui/theme';

import { useStockActions } from '../hooks/useStockActions';
import { useStockList } from '../hooks/useStockList';
import { catalogueHref, editProductHref, productCardHref, productHref, sellHref } from '../logic/links';
import { ProductGridCard } from './ProductGridCard';
import { ProductRow } from './ProductRow';
import { StockFilters } from './StockFilters';
import { CategorySheet, RowMenuSheet, SortSheet, type RowMenuAction } from './StockSheets';

const NEW_PRODUCT = '/product/new' as const;
const DELETED = '/deleted' as const;

/** Stock tab: photo grid / compact list with search, chips, sort, swipe rows and multi-select. */
export function StockScreen() {
  const { colors, space, radius } = useTheme();
  const { t } = useTranslation('stock');
  const toast = useToast();
  const list = useStockList();
  const focused = useIsFocused();
  const actions = useStockActions();
  const [sortOpen, setSortOpen] = useState(false);
  const [menuRow, setMenuRow] = useState<ProductListRow | null>(null);
  const [categoryOpen, setCategoryOpen] = useState(false);

  const open = (row: ProductListRow) => router.push(productHref(row.id));
  const addProduct = () => router.push(NEW_PRODUCT);

  const onPress = (row: ProductListRow) => (list.selecting ? list.toggleSelect(row) : open(row));
  const onLongPress = (row: ProductListRow) => list.toggleSelect(row);

  const sellOne = (row: ProductListRow) => {
    if (row.totalPieces === 0) {
      toast.show({ message: t('toast.noSellable') });
      return;
    }
    router.push(sellHref(row.id, row.colours));
  };

  const deleteRow = (row: ProductListRow, collapseThen?: (commit: () => void) => void) => {
    const commit = () => actions.deleteProducts([{ id: row.id, name: row.name }]);
    if (collapseThen) collapseThen(commit);
    else commit();
  };

  const onMenuAction = (action: RowMenuAction, row: ProductListRow) => {
    if (action === 'sell') sellOne(row);
    if (action === 'open') open(row);
    if (action === 'edit') router.push(editProductHref(row.id));
    if (action === 'send') router.push(productCardHref(row.id));
    if (action === 'select') list.toggleSelect(row);
    if (action === 'delete') deleteRow(row);
  };

  const deleteSelected = () => {
    if (actions.deleteProducts(list.selectedRows().map((r) => ({ id: r.id, name: r.name })))) list.clearSelection();
  };

  const isGrid = list.view === 'grid';
  const piecesLabel = t('common:pieces', { count: list.totals.pieces });

  if (!list.anyProducts) {
    return (
      <Screen title={t('title')}>
        <EmptyState
          illustration={<LoomEmptyState width={240} />}
          title={t('empty.title')}
          body={t('empty.body')}
          actionLabel={t('empty.action')}
          actionIcon="add-a-photo"
          onAction={addProduct}
        />
        <Button label={t('deletedLink')} variant="ghost" icon="restore-from-trash" onPress={() => router.push(DELETED)} style={{ alignSelf: 'center', marginBottom: space.xl }} />
      </Screen>
    );
  }

  return (
    <Screen
      padded={false}
      title={list.selecting ? t('select.count', { count: list.selected.length }) : t('title')}
      subtitle={list.selecting ? undefined : t('summary', { count: list.totals.designs, pieces: piecesLabel })}
      leading={list.selecting ? <IconButton icon="close" accessibilityLabel={t('select.close')} onPress={list.clearSelection} /> : undefined}
      actions={
        list.selecting ? (
          <IconButton icon="select-all" accessibilityLabel={t('select.all')} onPress={list.selectAll} />
        ) : (
          <>
            <IconButton icon="sort" accessibilityLabel={t('sort.open')} onPress={() => setSortOpen(true)} testID="stock-sort" />
            <IconButton
              icon={isGrid ? 'view-list' : 'grid-view'}
              accessibilityLabel={isGrid ? t('view.list') : t('view.grid')}
              onPress={list.toggleView}
              testID="stock-view"
            />
          </>
        )
      }>
      <FlashList
        key={list.view}
        data={list.rows}
        numColumns={isGrid ? 2 : 1}
        keyExtractor={(r) => r.id}
        extraData={`${list.selected.join(',')}|${list.lowThreshold}|${focused}`}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingHorizontal: isGrid ? space.md : 0, paddingBottom: 120 }}
        ListHeaderComponent={
          <StockFilters
            search={list.search}
            onSearch={list.setSearch}
            categories={list.categories}
            categoryId={list.categoryId}
            onCategory={list.setCategoryId}
            filter={list.filter}
            onFilter={list.setFilter}
          />
        }
        ListHeaderComponentStyle={{ marginHorizontal: isGrid ? -space.md : 0 }}
        ListEmptyComponent={
          <EmptyState
            title={t('empty.noMatchTitle')}
            body={list.search.trim() ? t('empty.noMatchBody', { query: list.search.trim() }) : t('empty.noMatchFilterBody')}
            actionLabel={t('empty.clear')}
            actionIcon="filter-alt-off"
            onAction={list.clearFilters}
          />
        }
        ListFooterComponent={
          <Button label={t('deletedLink')} variant="ghost" icon="restore-from-trash" onPress={() => router.push(DELETED)} style={{ alignSelf: 'center', marginTop: space.lg }} />
        }
        ItemSeparatorComponent={isGrid ? undefined : () => <View style={[styles.separator, { backgroundColor: colors.border, marginStart: space.lg + 80 }]} />}
        renderItem={({ item }) =>
          isGrid ? (
            <ProductGridCard
              row={item}
              lowThreshold={list.lowThreshold}
              selecting={list.selecting}
              selected={list.selected.includes(item.id)}
              focused={focused}
              onPress={onPress}
              onLongPress={onLongPress}
            />
          ) : (
            <ProductRow
              row={item}
              lowThreshold={list.lowThreshold}
              selecting={list.selecting}
              selected={list.selected.includes(item.id)}
              focused={focused}
              onPress={onPress}
              onLongPress={onLongPress}
              onSellOne={sellOne}
              onDelete={deleteRow}
              onMenu={setMenuRow}
            />
          )
        }
      />

      <View pointerEvents="box-none" style={[styles.bottom, { paddingHorizontal: space.lg, paddingBottom: space.lg }]}>
        {list.selecting ? (
          <View style={[styles.selectBar, { gap: space.sm, backgroundColor: colors.surface, borderColor: colors.border, padding: space.sm, borderRadius: radius.card }]}>
            <Button label={t('select.catalogue')} icon="picture-as-pdf" size="md" style={styles.grow} onPress={() => router.push(catalogueHref(list.selected))} />
            <IconButton icon="label-outline" variant="tonal" accessibilityLabel={t('select.category')} onPress={() => setCategoryOpen(true)} />
            <IconButton icon="delete-outline" variant="tonal" color={colors.danger} accessibilityLabel={t('select.delete')} onPress={deleteSelected} />
          </View>
        ) : (
          <Button testID="stock-add" label={t('add')} icon="add" size="lg" onPress={addProduct} style={styles.fab} />
        )}
      </View>

      <SortSheet visible={sortOpen} sort={list.sort} onSort={list.setSort} onClose={() => setSortOpen(false)} />
      <RowMenuSheet row={menuRow} onAction={onMenuAction} onClose={() => setMenuRow(null)} />
      <CategorySheet
        visible={categoryOpen}
        categories={list.categories}
        onClose={() => setCategoryOpen(false)}
        onPick={(id, name) => {
          if (actions.setCategory(list.selected, id, name)) list.clearSelection();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  separator: { height: StyleSheet.hairlineWidth },
  bottom: { position: 'absolute', start: 0, end: 0, bottom: 0, alignItems: 'flex-end' },
  fab: { alignSelf: 'flex-end' },
  selectBar: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', borderWidth: 1 },
  grow: { flex: 1 },
});
