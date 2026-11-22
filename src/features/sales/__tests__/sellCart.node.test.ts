import { addTestProduct, expectNoDrift, T0 } from '@/db/__tests__/fixtures';
import { createCustomer } from '@/db/repo/customerWrites';
import { getProductDetail } from '@/db/repo/productQueries';
import { createSale, getSale } from '@/db/repo/sales';
import { createTestDb } from '@/test/testDb';

import {
  addDraftToCart,
  autoColour,
  availableFor,
  draftLine,
  draftMax,
  initialSellState,
  orderPickerProducts,
  pickColour,
  pickProduct,
  productOptionFromDetail,
  recentProductIds,
  removeLine,
  sellSummary,
  setQty,
  setRate,
  toCreateSaleInput,
  type ProductOption,
} from '../logic/sellCart';

const stole: ProductOption = {
  id: 'p1',
  name: 'Sozni stole',
  ratePaise: 650_000,
  thumb: 't1.jpg',
  colours: [
    { id: 'red', name: 'Red', hex: '#C0262D', pieces: 3 },
    { id: 'beige', name: 'Beige', hex: '#D8C3A5', pieces: 0 },
  ],
};
const twoColours: ProductOption = { ...stole, id: 'p2', colours: [stole.colours[0], { ...stole.colours[1], pieces: 2 }] };

describe('sell cart', () => {
  it('pre-picks the only colour with pieces, 1 piece and the usual rate (2-tap path)', () => {
    const s = pickProduct(initialSellState(), stole);
    expect(s.draft).toEqual({ productId: 'p1', colourId: 'red', qty: 1, ratePaise: 650_000 });
    const sum = sellSummary(s, stole);
    expect(sum.blocker).toBeNull();
    expect(sum.totalPaise).toBe(650_000);
    expect(sum.pieces).toBe(1);
  });

  it('asks for a colour when several have pieces, unless the link named one', () => {
    expect(pickProduct(initialSellState(), twoColours).draft.colourId).toBeNull();
    expect(sellSummary(pickProduct(initialSellState(), twoColours), twoColours).blocker).toBe('needs_colour');
    expect(pickProduct(initialSellState(), twoColours, 'beige').draft.colourId).toBe('beige');
    // A preferred colour that is sold out is ignored.
    expect(autoColour(stole, [], 'beige')).toBe('red');
  });

  it('never lets the quantity pass the pieces left, and refuses sold-out colours', () => {
    let s = pickProduct(initialSellState(), stole);
    s = setQty(s, 10);
    expect(draftLine(s, stole)?.qty).toBe(3);
    expect(pickColour(s, stole, 'beige')).toBe(s);
    s = pickColour(setQty(pickProduct(initialSellState(), twoColours), 3), twoColours, 'beige');
    expect(s.draft.qty).toBe(2);
  });

  it('blocks selling without a rate or with a discount above the bill; rate is editable (bargaining)', () => {
    let s = setRate(pickProduct(initialSellState(), stole), null);
    expect(sellSummary(s, stole).blocker).toBe('needs_rate');
    s = setRate(s, 600_000);
    expect(sellSummary(s, stole).totalPaise).toBe(600_000);
    s = { ...s, discountPaise: 700_000 };
    expect(sellSummary(s, stole).blocker).toBe('discount_too_high');
    s = { ...s, discountPaise: 50_000 };
    expect(sellSummary(s, stole).totalPaise).toBe(550_000);
  });

  it('adds more than one item; pieces already in the cart are not offered again', () => {
    let s = setQty(pickProduct(initialSellState(), stole), 2);
    s = addDraftToCart(s, stole);
    expect(s.lines).toHaveLength(1);
    expect(s.draft.productId).toBeNull();
    expect(sellSummary(s, null).blocker).toBeNull();
    s = pickProduct(s, stole);
    expect(availableFor(stole.colours[0], s.lines)).toBe(1);
    expect(draftMax(s, stole)).toBe(1);
    const sum = sellSummary(s, stole);
    expect(sum.lines).toHaveLength(2);
    expect(sum.pieces).toBe(3);
    expect(sum.totalPaise).toBe(1_950_000);
    s = removeLine(s, s.lines[0].key);
    expect(s.lines).toHaveLength(0);
  });

  it('needs a name for a new customer', () => {
    const s = { ...pickProduct(initialSellState(), stole), customer: { kind: 'new' as const, name: ' ', phone: null } };
    expect(sellSummary(s, stole).blocker).toBe('customer_name');
  });

  it('orders the picker: in stock first, then recently sold, then list order', () => {
    const rows = [
      { id: 'a', totalPieces: 0 },
      { id: 'b', totalPieces: 4 },
      { id: 'c', totalPieces: 1 },
      { id: 'd', totalPieces: 2 },
    ];
    expect(orderPickerProducts(rows, ['d', 'a'], 3)).toEqual({ shown: [rows[3], rows[1], rows[2]], total: 4 });
    expect(
      recentProductIds([
        { cancelledAt: null, items: [{ productId: 'x' }, { productId: 'y' }] },
        { cancelledAt: 5, items: [{ productId: 'z' }] },
        { cancelledAt: null, items: [{ productId: 'x' }] },
      ]),
    ).toEqual(['x', 'y']);
  });
});

describe('sell cart → createSale', () => {
  it('records a walk-in sale with an edited rate, discount and note; stock drops', () => {
    const db = createTestDb();
    const { productId } = addTestProduct(db);
    const product = productOptionFromDetail(getProductDetail(db, productId));
    if (!product) throw new Error('missing');
    let s = pickProduct(initialSellState(), product, product.colours[1].id);
    s = setRate(setQty(s, 2), 600_000);
    s = { ...s, payment: 'upi', discountPaise: 100_000, note: '  gift  ' };
    const sum = sellSummary(s, product);
    const result = createSale(db, toCreateSaleInput(s, sum.lines), T0);
    expect(result.totalPaise).toBe(1_100_000);
    const sale = getSale(db, result.saleId);
    expect(sale?.sale.payment).toBe('upi');
    expect(sale?.sale.note).toBe('gift');
    expect(sale?.sale.customerId).toBeNull();
    expect(getProductDetail(db, productId)?.colours[1].pieces).toBe(0);
    expectNoDrift(db);
  });

  it('reuses the saved customer when a new customer is typed with a saved phone number', () => {
    const db = createTestDb();
    const { productId } = addTestProduct(db);
    const existing = createCustomer(db, { name: 'Anita Kaul', phone: '+919906000104' }, T0);
    const product = productOptionFromDetail(getProductDetail(db, productId));
    if (!product) throw new Error('missing');
    const s = { ...pickProduct(initialSellState(), product, product.colours[0].id), customer: { kind: 'new' as const, name: 'Anita', phone: '+919906000104' } };
    const input = toCreateSaleInput(s, sellSummary(s, product).lines);
    expect(input.newCustomer).toEqual({ name: 'Anita', phone: '+919906000104' });
    expect(createSale(db, input, T0).customerId).toBe(existing);
  });

  it('treats a deleted product as gone', () => {
    expect(productOptionFromDetail(null)).toBeNull();
    expect(
      productOptionFromDetail({ product: { id: 'x', name: 'X', ratePaise: 1, deletedAt: 5 }, colours: [], photos: [] }),
    ).toBeNull();
  });
});
