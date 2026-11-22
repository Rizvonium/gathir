/** State and actions for the product detail screen (the screen itself only lays things out). */
import { router } from 'expo-router';
import { useState } from 'react';

import { useLowStockLevel, useProductDetail, useProductProfit, useStockHistory, useToday } from '@/db/hooks';
import type { Colour } from '@/db/schema';

import { productCardHref, editProductHref, sellHref } from '../logic/links';
import type { ReduceChoice } from '../logic/view';
import type { ReduceTarget } from '../components/ReduceSheet';
import { useStockActions } from './useStockActions';

export function useProductDetailScreen(productId: string | undefined) {
  const detail = useProductDetail(productId);
  const history = useStockHistory(productId);
  const lowThreshold = useLowStockLevel();
  // Start of today; re-renders at midnight so "Today" / "Yesterday" labels stay right.
  const today = useToday();
  const actions = useStockActions();
  const [reduceTarget, setReduceTarget] = useState<ReduceTarget | null>(null);
  // Seller-only buying price & profit: hidden each time the page opens (a customer may be looking).
  const [costVisible, setCostVisible] = useState(false);
  // "Add to a customer's catalogue" (PLAN §3): picks from the customer book; seller-only screen.
  const [customerSheetOpen, setCustomerSheetOpen] = useState(false);
  const profit = useProductProfit(costVisible ? productId : undefined);

  const colours = detail?.colours ?? [];
  const id = detail?.product.id;

  const closeReduce = () => setReduceTarget(null);

  const sell = (colourId?: string) => {
    if (!id) return;
    router.push(sellHref(id, colours, colourId));
  };

  const pickReason = (reason: ReduceChoice) => {
    const target = reduceTarget;
    closeReduce();
    if (!target) return;
    if (reason === 'sold') sell(target.colour.id);
    else actions.reduce(target.colour.id, Math.min(target.qty, target.colour.pieces), reason);
  };

  const remove = () => {
    if (!detail) return;
    if (actions.deleteProducts([{ id: detail.product.id, name: detail.product.name }])) {
      if (router.canGoBack()) router.back();
      else router.replace('/stock');
    }
  };

  return {
    detail,
    history,
    lowThreshold,
    now: today,
    costVisible,
    profit,
    toggleCost: () => setCostVisible((v) => !v),
    customerSheetOpen,
    openCustomerSheet: () => setCustomerSheetOpen(true),
    closeCustomerSheet: () => setCustomerSheetOpen(false),
    reduceTarget,
    requestReduce: (colour: Colour, qty: number) => setReduceTarget({ colour, qty }),
    setReduceQty: (qty: number) => setReduceTarget((cur) => (cur ? { ...cur, qty } : cur)),
    closeReduce,
    pickReason,
    restock: actions.restock,
    restore: () => detail && actions.restore(detail.product.id, detail.product.name),
    sell,
    send: () => id && router.push(productCardHref(id)),
    edit: () => id && router.push(editProductHref(id)),
    remove,
  };
}
