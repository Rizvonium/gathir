import { fireEvent, screen } from '@testing-library/react-native';

import type { ProductDetail, StockHistoryRow } from '@/db/repo/productQueries';

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

const mockState: { detail: ProductDetail | null; history: StockHistoryRow[] } = { detail: null, history: [] };
jest.mock('@/db/hooks', () => ({
  useProductDetail: () => mockState.detail,
  useStockHistory: () => mockState.history,
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
});

const render = () => renderScreen(<ProductDetailScreen productId="p1" />);

describe('ProductDetailScreen', () => {
  it('shows facts and keeps the cost hidden until asked', async () => {
    await render();
    expect(screen.getByText('Sozni Pashmina Stole')).toBeOnTheScreen();
    expect(screen.getByText('Sozni · Pashmina · Stole (70×200)')).toBeOnTheScreen();
    expect(screen.getByText('Hidden')).toBeOnTheScreen();
    expect(screen.queryByText('₹4,000')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Show cost price'));
    expect(screen.getByText('₹4,000')).toBeOnTheScreen();
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
