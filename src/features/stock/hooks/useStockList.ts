/**
 * Stock list state: search (deferred so typing stays smooth), category chip, filter chip,
 * sort, grid/compact view and multi-select. Data comes from live queries.
 */
import { useDeferredValue, useState } from 'react';

import { useCategories, useLowStockLevel, useProducts } from '@/db/hooks';
import type { ProductFilter, ProductListRow, ProductSort } from '@/db/repo/productQueries';

import { listTotals } from '../logic/view';

export type StockView = 'grid' | 'list';

export function useStockList() {
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [filter, setFilter] = useState<ProductFilter>('all');
  const [sort, setSort] = useState<ProductSort>('newest');
  const [view, setView] = useState<StockView>('grid');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const deferredSearch = useDeferredValue(search);
  const lowThreshold = useLowStockLevel();
  const categories = useCategories();
  const rows = useProducts({ search: deferredSearch, categoryId, filter, sort });
  // Distinguishes "no products at all" (first-use state) from "filtered to nothing".
  const anyProducts = useProducts({}).length > 0;

  const filtered = deferredSearch.trim() !== '' || categoryId !== null || filter !== 'all';
  const visibleIds = new Set(rows.map((r) => r.id));
  const selected = selectedIds.filter((id) => visibleIds.has(id));
  const selecting = selected.length > 0;

  const toggleSelect = (row: ProductListRow) =>
    setSelectedIds((cur) => (cur.includes(row.id) ? cur.filter((id) => id !== row.id) : [...cur, row.id]));

  return {
    rows,
    totals: listTotals(rows),
    anyProducts,
    filtered,
    lowThreshold,
    categories,
    search,
    setSearch,
    categoryId,
    setCategoryId,
    filter,
    setFilter,
    sort,
    setSort,
    view,
    toggleView: () => setView((v) => (v === 'grid' ? 'list' : 'grid')),
    selected,
    selecting,
    toggleSelect,
    selectAll: () => setSelectedIds(rows.map((r) => r.id)),
    clearSelection: () => setSelectedIds([]),
    clearFilters: () => {
      setSearch('');
      setCategoryId(null);
      setFilter('all');
    },
    selectedRows: () => rows.filter((r) => selected.includes(r.id)),
  };
}

export type StockListState = ReturnType<typeof useStockList>;
