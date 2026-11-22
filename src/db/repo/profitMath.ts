/**
 * Profit maths (PLAN §3 "Buying price & profit"). Pure: no database, no expo imports.
 *
 * Rules:
 * - Item profit = (selling rate − buying price) × qty.
 * - A bill discount is shared between the bill's items in proportion to their value
 *   (largest-remainder rounding, so the shares add up to the discount exactly).
 * - An item whose buying price is unknown has UNKNOWN profit. It is counted in revenue but never
 *   as 100 % profit: totals add up only the items whose buying price is known, and say how many
 *   items were left out (`unknownCostItems`).
 */

/** Effective buying price of a colour: its own override, else the product's, else unknown. */
export function effectiveCost(colourCostPaise: number | null | undefined, productCostPaise: number | null | undefined): number | null {
  return colourCostPaise ?? productCostPaise ?? null;
}

export type ProfitLineInput = { qty: number; ratePaise: number; costPaise: number | null };

/** (rate − cost) × qty, or null when the cost is unknown. Before any bill discount. */
export function itemProfit(line: ProfitLineInput): number | null {
  return line.costPaise === null ? null : (line.ratePaise - line.costPaise) * line.qty;
}

/**
 * Splits `discount` over `weights` in proportion (largest remainder). Shares are whole paise and
 * add up to `discount` exactly. All-zero weights → the discount goes to the first item.
 */
export function allocateDiscount(weights: readonly number[], discount: number): number[] {
  if (weights.length === 0) return [];
  const total = weights.reduce((s, w) => s + w, 0);
  if (discount === 0) return weights.map(() => 0);
  if (total <= 0) return weights.map((_, i) => (i === 0 ? discount : 0));
  const exact = weights.map((w) => (w * discount) / total);
  const shares = exact.map(Math.floor);
  let left = discount - shares.reduce((s, x) => s + x, 0);
  const order = exact.map((x, i) => ({ i, frac: x - Math.floor(x) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; left > 0; k = (k + 1) % order.length, left--) shares[order[k].i] += 1;
  return shares;
}

export type LineProfit = {
  /** qty × rate, before the bill discount. */
  grossPaise: number;
  discountSharePaise: number;
  /** grossPaise − discountSharePaise. */
  revenuePaise: number;
  /** cost × qty, or null when unknown. */
  costPaise: number | null;
  /** revenue − cost, or null when unknown. */
  profitPaise: number | null;
};

export type ProfitTotals = {
  /** Money taken (after discounts), every item. */
  revenuePaise: number;
  /** Revenue of the items whose buying price is known. */
  knownRevenuePaise: number;
  /** Buying price × qty of the items whose buying price is known. */
  knownCostPaise: number;
  /** Profit on the items whose buying price is known (knownRevenue − knownCost). */
  profitPaise: number;
  /** profit ÷ known revenue, one decimal (e.g. 23.5); null when there is no known revenue. */
  marginPct: number | null;
  /** Sale items (lines) whose buying price is unknown: their profit is not counted. */
  unknownCostItems: number;
  pieces: number;
};

export type SaleProfit = ProfitTotals & {
  /** Profit of the whole bill, or null when any item's buying price is unknown. */
  fullProfitPaise: number | null;
  lines: LineProfit[];
};

/** Margin in percent with one decimal, or null when revenue is 0. */
export function marginPct(profitPaise: number, revenuePaise: number): number | null {
  if (revenuePaise <= 0) return null;
  return Math.round((profitPaise / revenuePaise) * 1000) / 10;
}

export const EMPTY_TOTALS: ProfitTotals = {
  revenuePaise: 0,
  knownRevenuePaise: 0,
  knownCostPaise: 0,
  profitPaise: 0,
  marginPct: null,
  unknownCostItems: 0,
  pieces: 0,
};

/** Adds one line into running totals (marginPct is filled by `finishTotals`). */
export function addLine(t: ProfitTotals, line: LineProfit, qty: number): ProfitTotals {
  const known = line.costPaise !== null;
  return {
    revenuePaise: t.revenuePaise + line.revenuePaise,
    knownRevenuePaise: t.knownRevenuePaise + (known ? line.revenuePaise : 0),
    knownCostPaise: t.knownCostPaise + (line.costPaise ?? 0),
    profitPaise: t.profitPaise + (line.profitPaise ?? 0),
    marginPct: null,
    unknownCostItems: t.unknownCostItems + (known ? 0 : 1),
    pieces: t.pieces + qty,
  };
}

/** Sets marginPct from the summed values. */
export function finishTotals(t: ProfitTotals): ProfitTotals {
  return { ...t, marginPct: marginPct(t.profitPaise, t.knownRevenuePaise) };
}

/** Profit of one bill, with the discount shared between its lines. */
export function computeSaleProfit(sale: { discountPaise: number; items: readonly ProfitLineInput[] }): SaleProfit {
  const gross = sale.items.map((i) => i.qty * i.ratePaise);
  const shares = allocateDiscount(gross, sale.discountPaise);
  const lines: LineProfit[] = sale.items.map((i, k) => {
    const revenuePaise = gross[k] - shares[k];
    const costPaise = i.costPaise === null ? null : i.costPaise * i.qty;
    return {
      grossPaise: gross[k],
      discountSharePaise: shares[k],
      revenuePaise,
      costPaise,
      profitPaise: costPaise === null ? null : revenuePaise - costPaise,
    };
  });
  let totals = EMPTY_TOTALS;
  lines.forEach((l, k) => {
    totals = addLine(totals, l, sale.items[k].qty);
  });
  totals = finishTotals(totals);
  return { ...totals, fullProfitPaise: totals.unknownCostItems > 0 ? null : totals.profitPaise, lines };
}
