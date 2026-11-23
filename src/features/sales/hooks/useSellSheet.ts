/** Sell sheet controller: cart state, product lookups, createSale and undo. */
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { db } from '@/db/client';
import { useDbQuery, useLowStockLevel, useProducts, useToday } from '@/db/hooks';
import { getCustomerProfile } from '@/db/repo/customerQueries';
import { getProductDetail } from '@/db/repo/productQueries';
import { listSales } from '@/db/repo/saleQueries';
import { cancelSale, createSale, voidSale } from '@/db/repo/saleWrites';
import type { PaymentMethod } from '@/db/schema';
import type { ProductListRow } from '@/db/repo/productQueries';
import { addDays } from '@/lib/dates';
import { playHaptic } from '@/ui/components';

import { sellErrorKey } from '../logic/saleMessages';
import {
  addDraftToCart,
  clearProduct,
  draftMax,
  initialSellState,
  orderPickerProducts,
  pickColour,
  pickProduct,
  productOptionFromDetail,
  productOptionFromRow,
  recentProductIds,
  removeLine,
  sellSummary,
  setQty,
  setRate,
  toCreateSaleInput,
  WALK_IN,
  type CustomerChoice,
  type ProductOption,
  type SellLine,
  type SellState,
  type SellSummary,
} from '../logic/sellCart';

export type SellParams = { productId?: string; colourId?: string; customerId?: string };

export type SoldSale = { saleId: string; billNo: string; totalPaise: number; lines: SellLine[]; customerId: string | null; hasPhone: boolean };

/** How many products the picker shows before asking the seller to type more. */
export const PICKER_LIMIT = 12;

export type SellController = {
  state: SellState;
  product: ProductOption | null;
  summary: SellSummary;
  maxQty: number;
  search: string;
  setSearch: (q: string) => void;
  picker: { shown: ProductListRow[]; total: number; recentIds: string[]; lowStockLevel: number };
  choose: (row: ProductListRow) => void;
  changeProduct: () => void;
  chooseColour: (colourId: string) => void;
  setQty: (n: number) => void;
  setRate: (paise: number | null) => void;
  setPayment: (p: PaymentMethod) => void;
  setDiscount: (paise: number | null) => void;
  setNote: (note: string) => void;
  setCustomer: (c: CustomerChoice) => void;
  addAnother: () => void;
  removeLine: (key: string) => void;
  submitting: boolean;
  error: string | null;
  submit: () => SoldSale | null;
  undo: (saleId: string) => boolean;
};

function customerFromParam(id: string | undefined): CustomerChoice {
  if (!id) return WALK_IN;
  const profile = getCustomerProfile(db, id);
  if (!profile || profile.customer.deletedAt !== null) return WALK_IN;
  return { kind: 'existing', id: profile.customer.id, name: profile.customer.name, phone: profile.customer.phone };
}

export function useSellSheet(params: SellParams): SellController {
  const { t } = useTranslation('sales');
  const lowStockLevel = useLowStockLevel();
  const today = useToday();
  const [state, setState] = useState<SellState>(() => {
    const base = initialSellState(customerFromParam(params.customerId));
    const start = params.productId ? productOptionFromDetail(getProductDetail(db, params.productId)) : null;
    return start ? pickProduct(base, start, params.colourId) : base;
  });
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  const productId = state.draft.productId;
  const product = useDbQuery((d) => (productId ? productOptionFromDetail(getProductDetail(d, productId)) : null), [productId]);
  const rows = useProducts({ search: search.trim() || undefined, sort: 'newest' });
  const recentIds = useDbQuery((d) => recentProductIds(listSales(d, { from: addDays(today, -60), to: addDays(today, 1), includeCancelled: false })), [today]);
  const picker = { ...orderPickerProducts(rows, recentIds, PICKER_LIMIT), recentIds, lowStockLevel };
  const summary = sellSummary(state, product);

  const update = (fn: (s: SellState) => SellState) => {
    setError(null);
    setState(fn);
  };

  const submit = (): SoldSale | null => {
    if (busy.current || summary.blocker) return null;
    busy.current = true;
    setSubmitting(true);
    try {
      const result = createSale(db, toCreateSaleInput(state, summary.lines));
      playHaptic('success');
      const phone = state.customer.kind === 'walk_in' ? null : state.customer.phone;
      return { ...result, lines: summary.lines, hasPhone: !!phone };
    } catch (e) {
      playHaptic('error');
      setError(t(sellErrorKey(e)));
      busy.current = false;
      return null;
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Undo from the "Sold" toast: a true void (sale gone, pieces back, bill number freed when it was
   * the latest) within 2 minutes; after that, if the sale is already in a report, or once its bill
   * was sent to the customer, it becomes a normal return so the pieces still come back.
   */
  const undo = (saleId: string): boolean => {
    try {
      voidSale(db, saleId);
      return true;
    } catch {
      try {
        return cancelSale(db, saleId);
      } catch {
        return false;
      }
    }
  };

  return {
    state,
    product,
    summary,
    maxQty: draftMax(state, product),
    search,
    setSearch,
    picker,
    choose: (row) => update((s) => pickProduct(s, productOptionFromRow(row))),
    changeProduct: () => update(clearProduct),
    chooseColour: (colourId) => update((s) => (product ? pickColour(s, product, colourId) : s)),
    setQty: (n) => update((s) => setQty(s, n)),
    setRate: (paise) => update((s) => setRate(s, paise)),
    setPayment: (payment) => update((s) => ({ ...s, payment })),
    setDiscount: (discountPaise) => update((s) => ({ ...s, discountPaise })),
    setNote: (note) => update((s) => ({ ...s, note })),
    setCustomer: (customer) => update((s) => ({ ...s, customer })),
    addAnother: () => {
      update((s) => addDraftToCart(s, product));
      setSearch('');
    },
    removeLine: (key) => update((s) => removeLine(s, key)),
    submitting,
    error,
    submit,
    undo,
  };
}
