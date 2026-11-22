import { addTestProduct, DAY, T0 } from '@/db/__tests__/fixtures';
import { getProductDetail } from '@/db/repo/productQueries';
import type { ProfitBreakdowns, ProfitGroupRow } from '@/db/repo/profit';
import { createSale } from '@/db/repo/saleWrites';
import { listSales } from '@/db/repo/saleQueries';
import { emptyDraft, addColour, costWarnings, draftFromDetail, setColourCost, setFields } from '@/features/stock/logic/draft';
import { saveDraft } from '@/features/stock/logic/saveDraft';
import { draftLine, initialSellState, pickProduct, productOptionFromDetail } from '@/features/sales/logic/sellCart';
import { profitOfRows } from '@/features/sales/logic/salesList';
import { endOfDay, startOfDay, startOfMonth, startOfWeek } from '@/lib/dates';
import { createTestDb } from '@/test/testDb';

import {
  barShare,
  breakdownRows,
  cartProfit,
  formatMargin,
  formatProfit,
  profitRange,
  profitState,
  profitTone,
  rateMargin,
} from '../logic';
import { useProfitPrivacy } from '../privacy';

const TODAY = startOfDay(T0);

describe('profitRange', () => {
  it('today / week / month end at the end of today', () => {
    expect(profitRange('today', TODAY)).toEqual({ from: TODAY, to: endOfDay(TODAY) });
    expect(profitRange('week', TODAY)).toEqual({ from: startOfWeek(TODAY), to: endOfDay(TODAY) });
    expect(profitRange('month', TODAY)).toEqual({ from: startOfMonth(TODAY), to: endOfDay(TODAY) });
  });

  it('custom days work in either order and default to today', () => {
    const a = TODAY - 3 * DAY;
    expect(profitRange('custom', TODAY, TODAY, a)).toEqual({ from: a, to: endOfDay(TODAY) });
    expect(profitRange('custom', TODAY, null, null)).toEqual({ from: TODAY, to: endOfDay(TODAY) });
    expect(profitRange('custom', TODAY, a, null)).toEqual({ from: a, to: endOfDay(a) });
  });
});

describe('formatting', () => {
  it('margins keep one decimal and a real minus sign', () => {
    expect(formatMargin(38.5)).toBe('38.5%');
    expect(formatMargin(20)).toBe('20%');
    expect(formatMargin(-4.2)).toBe('−4.2%');
    expect(formatMargin(null)).toBeNull();
  });

  it('money for a loss gets a minus sign, Indian grouping kept', () => {
    expect(formatProfit(12_500_000)).toBe('₹1,25,000');
    expect(formatProfit(-50_000)).toBe('−₹500');
    expect(profitTone(1)).toBe('meadow');
    expect(profitTone(-1)).toBe('danger');
    expect(profitTone(0)).toBe('text');
  });

  it('profit at the normal rate', () => {
    expect(rateMargin(650_000, 400_000)).toEqual({ profitPaise: 250_000, marginPct: 38.5 });
    expect(rateMargin(650_000, null)).toBeNull();
    expect(rateMargin(300_000, 400_000)?.profitPaise).toBe(-100_000);
  });
});

describe('profitState', () => {
  const base = { revenuePaise: 0, knownRevenuePaise: 0, knownCostPaise: 0, unknownCostItems: 0, pieces: 0 };
  it('tells nothing sold, all unknown, partly unknown and fully known apart', () => {
    expect(profitState(base)).toBe('none');
    expect(profitState({ ...base, revenuePaise: 500, pieces: 1, unknownCostItems: 1 })).toBe('unknown');
    expect(profitState({ ...base, revenuePaise: 900, knownRevenuePaise: 400, knownCostPaise: 300, pieces: 2, unknownCostItems: 1 })).toBe('partial');
    expect(profitState({ ...base, revenuePaise: 400, knownRevenuePaise: 400, knownCostPaise: 300, pieces: 1 })).toBe('full');
  });
});

describe('cartProfit (Sell sheet preview)', () => {
  it('shares the discount by value, like the saved sale', () => {
    const p = cartProfit(
      [
        { qty: 2, ratePaise: 650_000, costPaise: 400_000 },
        { qty: 1, ratePaise: 300_000, costPaise: 200_000 },
      ],
      160_000,
    );
    expect(p.profitPaise).toBe(500_000 + 100_000 - 160_000);
    expect(p.belowCost).toBe(false);
    expect(p.loss).toBe(false);
    expect(p.fullProfitPaise).toBe(440_000);
  });

  it('flags a rate below the buying price and a loss', () => {
    const p = cartProfit([{ qty: 1, ratePaise: 350_000, costPaise: 400_000 }], null);
    expect(p.belowCost).toBe(true);
    expect(p.loss).toBe(true);
    expect(p.profitPaise).toBe(-50_000);
  });

  it('a too-big discount (blocked by the sheet anyway) is capped at the subtotal', () => {
    const p = cartProfit([{ qty: 1, ratePaise: 100_000, costPaise: 50_000 }], 999_999);
    expect(p.revenuePaise).toBe(0);
    expect(p.loss).toBe(false);
  });

  it('no buying price → unknown, never 100 %', () => {
    const p = cartProfit([{ qty: 1, ratePaise: 650_000 }], 0);
    expect(profitState(p)).toBe('unknown');
    expect(p.profitPaise).toBe(0);
    expect(p.marginPct).toBeNull();
    expect(p.unknownCostItems).toBe(1);
    expect(p.belowCost).toBe(false);
  });
});

describe('breakdown tabs', () => {
  const row = (key: string, profitPaise: number, at: number | null = null): ProfitGroupRow => ({
    key,
    label: key,
    at,
    profitPaise,
    revenuePaise: 0,
    knownRevenuePaise: 0,
    knownCostPaise: 0,
    marginPct: null,
    unknownCostItems: 0,
    pieces: 0,
    salesCount: 0,
  });
  const b = {
    summary: row('s', 0),
    byDay: [row('d1', 1, 1), row('d2', 2, 2)],
    byProduct: [row('p', 5)],
    byCategory: [row('c', 4)],
    byCustomer: [row('u', 3)],
  } as ProfitBreakdowns;

  it('days are newest first; the others keep the repo order', () => {
    expect(breakdownRows(b, 'day').map((r) => r.key)).toEqual(['d2', 'd1']);
    expect(b.byDay.map((r) => r.key)).toEqual(['d1', 'd2']);
    expect(breakdownRows(b, 'product')[0].key).toBe('p');
    expect(breakdownRows(b, 'category')[0].key).toBe('c');
    expect(breakdownRows(b, 'customer')[0].key).toBe('u');
  });

  it('bars are relative to the biggest profit; losses get none', () => {
    const rows = [row('a', 400), row('b', 100), row('c', -50)];
    expect(barShare(400, rows)).toBe(1);
    expect(barShare(100, rows)).toBe(0.25);
    expect(barShare(-50, rows)).toBe(0);
    expect(barShare(0, [row('z', 0)])).toBe(0);
  });
});

describe('profit privacy store', () => {
  it('is visible by default and toggles for every screen', () => {
    expect(useProfitPrivacy.getState().hidden).toBe(false);
    useProfitPrivacy.getState().toggle();
    expect(useProfitPrivacy.getState().hidden).toBe(true);
    useProfitPrivacy.getState().setHidden(false);
    expect(useProfitPrivacy.getState().hidden).toBe(false);
  });
});

describe('per-colour buying price in the product draft', () => {
  it('sets, clears and warns when a price is above the rate', () => {
    let d = setFields(emptyDraft(T0), { ratePaise: 500_000, costPaise: 400_000 });
    d = addColour(d, 'Red', '#C0262D');
    const key = d.colours[0].key;
    d = setColourCost(d, key, 550_000);
    expect(d.colours[0].costPaise).toBe(550_000);
    expect(costWarnings(d)).toEqual({ rateBelowCost: false, coloursBelowCost: [key] });
    expect(setColourCost(d, key, -1)).toBe(d);
    d = setColourCost(d, key, null);
    expect(d.colours[0].costPaise).toBeNull();
    expect(costWarnings(setFields(d, { costPaise: 600_000 })).rateBelowCost).toBe(true);
  });

  it('new product: colour override saved; edit: only a changed override is written', () => {
    const db = createTestDb();
    let d = setFields(emptyDraft(T0), { ratePaise: 650_000, costPaise: 400_000 });
    d = addColour(d, 'Red', '#C0262D');
    d = addColour(d, 'Beige', '#D8C3A5');
    d = setColourCost(d, d.colours[1].key, 450_000);
    const { productId } = saveDraft(db, d, 'Sozni stole', T0);
    const saved = getProductDetail(db, productId);
    expect(saved?.product.costPaise).toBe(400_000);
    expect(saved?.colours.map((c) => [c.name, c.costPaise])).toEqual([
      ['Red', null],
      ['Beige', 450_000],
    ]);

    // Edit: draft starts from the saved values (override kept), then Red gets its own price and Beige goes back to the design's.
    let e = draftFromDetail(saved!, T0 + DAY);
    expect(e.colours[1].costPaise).toBe(450_000);
    e = setColourCost(e, e.colours[0].key, 420_000);
    e = setColourCost(e, e.colours[1].key, null);
    saveDraft(db, e, 'Sozni stole', T0 + DAY);
    expect(getProductDetail(db, productId)?.colours.map((c) => c.costPaise)).toEqual([420_000, null]);
  });
});

describe('Sell sheet cost lookup', () => {
  it('each line carries the colour price, else the design price (seller-only preview)', () => {
    const db = createTestDb();
    const { productId, colourIds } = addTestProduct(db, {
      costPaise: 400_000,
      colours: [
        { name: 'Red', hex: '#C0262D', pieces: 3, costPaise: 450_000 },
        { name: 'Beige', hex: '#D8C3A5', pieces: 2 },
      ],
    });
    const option = productOptionFromDetail(getProductDetail(db, productId));
    expect(option?.colours.map((c) => c.costPaise)).toEqual([450_000, 400_000]);
    const state = pickProduct(initialSellState(), option!, colourIds[1]);
    expect(draftLine(state, option)?.costPaise).toBe(400_000);
  });

  it('a design without any buying price gives unknown (null) costs', () => {
    const db = createTestDb();
    const { productId } = addTestProduct(db, { costPaise: null });
    const option = productOptionFromDetail(getProductDetail(db, productId));
    expect(option?.colours.every((c) => c.costPaise === null)).toBe(true);
  });
});

describe('Sales tab profit (profitOfRows)', () => {
  it('follows the listed rows, skips returns and leaves unknown costs out', () => {
    const db = createTestDb();
    const known = addTestProduct(db, { name: 'Known', costPaise: 400_000 });
    const unknown = addTestProduct(db, { name: 'Unknown', costPaise: null });
    createSale(db, { items: [{ colourId: known.colourIds[0], qty: 2, ratePaise: 650_000 }], discountPaise: 100_000 }, T0);
    createSale(db, { items: [{ colourId: unknown.colourIds[0], qty: 1, ratePaise: 500_000 }] }, T0 + 1000);
    const rows = listSales(db, { from: startOfDay(T0), to: endOfDay(T0) });
    const p = profitOfRows(rows);
    expect(p.profitPaise).toBe(2 * 250_000 - 100_000);
    expect(p.knownRevenuePaise).toBe(1_200_000);
    expect(p.revenuePaise).toBe(1_700_000);
    expect(p.unknownCostItems).toBe(1);
    expect(p.marginPct).toBe(33.3);
    expect(profitOfRows(rows.map((r) => ({ ...r, cancelledAt: T0 })))).toMatchObject({ profitPaise: 0, revenuePaise: 0, unknownCostItems: 0, marginPct: null });
  });
});
