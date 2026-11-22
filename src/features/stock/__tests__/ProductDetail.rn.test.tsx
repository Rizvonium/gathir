import { fireEvent, screen } from '@testing-library/react-native';

import type { ProductDetail, StockHistoryRow } from '@/db/repo/productQueries';
import type { ProductProfit } from '@/db/repo/profit';

import { ProductDetailScreen } from '../components/ProductDetailScreen';
import { renderScreen, router } from './stockMocks';

jest.mock('react-native-reanimated', () => require('@/ui/components/__tests__/reanimatedMock'));
jest.mock('react-native-keyboard-controller', () => require('react-native-keyboard-controller/jest'));
jest.mock('@expo/ui', () => require('./stockMocks').expoUi);
jest.mock('react-native-gesture-handler', () => require('./stockMocks').gestureHandler);
jest.mock('@/ui/patterns', () => require('./stockMocks').patterns);
jest.mock('@/lib/photos', () => require('./stockMocks').photos);
jest.mock('expo-router', () => ({ router: require('./stockMocks').router }));
jest.mock('@/db/client', () => ({ db: { transaction: (fn: (tx: unknown) => unknown) => fn('tx') } }));
jest.mock('@/db/repo/products', () => ({ softDeleteProduct: jest.fn(), restoreProduct: jest.fn(), updateProduct: jest.fn() }));
jest.mock('@/db/stock', () => {
  class StockError extends Error {
    code: string;
    constructor(message: string, errorCode: string) {
      super(message);
      this.code = errorCode;
    }
  }
  return { StockError, recordRestock: jest.fn(), recordReduction: jest.fn(), adjustStock: jest.fn() };
});

jest.mock('@/features/customers/components/AddToCustomerCatalogueSheet', () => {
  const { Text } = require('react-native');
  return {
    AddToCustomerCatalogueSheet: ({ productId, visible }: { productId: string; visible: boolean }) =>
      visible ? <Text testID="customer-catalogue-sheet">{productId}</Text> : null,
  };
});

const mockState: { detail: ProductDetail | null; history: StockHistoryRow[]; profit: ProductProfit | null } = { detail: null, history: [], profit: null };
jest.mock('@/db/hooks', () => ({
  useProductDetail: () => mockState.detail,
  useStockHistory: () => mockState.history,
  useProductProfit: (id: string | undefined) => (id ? mockState.profit : null),
  useLowStockLevel: () => 1,
  useToday: () => new Date(2026, 10, 22).getTime(),
}));

const stock = jest.requireMock('@/db/stock') as { recordRestock: jest.Mock; recordReduction: jest.Mock; StockError: new (m: string, c: string) => Error };
const products = jest.requireMock('@/db/repo/products') as { softDeleteProduct: jest.Mock };

function detail(opts: { oneOfAKind?: boolean; pieces?: number[]; cost?: number | null; deleted?: boolean } = {}): ProductDetail {
  const pieces = opts.pieces ?? [3, 1];
  const now = 0;
  return {
    product: {
      id: 'p1',
      code: 'GTH-0001',
      name: 'Sozni Pashmina Stole',
      categoryId: null,
      craft: 'Sozni',
      material: 'Pashmina',
      size: 'Stole (70×200)',
      ratePaise: 650_000,
      costPaise: opts.cost === undefined ? 400_000 : opts.cost,
      notes: '',
      oneOfAKind: opts.oneOfAKind ?? false,
      isSample: false,
      coverPhotoId: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: opts.deleted ? now : null,
    },
    category: null,
    colours: pieces.map((p, i) => ({
      id: `c${i + 1}`,
      productId: 'p1',
      name: i === 0 ? 'Red' : 'Beige',
      hex: '#C0262D',
      pieces: p,
      costPaise: null,
      sortOrder: i,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    })),
    photos: [],
    totalPieces: pieces.reduce((s, p) => s + p, 0),
    status: 'in',
  } as ProductDetail;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockState.detail = detail();
  mockState.history = [];
  mockState.profit = null;
});

const render = () => renderScreen(<ProductDetailScreen productId="p1" />);

describe('ProductDetailScreen', () => {
  it('shows facts and keeps the cost hidden until asked', async () => {
    await render();
    expect(screen.getByText('Sozni Pashmina Stole')).toBeOnTheScreen();
    expect(screen.getByText('Sozni · Pashmina · Stole (70×200)')).toBeOnTheScreen();
    expect(screen.getByText('Hidden')).toBeOnTheScreen();
    expect(screen.queryByText('₹4,000')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Show buying price and profit'));
    expect(screen.getByText('₹4,000')).toBeOnTheScreen();
  });

  it('behind the eye: buying price, profit at this rate and profit earned on the design', async () => {
    mockState.profit = {
      revenuePaise: 1_950_000,
      knownRevenuePaise: 1_300_000,
      knownCostPaise: 800_000,
      profitPaise: 500_000,
      marginPct: 38.5,
      unknownCostItems: 1,
      pieces: 3,
      salesCount: 3,
    };
    await render();
    expect(screen.queryByTestId('detail-earned')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Show buying price and profit'));
    expect(screen.getByTestId('detail-margin')).toHaveTextContent('Profit at this rate: ₹2,500 a piece · 38.5%');
    expect(screen.getByLabelText('₹5,000')).toBeOnTheScreen();
    expect(screen.getByText('38.5% margin')).toBeOnTheScreen();
    expect(screen.getByText('From 3 pieces sold · ₹19,500 in sales')).toBeOnTheScreen();
    expect(screen.getByText('1 item had no buying price, so its profit is not counted.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText('Hide buying price and profit'));
    expect(screen.queryByText('₹4,000')).toBeNull();
  });

  it('without a buying price it nudges to add one (never shows a made-up profit)', async () => {
    mockState.detail = detail({ cost: null });
    await render();
    await fireEvent.press(screen.getByLabelText('Show buying price and profit'));
    expect(screen.getByText('Not added yet')).toBeOnTheScreen();
    expect(screen.queryByTestId('detail-margin')).toBeNull();
    await fireEvent.press(screen.getByTestId('detail-add-cost'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/product/[id]/edit', params: { id: 'p1' } });
  });

  it('"Add to a customer\u2019s catalogue" opens the customer picker for this design', async () => {
    await render();
    expect(screen.queryByTestId('customer-catalogue-sheet')).toBeNull();
    await fireEvent.press(screen.getByTestId('detail-add-to-customer-catalogue'));
    expect(screen.getByTestId('customer-catalogue-sheet')).toHaveTextContent('p1');
  });

  it('"+" restocks one piece straight away', async () => {
    await render();
    await fireEvent.press(screen.getByLabelText('Add one, Red pieces'));
    expect(stock.recordRestock).toHaveBeenCalledWith(expect.anything(), 'c1', 1);
  });

  it('"−" asks for a reason, then records it with Undo', async () => {
    await render();
    await fireEvent.press(screen.getByLabelText('Remove one, Red pieces'));
    expect(screen.getByText('Why fewer pieces?')).toBeOnTheScreen();
    expect(stock.recordReduction).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('reason-damaged'));
    expect(stock.recordReduction).toHaveBeenCalledWith(expect.anything(), 'c1', 1, 'damaged');
    expect(screen.getByText('1 fewer · Damaged')).toBeOnTheScreen();
    expect(screen.getByText('Undo')).toBeOnTheScreen();
  });

  it('"Sold" opens the Sell sheet for that colour', async () => {
    await render();
    await fireEvent.press(screen.getByLabelText('Remove one, Beige pieces'));
    await fireEvent.press(screen.getByTestId('reason-sold'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/sell', params: { productId: 'p1', colourId: 'c2' } });
    expect(stock.recordReduction).not.toHaveBeenCalled();
  });

  it('explains a failed reduction in plain words', async () => {
    stock.recordReduction.mockImplementationOnce(() => {
      throw new stock.StockError('x', 'insufficient');
    });
    await render();
    await fireEvent.press(screen.getByLabelText('Remove one, Red pieces'));
    await fireEvent.press(screen.getByTestId('reason-sample'));
    expect(screen.getByText('Not enough pieces left for that. Check the count.')).toBeOnTheScreen();
  });

  it('one-of-a-kind shows a Sell button instead of steppers', async () => {
    mockState.detail = detail({ oneOfAKind: true, pieces: [1] });
    await render();
    expect(screen.queryByLabelText('Add one, Red pieces')).toBeNull();
    expect(screen.getAllByText('1 of a kind').length).toBeGreaterThan(0);
  });

  it('deletes with Undo and goes back', async () => {
    await render();
    await fireEvent.press(screen.getByTestId('detail-delete'));
    expect(products.softDeleteProduct).toHaveBeenCalledWith('tx', 'p1', expect.any(Number));
    expect(router.back).toHaveBeenCalled();
    expect(screen.getByText('Deleted Sozni Pashmina Stole')).toBeOnTheScreen();
  });

  it('sends a product card to a customer', async () => {
    await render();
    await fireEvent.press(screen.getByTestId('detail-send'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/catalogue/card', params: { productId: 'p1' } });
  });

  it('offers Restore for a deleted product', async () => {
    mockState.detail = detail({ deleted: true });
    await render();
    expect(screen.getByText('This product is in Recently deleted')).toBeOnTheScreen();
    expect(screen.getByText('Restore')).toBeOnTheScreen();
  });

  it('shows history lines with sign, reason and colour', async () => {
    mockState.history = [
      { id: 'm1', at: new Date(2026, 10, 22, 10, 0).getTime(), delta: -1, reason: 'sold', note: '', colourId: 'c1', colourName: 'Red', colourHex: '#C0262D', saleId: 's1', billNo: 'B-2026-0001' },
      { id: 'm2', at: new Date(2026, 10, 1, 10, 0).getTime(), delta: 3, reason: 'opening', note: '', colourId: 'c1', colourName: 'Red', colourHex: '#C0262D', saleId: null, billNo: null },
    ];
    await render();
    expect(screen.getByText('−1 Sold')).toBeOnTheScreen();
    expect(screen.getByText('+3 Opening stock')).toBeOnTheScreen();
    expect(screen.getByText('Red · Bill B-2026-0001')).toBeOnTheScreen();
  });
});
