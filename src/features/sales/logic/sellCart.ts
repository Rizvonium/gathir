/**
 * Sell sheet state, pure. The sheet holds a small cart: finished `lines` plus the `draft`
 * line being picked (product → colour → quantity → rate). The one-item path never touches
 * the cart: the draft itself is sold when it is complete.
 */
import type { CreateSaleInput } from '@/db/repo/saleWrites';
import type { PaymentMethod } from '@/db/schema';

export type ProductOption = {
  id: string;
  name: string;
  ratePaise: number;
  /** Cover thumbnail file name (not a URI), or null. */
  thumb: string | null;
  colours: { id: string; name: string; hex: string; pieces: number }[];
};

export type SellLine = {
  key: string;
  productId: string;
  productName: string;
  colourId: string;
  colourName: string;
  colourHex: string;
  thumb: string | null;
  qty: number;
  ratePaise: number;
};

export type Draft = { productId: string | null; colourId: string | null; qty: number; ratePaise: number | null };

export type CustomerChoice =
  | { kind: 'walk_in' }
  | { kind: 'existing'; id: string; name: string; phone: string | null }
  | { kind: 'new'; name: string; phone: string | null };

export type SellState = {
  lines: SellLine[];
  draft: Draft;
  payment: PaymentMethod;
  discountPaise: number | null;
  note: string;
  customer: CustomerChoice;
};

export const WALK_IN: CustomerChoice = { kind: 'walk_in' };
export const EMPTY_DRAFT: Draft = { productId: null, colourId: null, qty: 1, ratePaise: null };

export function initialSellState(customer: CustomerChoice = WALK_IN): SellState {
  return { lines: [], draft: EMPTY_DRAFT, payment: 'cash', discountPaise: null, note: '', customer };
}

/** Pieces of a colour still free to sell: stock minus what the cart already holds. */
export function availableFor(colour: { id: string; pieces: number }, lines: readonly SellLine[]): number {
  const held = lines.filter((l) => l.colourId === colour.id).reduce((n, l) => n + l.qty, 0);
  return Math.max(0, colour.pieces - held);
}

/**
 * Colour to pre-pick: the preferred one when it still has pieces, else the only colour with
 * pieces (one tap fewer), else none (the seller chooses).
 */
export function autoColour(product: ProductOption, lines: readonly SellLine[], preferId?: string | null): string | null {
  const free = product.colours.filter((c) => availableFor(c, lines) > 0);
  if (preferId && free.some((c) => c.id === preferId)) return preferId;
  return free.length === 1 ? free[0].id : null;
}

/** Starts a draft for this product: colour pre-picked when obvious, 1 piece, the usual rate. */
export function pickProduct(state: SellState, product: ProductOption, preferColourId?: string | null): SellState {
  return {
    ...state,
    draft: { productId: product.id, colourId: autoColour(product, state.lines, preferColourId), qty: 1, ratePaise: product.ratePaise },
  };
}

export function clearProduct(state: SellState): SellState {
  return { ...state, draft: EMPTY_DRAFT };
}

/** Picks a colour and keeps the quantity within what that colour has left (at least 1). */
export function pickColour(state: SellState, product: ProductOption, colourId: string): SellState {
  const colour = product.colours.find((c) => c.id === colourId);
  if (!colour) return state;
  const max = availableFor(colour, state.lines);
  if (max < 1) return state;
  return { ...state, draft: { ...state.draft, colourId, qty: Math.min(Math.max(1, state.draft.qty), max) } };
}

export function setQty(state: SellState, qty: number): SellState {
  return { ...state, draft: { ...state.draft, qty: Math.max(1, Math.round(qty)) } };
}

export function setRate(state: SellState, ratePaise: number | null): SellState {
  return { ...state, draft: { ...state.draft, ratePaise } };
}

/** Max quantity for the draft's colour (0 when no colour is picked). */
export function draftMax(state: SellState, product: ProductOption | null): number {
  if (!product || !state.draft.colourId) return 0;
  const colour = product.colours.find((c) => c.id === state.draft.colourId);
  return colour ? availableFor(colour, state.lines) : 0;
}

export type DraftStatus = 'empty' | 'needs_colour' | 'needs_rate' | 'ready';

export function draftStatus(state: SellState, product: ProductOption | null): DraftStatus {
  if (!state.draft.productId || !product) return 'empty';
  if (!state.draft.colourId || draftMax(state, product) < 1) return 'needs_colour';
  if (state.draft.ratePaise === null) return 'needs_rate';
  return 'ready';
}

/** The draft as a cart line, when complete. */
export function draftLine(state: SellState, product: ProductOption | null): SellLine | null {
  if (draftStatus(state, product) !== 'ready' || !product) return null;
  const colour = product.colours.find((c) => c.id === state.draft.colourId);
  if (!colour) return null;
  return {
    key: `${colour.id}-${state.lines.length}`,
    productId: product.id,
    productName: product.name,
    colourId: colour.id,
    colourName: colour.name,
    colourHex: colour.hex,
    thumb: product.thumb,
    qty: Math.min(state.draft.qty, draftMax(state, product)),
    ratePaise: state.draft.ratePaise ?? 0,
  };
}

/** "+ Add another item": moves the complete draft into the cart and starts a fresh draft. */
export function addDraftToCart(state: SellState, product: ProductOption | null): SellState {
  const line = draftLine(state, product);
  if (!line) return state;
  const key = `${line.colourId}-${Date.now().toString(36)}-${state.lines.length}`;
  return { ...state, lines: [...state.lines, { ...line, key }], draft: EMPTY_DRAFT };
}

export function removeLine(state: SellState, key: string): SellState {
  return { ...state, lines: state.lines.filter((l) => l.key !== key) };
}

/** Everything that will be sold: cart lines plus the draft when it is complete. */
export function saleLines(state: SellState, product: ProductOption | null): SellLine[] {
  const line = draftLine(state, product);
  return line ? [...state.lines, line] : state.lines;
}

export function subtotalOf(lines: readonly SellLine[]): number {
  return lines.reduce((s, l) => s + l.qty * l.ratePaise, 0);
}

export type SellBlocker = 'needs_product' | 'needs_colour' | 'needs_rate' | 'discount_too_high' | 'customer_name' | null;

export type SellSummary = { lines: SellLine[]; subtotalPaise: number; totalPaise: number; pieces: number; blocker: SellBlocker };

/**
 * What the big button shows and whether it can sell. A half-picked draft blocks selling
 * (otherwise the seller would lose the item they were picking without noticing).
 */
export function sellSummary(state: SellState, product: ProductOption | null): SellSummary {
  const lines = saleLines(state, product);
  const subtotalPaise = subtotalOf(lines);
  const discount = state.discountPaise ?? 0;
  const status = draftStatus(state, product);
  let blocker: SellBlocker = null;
  if (status === 'needs_colour') blocker = 'needs_colour';
  else if (status === 'needs_rate') blocker = 'needs_rate';
  else if (lines.length === 0) blocker = 'needs_product';
  else if (discount > subtotalPaise) blocker = 'discount_too_high';
  else if (state.customer.kind === 'new' && !state.customer.name.trim()) blocker = 'customer_name';
  return {
    lines,
    subtotalPaise,
    totalPaise: Math.max(0, subtotalPaise - discount),
    pieces: lines.reduce((n, l) => n + l.qty, 0),
    blocker,
  };
}

/** Input for createSale. Walk-in sends no customer; a new customer is created (or reused by phone) in the same transaction. */
export function toCreateSaleInput(state: SellState, lines: readonly SellLine[]): CreateSaleInput {
  const input: CreateSaleInput = {
    items: lines.map((l) => ({ colourId: l.colourId, qty: l.qty, ratePaise: l.ratePaise })),
    payment: state.payment,
    discountPaise: state.discountPaise ?? 0,
  };
  const note = state.note.trim();
  if (note) input.note = note;
  if (state.customer.kind === 'existing') input.customerId = state.customer.id;
  if (state.customer.kind === 'new') input.newCustomer = { name: state.customer.name.trim(), phone: state.customer.phone };
  return input;
}

/** Products for the picker: in stock first, recently sold first, then the list order; capped. */
export function orderPickerProducts<T extends { id: string; totalPieces: number }>(
  rows: readonly T[],
  recentIds: readonly string[],
  limit: number,
): { shown: T[]; total: number } {
  const rank = new Map(recentIds.map((id, i) => [id, i]));
  const sorted = rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const outA = a.row.totalPieces > 0 ? 0 : 1;
      const outB = b.row.totalPieces > 0 ? 0 : 1;
      if (outA !== outB) return outA - outB;
      const ra = rank.get(a.row.id) ?? Number.MAX_SAFE_INTEGER;
      const rb = rank.get(b.row.id) ?? Number.MAX_SAFE_INTEGER;
      return ra - rb || a.index - b.index;
    })
    .map((x) => x.row);
  return { shown: sorted.slice(0, limit), total: rows.length };
}

/** Product ids from recent sales, most recent first, without repeats. */
export function recentProductIds(sales: readonly { cancelledAt: number | null; items: { productId: string }[] }[], limit = 12): string[] {
  const ids: string[] = [];
  for (const s of sales) {
    if (s.cancelledAt !== null) continue;
    for (const it of s.items) {
      if (!ids.includes(it.productId)) ids.push(it.productId);
      if (ids.length >= limit) return ids;
    }
  }
  return ids;
}

/** Picker option from a product detail (null when the product was deleted). */
export function productOptionFromDetail(
  detail: { product: { id: string; name: string; ratePaise: number; deletedAt: number | null }; colours: { id: string; name: string; hex: string; pieces: number }[]; photos: { thumbName: string }[] } | null,
): ProductOption | null {
  if (!detail || detail.product.deletedAt !== null) return null;
  return {
    id: detail.product.id,
    name: detail.product.name,
    ratePaise: detail.product.ratePaise,
    thumb: detail.photos[0]?.thumbName ?? null,
    colours: detail.colours.map((c) => ({ id: c.id, name: c.name, hex: c.hex, pieces: c.pieces })),
  };
}

/** Picker option from a stock list row. */
export function productOptionFromRow(row: { id: string; name: string; ratePaise: number; coverThumb: string | null; colours: ProductOption['colours'] }): ProductOption {
  return { id: row.id, name: row.name, ratePaise: row.ratePaise, thumb: row.coverThumb, colours: row.colours };
}
