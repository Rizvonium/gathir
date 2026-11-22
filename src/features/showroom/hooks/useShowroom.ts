/** Showroom data: in-stock shawls only, per category, with the customer-safe settings. */
import { useState } from 'react';

import { useCategories, useLowStockLevel, useProducts, useSettings } from '@/db/hooks';

export function useShowroom() {
  const settings = useSettings();
  const lowStockLevel = useLowStockLevel();
  const categories = useCategories();
  const inStock = useProducts({ filter: 'in', sort: 'newest' });
  const [categoryId, setCategoryId] = useState<string | null>(null);

  const rail = categories
    .map((c) => ({ id: c.id, name: c.name, count: inStock.filter((p) => p.categoryId === c.id).length }))
    .filter((c) => c.count > 0);
  // A category that sold out while showing falls back to "All".
  const activeCategory = categoryId && rail.some((c) => c.id === categoryId) ? categoryId : null;
  const products = activeCategory ? inStock.filter((p) => p.categoryId === activeCategory) : inStock;

  return {
    products,
    totalInStock: inStock.length,
    rail,
    categoryId: activeCategory,
    setCategoryId,
    lowStockLevel,
    showExactCounts: settings?.showroomShowsExactCounts ?? false,
    pinSet: settings?.pinHashSet ?? false,
  };
}
