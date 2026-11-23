/** Stock hooks. */
import { listDeletedCustomers, type DeletedCustomerRow } from '../repo/customerQueries';
import { listRecentlyDeleted, type DeletedProductRow } from '../repo/productLifecycle';
import {
  getProductDetail,
  hasAnyProduct,
  listProducts,
  stockHistory,
  type ProductDetail,
  type ProductListFilters,
  type ProductListRow,
  type StockHistoryRow,
} from '../repo/productQueries';
import { getLowStockLevel } from '../repo/settings';
import { useDbQuery } from './useDbQuery';

/** Stock list rows for the given search/category/filter/sort. lowStockLevel defaults to the setting. */
export function useProducts(filters: ProductListFilters = {}): ProductListRow[] {
  const { search, categoryId, filter, sort, lowStockLevel } = filters;
  return useDbQuery(
    (d) =>
      listProducts(d, { search, categoryId, filter, sort, lowStockLevel: lowStockLevel ?? getLowStockLevel(d) }),
    [search, categoryId, filter, sort, lowStockLevel],
  );
}

/** Whether the shop has any (live) product: tells "no stock yet" from "filtered to nothing". */
export function useHasAnyProduct(): boolean {
  return useDbQuery((d) => hasAnyProduct(d), [], { tables: ['products'] });
}

/** One product with category, colours, photos and total, or null when missing. */
export function useProductDetail(productId: string | undefined): ProductDetail | null {
  return useDbQuery((d) => (productId ? getProductDetail(d, productId, getLowStockLevel(d)) : null), [productId]);
}

/** Stock history for a product, newest first. */
export function useStockHistory(productId: string | undefined): StockHistoryRow[] {
  return useDbQuery((d) => (productId ? stockHistory(d, productId) : []), [productId]);
}

/** Recently deleted products and customers. */
export function useRecentlyDeleted(): { products: DeletedProductRow[]; customers: DeletedCustomerRow[] } {
  return useDbQuery((d) => ({ products: listRecentlyDeleted(d), customers: listDeletedCustomers(d) }), []);
}
