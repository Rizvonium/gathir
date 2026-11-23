/**
 * Stock list state: search (deferred so typing stays smooth), category chip, filter chip,
 * sort, grid/compact view and multi-select. Data comes from live queries.
 */
import { useDeferredValue, useState } from 'react';

import { useCategories, useHasAnyProduct, useLowStockLevel, useProducts } from '@/db/hooks';
import type { ProductFilter, ProductListRow, ProductSort } from '@/db/repo/productQueries';

import type { StockListSeed } from '../logic/links';
import { listTotals } from '../logic/view';

export type StockView = 'grid' | 'list';

/** `seed` comes from the tab's link (e.g. Home's "See all" needs attention), applied once per link. */
export function useStockList(seed: StockListSeed | null = null) {
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [filter, setFilter] = useState<ProductFilter>(seed?.filter ?? 'all');
  const [sort, setSort] = useState<ProductSort>(seed?.sort ?? 'newest');
  // A new link while the tab is already open: apply it (adjusting state during render).
  const [seedKey, setSeedKey] = useState(seed?.key ?? null);
  if (seed && seed.key !== seedKey) {
    setSeedKey(seed.key);
    setSearch('');
    setCategoryId(null);
    setFilter(seed.filter);
    setSort(seed.sort);
  }
  const [view, setView] = useState<StockView>('grid');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const deferredSearch = useDeferredValue(search);
  const lowThreshold = useLowStockLevel();
  const categories = useCategories();
  const rows = useProducts({ search: deferredSearch, categoryId, filter, sort });
  // Distinguishes "no products at all" (first-use state) from "filtered to nothing". An EXISTS
  // check, not a second full stock list.
  const anyProducts = useHasAnyProduct();

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
