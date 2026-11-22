import 'react-native-gesture-handler/jestSetup';

import { fireEvent, screen } from '@testing-library/react-native';

import type { ProfitGroupRow, ProfitSummary } from '@/db/repo/profit';
import { renderWithTheme } from '@/ui/components/__tests__/renderWithTheme';

import { ProfitView } from '../components/ProfitScreen';
import type { ProfitScreenActions, ProfitScreenModel } from '../hooks/useProfitScreen';
import { profitRange } from '../logic';
import { useProfitPrivacy } from '../privacy';

jest.mock('react-native-reanimated', () => require('@/ui/components/__tests__/reanimatedMock'));
jest.mock('react-native-keyboard-controller', () => require('react-native-keyboard-controller/jest'));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@/ui/patterns', () => {
  const { View } = require('react-native');
  return { PatternPlaceholder: ({ productId }: { productId: string }) => <View testID={`placeholder-${productId}`} />, LoomEmptyState: () => <View /> };
});
jest.mock('@/lib/photos', () => ({ thumbUri: (n: string) => `file:///thumbs/${n}` }));
jest.mock('../hooks/useProfitScreen', () => ({ useProfitScreen: jest.fn() }));
jest.mock('@shopify/flash-list', () => require('@/features/stock/__tests__/stockMocks').flashList);
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a), back: jest.fn(), canGoBack: () => true, replace: jest.fn() } }));

const TODAY = new Date(2026, 10, 22).getTime();

const totals = (over: Partial<ProfitSummary> = {}): ProfitSummary => ({
  revenuePaise: 1_800_000,
  knownRevenuePaise: 1_300_000,
  knownCostPaise: 800_000,
  profitPaise: 500_000,
  marginPct: 38.5,
  unknownCostItems: 1,
  pieces: 3,
  salesCount: 2,
  ...over,
});

const row = (key: string, label: string | null, over: Partial<ProfitGroupRow> = {}): ProfitGroupRow => ({ ...totals(), key, label, at: null, ...over });

function model(over: Partial<ProfitScreenModel> = {}): ProfitScreenModel {
  return {
    today: TODAY,
    period: 'today',
    range: profitRange('today', TODAY),
    customFrom: null,
    customTo: null,
    tab: 'product',
    missingOnly: false,
    summary: totals(),
    rows: [row('p1', 'Sozni stole'), row('p-gone', 'Old Kani', { unknownCostItems: 0, profitPaise: 100_000, marginPct: 20 })],
    thumbs: new Map([['p1', 'p1_t.jpg']]),
    liveProducts: new Set(['p1']),
    ...over,
  };
}

const actions = (): ProfitScreenActions => ({ setPeriod: jest.fn(), pickDay: jest.fn(), setTab: jest.fn(), showMissing: jest.fn(), clearMissing: jest.fn() });

beforeEach(() => {
  mockPush.mockClear();
  useProfitPrivacy.getState().setHidden(false);
});

describe('ProfitView', () => {
  it('shows totals with margin and the unknown-cost count, never counting missing costs as profit', async () => {
    const a = actions();
    await renderWithTheme(<ProfitView model={model()} actions={a} />);
    expect(screen.getByLabelText('22 Nov 2026 – 22 Nov 2026. Profit ₹5,000, 38.5% margin. Sales ₹18,000. Bought for ₹8,000.')).toBeTruthy();
    expect(screen.getByText('1 item had no buying price, so its profit is not counted.')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('profit-totals-unknown-fix'));
    expect(a.showMissing).toHaveBeenCalled();
  });

  it('switches period and breakdown tabs', async () => {
    const a = actions();
    await renderWithTheme(<ProfitView model={model()} actions={a} />);
    await fireEvent.press(screen.getByLabelText('This month'));
    expect(a.setPeriod).toHaveBeenCalledWith('month');
    await fireEvent.press(screen.getByLabelText('By customer'));
    expect(a.setTab).toHaveBeenCalledWith('customer');
  });

  it('design rows open the design; a design with unknown costs offers "Add buying price"; deleted ones do not open', async () => {
    await renderWithTheme(<ProfitView model={model()} actions={actions()} />);
    expect(screen.getByLabelText(/^Sozni stole\. ₹18,000 · 3 pieces\. ₹5,000, 38\.5% margin\. 1 item without buying price$/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('profit-fix-p1'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/product/[id]/edit', params: { id: 'p1' } });
    await fireEvent.press(screen.getByTestId('profit-row-p1'));
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/product/[id]', params: { id: 'p1' } });
    expect(screen.getByTestId('placeholder-p-gone')).toBeTruthy();
    expect(screen.queryByTestId('profit-fix-p-gone')).toBeNull();
  });

  it('customers: walk-in has a plain label, a named customer opens their profile', async () => {
    await renderWithTheme(<ProfitView model={model({ tab: 'customer', rows: [row('', null), row('c1', 'Anita Kaul')] })} actions={actions()} />);
    expect(screen.getByText('Walk-in customers')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('profit-row-c1'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/customer/[id]', params: { id: 'c1' } });
  });

  it('all costs unknown → "Profit unknown"; nothing sold → empty state', async () => {
    const unknown = totals({ knownRevenuePaise: 0, knownCostPaise: 0, profitPaise: 0, marginPct: null, unknownCostItems: 2 });
    const { rerender } = await renderWithTheme(<ProfitView model={model({ summary: unknown })} actions={actions()} />);
    expect(screen.getByTestId('profit-total-unknown')).toHaveTextContent('Profit unknown');
    const { AppThemeProvider } = require('@/ui/theme');
    const none = totals({ revenuePaise: 0, knownRevenuePaise: 0, knownCostPaise: 0, profitPaise: 0, marginPct: null, unknownCostItems: 0, pieces: 0, salesCount: 0 });
    await rerender(
      <AppThemeProvider>
        <ProfitView model={model({ summary: none, rows: [] })} actions={actions()} />
      </AppThemeProvider>,
    );
    expect(screen.getAllByText('No sales in this period').length).toBeGreaterThan(0);
    expect(screen.queryByLabelText('By day')).toBeNull();
  });

  it('the eye hides every figure', async () => {
    await renderWithTheme(<ProfitView model={model()} actions={actions()} />);
    await fireEvent.press(screen.getByLabelText('Hide profit figures'));
    expect(screen.getByLabelText('22 Nov 2026 – 22 Nov 2026. Hidden')).toBeTruthy();
    expect(screen.queryByText('1 item had no buying price, so its profit is not counted.')).toBeNull();
    expect(screen.getByLabelText('Show profit figures')).toBeTruthy();
  });

  it('custom dates show day chips', async () => {
    const a = actions();
    await renderWithTheme(<ProfitView model={model({ period: 'custom', customFrom: TODAY, customTo: TODAY })} actions={a} />);
    await fireEvent.press(screen.getByTestId('profit-day-1'));
    expect(a.pickDay).toHaveBeenCalledWith(TODAY - 86_400_000);
  });
});
