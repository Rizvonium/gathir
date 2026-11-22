import { fireEvent, screen } from '@testing-library/react-native';

import { AddPiecesScreen } from '../components/AddPiecesScreen';
import { AddToCustomerCatalogueSheet } from '../components/AddToCustomerCatalogueSheet';
import { customerRow, profile, renderScreen, router } from './customersMocks';

jest.mock('react-native-reanimated', () => require('@/ui/components/__tests__/reanimatedMock'));
jest.mock('react-native-keyboard-controller', () => require('react-native-keyboard-controller/jest'));
jest.mock('react-native-gesture-handler', () => require('./customersMocks').gestureHandler);
jest.mock('@expo/ui', () => require('./customersMocks').expoUi);
jest.mock('@shopify/flash-list', () => require('./customersMocks').flashList);
jest.mock('@/ui/patterns', () => require('./customersMocks').patterns);
jest.mock('@/lib/photos', () => require('./customersMocks').photos);
jest.mock('expo-router', () => ({ router: require('./customersMocks').router, useIsFocused: () => true }));
jest.mock('@/db/client', () => ({
  db: Object.defineProperty({}, 'transaction', { value: (fn: (tx: unknown) => unknown) => fn({}), enumerable: false }),
}));
jest.mock('@/db/repo/customerCatalogue', () => ({
  addToCustomerCatalogue: jest.fn((_db: unknown, input: { productId: string }) => `item-${input.productId}`),
  removeFromCustomerCatalogue: jest.fn(() => true),
  restoreCustomerCatalogueItem: jest.fn(),
  updateCatalogueItem: jest.fn(),
  reorderCustomerCatalogue: jest.fn(),
}));

function product(id: string, o: Record<string, unknown> = {}) {
  return {
    id,
    code: `GTH-${id}`,
    name: `Shawl ${id}`,
    categoryId: 'cat1',
    categoryName: 'Shawls',
    craft: 'Kani',
    material: '',
    size: '',
    ratePaise: 650_000,
    oneOfAKind: false,
    isSample: false,
    createdAt: 0,
    totalPieces: 3,
    status: 'in',
    colours: [],
    coverThumb: null,
    coverFile: null,
    ...o,
  };
}

const mockCustomers = () => [customerRow(), customerRow({ id: 'c2', name: 'Rafiq Dar', phone: null })];
const mockData = {
  profile: profile() as ReturnType<typeof profile> | null,
  products: [product('p1'), product('p2', { categoryId: 'cat2', name: 'Blue stole', craft: 'Sozni' }), product('p3', { totalPieces: 0 })],
  catalogue: [{ id: 'i1', productId: 'p1' }],
  having: '',
};
jest.mock('@/db/hooks', () => ({
  useCustomerProfile: () => mockData.profile,
  useCustomerCatalogue: () => mockData.catalogue,
  useProducts: () => mockData.products,
  useCategories: () => [
    { id: 'cat1', name: 'Shawls' },
    { id: 'cat2', name: 'Stoles' },
  ],
  useCustomers: ({ search }: { search?: string }) =>
    mockCustomers().filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase())),
  useDbQuery: () => mockData.having,
}));

const cat = jest.requireMock('@/db/repo/customerCatalogue') as Record<string, jest.Mock>;

beforeEach(() => {
  jest.clearAllMocks();
  mockData.profile = profile();
  mockData.having = '';
});

describe('Add pieces', () => {
  it('marks pieces already added, picks several, and adds only the new ones with Undo', async () => {
    await renderScreen(<AddPiecesScreen customerId="c1" />);
    expect(screen.getByTestId('add-pieces-p1')).toBeDisabled();
    expect(screen.getByTestId('add-pieces-confirm')).toBeDisabled();
    await fireEvent.press(screen.getByTestId('add-pieces-p2'));
    await fireEvent.press(screen.getByTestId('add-pieces-p3'));
    expect(screen.getByText('Add 2 pieces')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('add-pieces-confirm'));
    expect(cat.addToCustomerCatalogue.mock.calls.map((c) => c[1])).toEqual([
      { customerId: 'c1', productId: 'p2' },
      { customerId: 'c1', productId: 'p3' },
    ]);
    expect(router.back).toHaveBeenCalled();
    expect(screen.getByText('2 pieces added to Anita Kaul’s catalogue')).toBeTruthy();
    await fireEvent.press(screen.getByText('Undo'));
    expect(cat.removeFromCustomerCatalogue).toHaveBeenCalledWith({}, 'item-p2');
    expect(cat.removeFromCustomerCatalogue).toHaveBeenCalledWith({}, 'item-p3');
  });

  it('narrows by search and category', async () => {
    await renderScreen(<AddPiecesScreen customerId="c1" />);
    await fireEvent.changeText(screen.getByTestId('add-pieces-search'), 'sozni');
    expect(screen.queryByTestId('add-pieces-p1')).toBeNull();
    expect(screen.getByTestId('add-pieces-p2')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Shawls'));
    expect(screen.getByText('No shawls match. Try another word or category.')).toBeTruthy();
  });

  it('shows not-found for a missing customer', async () => {
    mockData.profile = null;
    await renderScreen(<AddPiecesScreen customerId="gone" />);
    expect(screen.getByText('Customer not found')).toBeTruthy();
  });
});

describe('Add to a customer’s catalogue (product detail)', () => {
  it('adds the design to the picked customer, with Undo and Open', async () => {
    const onClose = jest.fn();
    await renderScreen(<AddToCustomerCatalogueSheet productId="p9" visible onClose={onClose} />);
    await fireEvent.press(screen.getByTestId('add-to-catalogue-c2'));
    expect(cat.addToCustomerCatalogue).toHaveBeenCalledWith({}, { customerId: 'c2', productId: 'p9' });
    expect(onClose).toHaveBeenCalled();
    expect(screen.getByText('Added to Rafiq Dar’s catalogue')).toBeTruthy();
    await fireEvent.press(screen.getByText('Undo'));
    expect(cat.removeFromCustomerCatalogue).toHaveBeenCalledWith({}, 'item-p9');
  });

  it('opens the customer instead when they already have it', async () => {
    mockData.having = 'c1';
    await renderScreen(<AddToCustomerCatalogueSheet productId="p9" visible onClose={jest.fn()} />);
    expect(screen.getByText(/In their catalogue/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('add-to-catalogue-c1'));
    expect(cat.addToCustomerCatalogue).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith({ pathname: '/customer/[id]', params: { id: 'c1' } });
  });
});
