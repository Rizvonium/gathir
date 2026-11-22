import 'react-native-gesture-handler/jestSetup';

import { fireEvent, screen } from '@testing-library/react-native';

import type { SaleListRow } from '@/db/repo/saleQueries';
import type { SaleItem } from '@/db/schema';
import { useProfitPrivacy } from '@/features/profit/privacy';
import { renderWithTheme } from '@/ui/components/__tests__/renderWithTheme';

import { SalesView } from '../components/SalesScreen';
import type { SalesListModel } from '../hooks/useSalesList';
import { groupSalesByDay, profitOfRows, totalsOf } from '../logic/salesList';

jest.mock('react-native-keyboard-controller', () => require('react-native-keyboard-controller/jest'));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@/ui/patterns', () => require('./salesMocks').patterns);
jest.mock('@/lib/photos', () => ({ thumbUri: (n: string) => `file:///thumbs/${n}` }));
jest.mock('../hooks/useSalesList', () => ({ useSalesList: jest.fn() }));
// FlashList needs real layout; a plain list renders every row in tests.
jest.mock('@shopify/flash-list', () => {
  const { View } = require('react-native');
  return {
    FlashList: ({ data, renderItem, ListHeaderComponent, keyExtractor }: { data: unknown[]; renderItem: (a: { item: unknown; index: number }) => unknown; ListHeaderComponent?: unknown; keyExtractor: (i: unknown) => string }) => (
      <View>
        {ListHeaderComponent as never}
        {data.map((item, index) => (
          <View key={keyExtractor(item)}>{renderItem({ item, index }) as never}</View>
        ))}
      </View>
    ),
  };
});
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));

const TODAY = new Date(2026, 10, 22).getTime();
const DAY = 86_400_000;

const item = (over: Partial<SaleItem> = {}): SaleItem => ({
  id: 'i1',
  saleId: 's1',
  productId: 'p1',
  colourId: 'c1',
  productNameSnapshot: 'Sozni Pashmina stole',
  productCodeSnapshot: 'GTH-0001',
  colourNameSnapshot: 'Red',
  colourHexSnapshot: '#C0262D',
  photoSnapshotName: 'p1_t.jpg',
  qty: 1,
  ratePaise: 650_000,
  costPaiseSnapshot: null,
  ...over,
});

const sale = (over: Partial<SaleListRow> = {}): SaleListRow => ({
  id: 's1',
  billNo: 'B-2026-0001',
  createdAt: TODAY + 15 * 3_600_000,
  day: TODAY,
  cancelledAt: null,
  payment: 'upi',
  discountPaise: 0,
  totalPaise: 650_000,
  customerId: 'c1',
  customerName: 'Anita Kaul',
  customerPhone: null,
  pieces: 1,
  itemCount: 1,
  items: [item()],
  profitPaise: null,
  knownProfitPaise: 0,
  unknownCostItems: 1,
  ...over,
});

function model(rows: SaleListRow[], over: Partial<SalesListModel> = {}): SalesListModel {
  return { period: 'week', payment: null, today: TODAY, ...groupSalesByDay(rows), totals: totalsOf(rows), empty: rows.length ? 'none' : 'never', ...over };
}
const actions = () => ({ setPeriod: jest.fn(), setPayment: jest.fn() });

describe('SalesView', () => {
  beforeEach(() => mockPush.mockClear());

  it('shows the period total, day totals and rows; returned sales are struck and labelled', async () => {
    const rows = [
      sale(),
      sale({ id: 's2', cancelledAt: TODAY + 16 * 3_600_000, payment: 'cash', customerName: null, totalPaise: 1_300_000, items: [item({ id: 'i2', qty: 2, photoSnapshotName: null, productId: 'p2', productNameSnapshot: 'Kani shawl' })], pieces: 2 }),
      sale({ id: 's3', day: TODAY - DAY, createdAt: TODAY - DAY + 3_600_000, totalPaise: 900_000, items: [item({ id: 'i3' }), item({ id: 'i4', productId: 'p9' })], pieces: 2 }),
    ];
    await renderWithTheme(<SalesView model={model(rows)} actions={actions()} />);
    expect(screen.getByLabelText('This week: ₹15,500 from 2 sales, 3 pieces')).toBeTruthy();
    expect(screen.getByLabelText('Today: ₹6,500, 1 piece')).toBeTruthy();
    expect(screen.getByLabelText('Yesterday: ₹9,000, 2 pieces')).toBeTruthy();
    expect(screen.getByText('Returned')).toBeTruthy();
    expect(screen.getByTestId('sale-amount-s2')).toHaveStyle({ textDecorationLine: 'line-through' });
    // No photo → pattern placeholder; several items → "+1 more".
    expect(screen.getByTestId('placeholder-p2')).toBeTruthy();
    expect(screen.getByLabelText(/Sozni Pashmina stole \(Red\) × 1 \+1 more\. Anita Kaul\./)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('sale-row-s1'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/sale/[id]', params: { id: 's1' } });
  });

  it('filters by period and payment', async () => {
    const a = actions();
    await renderWithTheme(<SalesView model={model([sale()])} actions={a} />);
    await fireEvent.press(screen.getByLabelText('This month'));
    expect(a.setPeriod).toHaveBeenCalledWith('month');
    await fireEvent.press(screen.getByLabelText('Cash'));
    expect(a.setPayment).toHaveBeenCalledWith('cash');
  });

  it('designs each empty state', async () => {
    const a = actions();
    const { rerender } = await renderWithTheme(<SalesView model={model([])} actions={a} />);
    expect(screen.getByText('No sales yet')).toBeTruthy();
    expect(screen.getByTestId('loom')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('sales-sell'));
    expect(mockPush).toHaveBeenCalledWith('/sell');

    const { AppThemeProvider } = require('@/ui/theme');
    await rerender(
      <AppThemeProvider>
        <SalesView model={model([], { empty: 'payment', payment: 'card' })} actions={a} />
      </AppThemeProvider>,
    );
    expect(screen.getByText('No Card sales this week')).toBeTruthy();
    await fireEvent.press(screen.getByText('Show all payments'));
    expect(a.setPayment).toHaveBeenCalledWith(null);

    await rerender(
      <AppThemeProvider>
        <SalesView model={model([], { empty: 'today', period: 'today' })} actions={a} />
      </AppThemeProvider>,
    );
    expect(screen.getByText('Nothing sold today yet')).toBeTruthy();
    await fireEvent.press(screen.getByText('Show all sales'));
    expect(a.setPeriod).toHaveBeenCalledWith('all');
  });

  it('shows the period profit and margin beside the takings, links to Profit, and hides on the eye', async () => {
    useProfitPrivacy.getState().setHidden(false);
    const rows = [
      sale({ items: [item({ costPaiseSnapshot: 400_000 })] }),
      sale({ id: 's2', totalPaise: 500_000, items: [item({ id: 'i2', ratePaise: 500_000, costPaiseSnapshot: null })] }),
    ];
    await renderWithTheme(<SalesView model={model(rows, { profit: profitOfRows(rows) })} actions={actions()} />);
    expect(screen.getByLabelText('Profit: ₹2,500, 38.5% margin. 1 item without buying price')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('sales-profit'));
    expect(mockPush).toHaveBeenCalledWith('/profit');
    await fireEvent.press(screen.getByTestId('sales-open-profit'));
    expect(mockPush).toHaveBeenCalledTimes(2);
    await fireEvent.press(screen.getByLabelText('Hide profit figures'));
    expect(screen.getByLabelText('Profit: Hidden')).toBeTruthy();
    useProfitPrivacy.getState().setHidden(false);
  });

  it('sales with no buying price at all read "Profit unknown", not 100 %', async () => {
    const rows = [sale()];
    await renderWithTheme(<SalesView model={model(rows, { profit: profitOfRows(rows) })} actions={actions()} />);
    expect(screen.getByTestId('sales-profit-unknown')).toHaveTextContent('Profit unknown');
  });
});
