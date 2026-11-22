import 'react-native-gesture-handler/jestSetup';

import { fireEvent, screen } from '@testing-library/react-native';

import type { SaleDetail } from '@/db/repo/saleQueries';
import { renderWithTheme } from '@/ui/components/__tests__/renderWithTheme';

import { SaleDetailView } from '../components/SaleDetailScreen';
import type { SaleDetailActions } from '../hooks/useSaleDetail';

jest.mock('react-native-keyboard-controller', () => require('react-native-keyboard-controller/jest'));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@expo/ui', () => require('./salesMocks').expoUi);
jest.mock('@/ui/patterns', () => require('./salesMocks').patterns);
jest.mock('@/lib/photos', () => ({ thumbUri: (n: string) => `file:///thumbs/${n}` }));
jest.mock('../hooks/useSaleDetail', () => ({ useSaleDetail: jest.fn() }));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a), back: jest.fn(), canGoBack: () => true, replace: jest.fn() } }));

const AT = new Date(2026, 10, 22, 16, 5).getTime();

function detail(over: Partial<SaleDetail['sale']> = {}, customerDeleted = false): SaleDetail {
  return {
    sale: {
      id: 's1',
      billNo: 'B-2026-0012',
      customerId: 'c1',
      customerNameSnapshot: 'Anita Kaul',
      customerPhoneSnapshot: '+919906000104',
      payment: 'upi',
      discountPaise: 50_000,
      totalPaise: 1_250_000,
      note: 'Gift wrap',
      createdAt: AT,
      cancelledAt: null,
      reportId: null,
      ...over,
    } as SaleDetail['sale'],
    items: [
      { id: 'i1', saleId: 's1', productId: 'p1', colourId: 'c1', productNameSnapshot: 'Sozni stole', productCodeSnapshot: 'GTH-1', colourNameSnapshot: 'Red', colourHexSnapshot: '#C0262D', photoSnapshotName: null, qty: 2, ratePaise: 650_000 },
    ],
    customer: { id: 'c1', name: 'Anita Kaul', phone: '+919906000104', deletedAt: customerDeleted ? AT : null } as SaleDetail['customer'],
  };
}

function actions(over: Partial<SaleDetailActions> = {}): SaleDetailActions {
  return { sendBill: jest.fn(), sending: false, askReturn: jest.fn(), confirmReturn: jest.fn(), cancelReturn: jest.fn(), returnOpen: false, ...over };
}

describe('SaleDetailView', () => {
  beforeEach(() => mockPush.mockClear());

  it('shows items with qty × rate, discount, total, payment, customer, bill no and note', async () => {
    const a = actions();
    await renderWithTheme(<SaleDetailView detail={detail()} actions={a} />);
    expect(screen.getAllByText('₹12,500').length).toBeGreaterThan(0);
    expect(screen.getByText(/^Bill B-2026-0012 · 22 Nov 2026/)).toBeTruthy();
    expect(screen.getByText('2 × ₹6,500')).toBeTruthy();
    expect(screen.getByLabelText('Discount: − ₹500')).toBeTruthy();
    expect(screen.getByLabelText('Total: ₹12,500')).toBeTruthy();
    expect(screen.getByText('UPI')).toBeTruthy();
    expect(screen.getByText('Gift wrap')).toBeTruthy();
    expect(screen.getByTestId('placeholder-p1')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Open Anita Kaul'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/customer/[id]', params: { id: 'c1' } });
    await fireEvent.press(screen.getByTestId('sale-send-bill'));
    expect(a.sendBill).toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('sale-return'));
    expect(a.askReturn).toHaveBeenCalled();
  });

  it('confirms a return in a sheet that names what happens', async () => {
    const a = actions({ returnOpen: true });
    await renderWithTheme(<SaleDetailView detail={detail()} actions={a} />);
    expect(screen.getByText('2 pieces go back to stock and ₹12,500 is taken off your sales.')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('return-confirm'));
    expect(a.confirmReturn).toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('return-keep'));
    expect(a.cancelReturn).toHaveBeenCalled();
  });

  it('a returned sale shows the banner and no Return button; a deleted customer is not a link', async () => {
    await renderWithTheme(<SaleDetailView detail={detail({ cancelledAt: AT + 1000 }, true)} actions={actions()} />);
    expect(screen.getByTestId('sale-returned')).toBeTruthy();
    expect(screen.queryByTestId('sale-return')).toBeNull();
    expect(screen.getByText('Anita Kaul (deleted)')).toBeTruthy();
  });

  it('walk-in sale and a missing sale', async () => {
    const { rerender } = await renderWithTheme(<SaleDetailView detail={{ ...detail({ customerId: null, customerNameSnapshot: null, customerPhoneSnapshot: null }), customer: null }} actions={actions()} />);
    expect(screen.getByText('Walk-in customer')).toBeTruthy();
    const { AppThemeProvider } = require('@/ui/theme');
    await rerender(
      <AppThemeProvider>
        <SaleDetailView detail={null} actions={actions()} />
      </AppThemeProvider>,
    );
    expect(screen.getByText('This sale could not be found.')).toBeTruthy();
  });
});
