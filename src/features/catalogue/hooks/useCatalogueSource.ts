/** Step 1 "What to send": products, categories and suggestions with live counts. */
import { useState } from 'react';

import { useCategories, useCustomerCatalogue, useLowStockLevel, useProducts, useSuggestedProducts } from '@/db/hooks';
import type { CustomerCatalogueRow } from '@/db/repo/customerCatalogue';
import type { ProductListRow } from '@/db/repo/productQueries';

import { toggleId, toSelection, type FlowParams, type SourceKind } from '../logic/selection';
import { useCatalogueFlow } from '../store';
import { useCustomerBrief } from './useCustomerBrief';

export const SUGGESTION_LIMIT = 24;

export type CategoryOption = { id: string; name: string; inStock: number };

/** What a pick tile needs (a product row, or a customer-catalogue row shown with its rate for them). */
export type TileProduct = Pick<ProductListRow, 'id' | 'name' | 'ratePaise' | 'totalPieces' | 'coverThumb'>;

/** Their catalogue as tiles: the design id, their rate; designs in Recently deleted are left out. */
export function theirTiles(rows: readonly CustomerCatalogueRow[]): TileProduct[] {
  return rows
    .filter((r) => !r.productDeleted)
    .map((r) => ({ id: r.productId, name: r.name, ratePaise: r.ratePaise, totalPieces: r.totalPieces, coverThumb: r.coverThumb }));
}

/** Starts a fresh run from the link's params (once per mount of /catalogue). */
export function useStartCatalogueFlow(params: FlowParams): void {
  useState(() => {
    useCatalogueFlow.getState().start(params);
    return true;
  });
}

export function useCatalogueSource() {
  const source = useCatalogueFlow((s) => s.source);
  const customerId = useCatalogueFlow((s) => s.customerId);
  const setSource = useCatalogueFlow((s) => s.setSource);
  const customer = useCustomerBrief(customerId);
  const lowStockLevel = useLowStockLevel();

  const products = useProducts({ sort: 'newest' });
  const categories = useCategories();
  const suggested = useSuggestedProducts(customerId ?? undefined, SUGGESTION_LIMIT);
  const theirs = theirTiles(useCustomerCatalogue(customer ? customer.id : undefined));
  const theirSoldOut = theirs.filter((p) => p.totalPieces <= 0).length;

  const inStock = products.filter((p) => p.totalPieces > 0);
  const categoryOptions: CategoryOption[] = categories
    .map((c) => ({ id: c.id, name: c.name, inStock: inStock.filter((p) => p.categoryId === c.id).length }))
    .filter((c) => c.inStock > 0 || c.id === source.categoryId);

  const suggestedIds = suggested.map((p) => p.id);
  const selection = toSelection(source, suggestedIds, customer?.id ?? null);

  let count = 0;
  if (source.kind === 'all') count = inStock.length;
  if (source.kind === 'category') count = inStock.filter((p) => p.categoryId === source.categoryId).length;
  if (source.kind === 'selected') count = source.productIds.length;
  if (source.kind === 'suggested') count = suggested.length;
  if (source.kind === 'customer') count = theirs.length;

  /** Products in the order they were picked (deleted ones dropped). */
  const byId = new Map(products.map((p) => [p.id, p]));
  const picked: ProductListRow[] = source.productIds.map((id) => byId.get(id)).filter((p): p is ProductListRow => !!p);

  return {
    source,
    customer,
    lowStockLevel,
    products,
    inStockCount: inStock.length,
    categoryOptions,
    suggested,
    theirs,
    theirSoldOut,
    picked,
    selection,
    count,
    canContinue: selection !== null && count > 0,
    setKind: (kind: SourceKind) =>
      setSource((s) => ({ ...s, kind, categoryId: kind === 'category' ? (s.categoryId ?? categoryOptions[0]?.id ?? null) : s.categoryId })),
    setCategory: (categoryId: string) => setSource((s) => ({ ...s, kind: 'category', categoryId })),
    toggleProduct: (id: string) => setSource((s) => ({ ...s, kind: 'selected', productIds: toggleId(s.productIds, id) })),
    clearPicks: () => setSource((s) => ({ ...s, productIds: [] })),
    /** Freezes the suggestions for the rest of the run (call when leaving step 1). */
    confirm: () => setSource((s) => ({ ...s, suggestedIds })),
  };
}
