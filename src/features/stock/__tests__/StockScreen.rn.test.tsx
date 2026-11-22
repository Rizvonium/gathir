import { fireEvent, screen } from '@testing-library/react-native';

import type { ProductListRow } from '@/db/repo/productQueries';

import { StockScreen } from '../components/StockScreen';
import { renderScreen, router } from './stockMocks';

jest.mock('react-native-reanimated', () => require('@/ui/components/__tests__/reanimatedMock'));
jest.mock('react-native-keyboard-controller', () => require('react-native-keyboard-controller/jest'));
jest.mock('@shopify/flash-list', () => require('./stockMocks').flashList);
jest.mock('@expo/ui', () => require('./stockMocks').expoUi);
jest.mock('react-native-gesture-handler', () => require('./stockMocks').gestureHandler);
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => require('./stockMocks').swipeable);
jest.mock('@/ui/patterns', () => require('./stockMocks').patterns);
jest.mock('@/lib/photos', () => require('./stockMocks').photos);
jest.mock('expo-router', () => ({ router: require('./stockMocks').router, useIsFocused: () => true }));
jest.mock('@/db/client', () => ({ db: { transaction: (fn: (tx: unknown) => unknown) => fn({}) } }));
jest.mock('@/db/repo/products', () => ({
  softDeleteProduct: jest.fn(),
  restoreProduct: jest.fn(),
  updateProduct: jest.fn(),
}));
jest.mock('@/db/stock', () => ({
  StockError: class StockError extends Error {},
  recordRestock: jest.fn(),
  recordReduction: jest.fn(),
  adjustStock: jest.fn(),
}));

const mockRows: { current: ProductListRow[] } = { current: [] };
jest.mock('@/db/hooks', () => ({
  useProducts: () => mockRows.current,
  useLowStockLevel: () => 1,
  useCategories: () => [{ id: 'cat-1', name: 'Stoles', icon: 'gesture', sortOrder: 0, isDefault: true, createdAt: 0, updatedAt: 0 }],
}));

const products = jest.requireMock('@/db/repo/products') as { softDeleteProduct: jest.Mock; restoreProduct: jest.Mock };

function row(id: string, name: string, colours: { id: string; pieces: number }[]): ProductListRow {
  return {
    id,
    code: `GTH-${id}`,
    name,
    categoryId: null,
    categoryName: null,
    craft: 'Sozni',
    material: 'Pashmina',
    size: '',
    ratePaise: 650_000,
    oneOfAKind: false,
    isSample: false,
    createdAt: 0,
    totalPieces: colours.reduce((s, c) => s + c.pieces, 0),
    status: 'in',
    colours: colours.map((c) => ({ ...c, name: `Colour ${c.id}`, hex: '#C0262D' })),
    coverThumb: null,
    coverFile: null,
  };
}

const render = () => renderScreen(<StockScreen />);

beforeEach(() => {
  jest.clearAllMocks();
  mockRows.current = [];
});

describe('StockScreen', () => {
  it('invites the first product when the shop is empty', async () => {
    await render();
    expect(screen.getByText('Add your first shawl')).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText('Add product'));
    expect(router.push).toHaveBeenCalledWith('/product/new');
  });

  it('shows cards with rate and piece badge, and opens the product', async () => {
    mockRows.current = [row('a', 'Sozni Stole', [{ id: 'c1', pieces: 4 }]), row('b', 'Kani Shawl', [{ id: 'c2', pieces: 0 }])];
    await render();
    expect(screen.getByText('2 designs · 4 pieces')).toBeOnTheScreen();
    expect(screen.getByLabelText('Sold out, no pieces left')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('product-card-a'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/product/[id]', params: { id: 'a' } });
  });

  it('multi-selects by long-press and sends the selection as a catalogue', async () => {
    mockRows.current = [row('a', 'Sozni Stole', [{ id: 'c1', pieces: 4 }]), row('b', 'Kani Shawl', [{ id: 'c2', pieces: 1 }])];
    await render();
    await fireEvent(screen.getByTestId('product-card-a'), 'longPress');
    expect(screen.getByText('1 selected')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('product-card-b'));
    expect(screen.getByText('2 selected')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Send as catalogue'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/catalogue', params: { productIds: 'a,b' } });
  });

  it('deletes the selection with an Undo toast', async () => {
    mockRows.current = [row('a', 'Sozni Stole', [{ id: 'c1', pieces: 4 }])];
    await render();
    await fireEvent(screen.getByTestId('product-card-a'), 'longPress');
    await fireEvent.press(screen.getByLabelText('Delete'));
    expect(products.softDeleteProduct).toHaveBeenCalledWith({}, 'a', expect.any(Number));
    expect(screen.getByText('Deleted Sozni Stole')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Undo'));
    expect(products.restoreProduct).toHaveBeenCalledWith({}, 'a');
  });

  it('compact rows offer Sell 1 from the row menu, pre-picking the only colour in stock', async () => {
    mockRows.current = [row('a', 'Sozni Stole', [{ id: 'c1', pieces: 2 }, { id: 'c2', pieces: 0 }])];
    await render();
    await fireEvent.press(screen.getByTestId('stock-view'));
    await fireEvent.press(screen.getByLabelText('More for Sozni Stole'));
    await fireEvent.press(screen.getByTestId('row-menu-sell'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/sell', params: { productId: 'a', colourId: 'c1' } });
  });

  it('shows a filtered-empty state that clears filters', async () => {
    mockRows.current = [];
    // anyProducts comes from the same hook in this test, so give the unfiltered call a row.
    const hooks = jest.requireMock('@/db/hooks') as { useProducts: (f: object) => ProductListRow[] };
    const spy = jest.spyOn(hooks, 'useProducts').mockImplementation((f: { filter?: string }) => (f && 'filter' in f ? [] : [row('a', 'X', [])]));
    await render();
    await fireEvent.changeText(screen.getByLabelText('Search stock'), 'zzz');
    expect(screen.getByText('Nothing matches')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Clear search and filters'));
    expect(screen.getByLabelText('Search stock').props.value).toBe('');
    spy.mockRestore();
  });
});
