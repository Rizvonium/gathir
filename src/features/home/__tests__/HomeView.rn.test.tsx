import 'react-native-gesture-handler/jestSetup';

import { fireEvent, screen } from '@testing-library/react-native';

import type { HomeSummary } from '@/db/repo/dashboard';
import { renderWithTheme } from '@/ui/components/__tests__/renderWithTheme';

import { buildHomeModel } from '../homeLogic';
import type { HomeActions } from '../useHome';
import { HomeView } from '../HomeScreen';

jest.mock('react-native-reanimated', () => require('@/ui/components/__tests__/reanimatedMock'));

const mockPush = jest.fn();
const mockNavigate = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, navigate: mockNavigate, replace: jest.fn(), back: jest.fn() }),
}));
jest.mock('react-native-keyboard-controller', () => require('react-native-keyboard-controller/jest'));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@/ui/patterns', () => {
  const { View } = require('react-native');
  return {
    PatternHeader: () => <View testID="pattern-header" />,
    LoomEmptyState: () => <View testID="loom" />,
    PatternPlaceholder: ({ productId }: { productId: string }) => <View testID={`placeholder-${productId}`} />,
  };
});
jest.mock('@/lib/photos', () => ({ thumbUri: (n: string) => `file:///thumbs/${n}` }));
// The screen's data hook (DB-backed) is not used by HomeView.
jest.mock('../useHome', () => ({ useHome: jest.fn() }));

const NOW = new Date(2026, 10, 22, 15, 0).getTime();
const DAY = 86_400_000;

const summary = (over: Partial<HomeSummary> = {}): HomeSummary => ({
  totalPieces: 128,
  designs: 24,
  stockValuePaise: 42_000_000,
  todayPieces: 3,
  todayAmountPaise: 1_950_000,
  yesterdayAmountPaise: 650_000,
  lowStock: [{ id: 'p-low', code: 'GTH-0002', name: 'Sozni Pashmina Stole with a very long name that wraps', totalPieces: 1, coverThumb: 'p-low_t.jpg' }],
  soldOut: [{ id: 'p-out', code: 'GTH-0001', name: 'Kani Jamawar', totalPieces: 0, coverThumb: null }],
  unreportedSalesCount: 7,
  lastReportSentAt: NOW - 3 * DAY,
  followUpsDue: [
    { eventId: 'e1', customerId: 'c1', customerName: 'Anita Kaul', phone: '+919906000104', whatsappOk: true, dueAt: NOW, note: 'New Kani arrived', notificationId: null },
  ],
  ...over,
});

const extras = { shopName: 'Valley Pashmina House', lastBackupAt: NOW - DAY, hasSample: false, realProducts: 24 };

function actions(): HomeActions {
  return { clearSample: jest.fn(), trySample: jest.fn(), completeFollowUp: jest.fn(), messageFollowUp: jest.fn() };
}

beforeEach(() => {
  mockPush.mockClear();
  mockNavigate.mockClear();
});

describe('HomeView', () => {
  it('shows the shop, stock, today, report status and needs-attention strip', async () => {
    const a = actions();
    await renderWithTheme(<HomeView model={buildHomeModel(summary(), extras, 1, NOW)} actions={a} />);
    expect(screen.getByText('Good afternoon')).toBeTruthy();
    expect(screen.getByTestId('home-shop-name').props.children).toBe('Valley Pashmina House');
    expect(screen.getByLabelText('Stock: 128 pieces in 24 designs, worth ₹4,20,000. Open stock.')).toBeTruthy();
    expect(screen.getByTestId('home-today-compare', { includeHiddenElements: true }).props.children).toBe('₹13,000 more than yesterday');
    expect(screen.getByTestId('home-report-status').props.children).toBe('Last sent 3 days ago');
    expect(screen.getByText('7 new sales')).toBeTruthy();
    expect(screen.getByText('Send report')).toBeTruthy();
    // Sold out comes first; a product without a photo gets the pattern placeholder.
    expect(screen.getByTestId('placeholder-p-out')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Kani Jamawar, Sold out. Open product.'));
    expect(mockPush).toHaveBeenCalledWith('/product/p-out');
    expect(screen.queryByTestId('home-backup')).toBeNull();
    expect(screen.queryByTestId('home-sample')).toBeNull();
  });

  it('quick actions open their routes', async () => {
    await renderWithTheme(<HomeView model={buildHomeModel(summary(), extras, 1, NOW)} actions={actions()} />);
    await fireEvent.press(screen.getByTestId('home-action-sell'));
    await fireEvent.press(screen.getByTestId('home-action-addProduct'));
    await fireEvent.press(screen.getByTestId('home-action-showroom'));
    await fireEvent.press(screen.getByTestId('home-action-catalogue'));
    expect(mockPush.mock.calls.map((c) => c[0])).toEqual(['/sell', '/product/new', '/showroom', '/catalogue']);
  });

  it('invites the first report when none was sent', async () => {
    await renderWithTheme(<HomeView model={buildHomeModel(summary({ lastReportSentAt: null, unreportedSalesCount: 0 }), extras, 1, NOW)} actions={actions()} />);
    expect(screen.getByText('You have not sent a report yet.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Send your first report'));
    expect(mockPush).toHaveBeenCalledWith('/report');
  });

  it('follow-ups: WhatsApp and mark done', async () => {
    const a = actions();
    await renderWithTheme(<HomeView model={buildHomeModel(summary(), extras, 1, NOW)} actions={a} />);
    await fireEvent.press(screen.getByLabelText('Message Anita Kaul on WhatsApp'));
    expect(a.messageFollowUp).toHaveBeenCalledWith(expect.objectContaining({ eventId: 'e1' }));
    await fireEvent.press(screen.getByLabelText('Mark Anita Kaul done'));
    expect(a.completeFollowUp).toHaveBeenCalledWith(expect.objectContaining({ eventId: 'e1' }));
  });

  it('sample data banner clears with one tap', async () => {
    const a = actions();
    await renderWithTheme(<HomeView model={buildHomeModel(summary(), { ...extras, hasSample: true }, 1, NOW)} actions={a} />);
    expect(screen.getByText("You're looking at sample products.")).toBeTruthy();
    await fireEvent.press(screen.getByTestId('home-sample-clear'));
    expect(a.clearSample).toHaveBeenCalledTimes(1);
  });

  it('nudges a backup when it is over a week old', async () => {
    await renderWithTheme(<HomeView model={buildHomeModel(summary(), { ...extras, lastBackupAt: NOW - 9 * DAY }, 1, NOW)} actions={actions()} />);
    expect(screen.getByText('Last backup 9 days ago')).toBeTruthy();
    await fireEvent.press(screen.getByText('Back up now'));
    expect(mockPush).toHaveBeenCalledWith('/backup');
  });

  it('empty shop: loom, add first shawl, try sample; no stock cards', async () => {
    const a = actions();
    const empty = summary({ totalPieces: 0, designs: 0, stockValuePaise: 0, todayPieces: 0, todayAmountPaise: 0, yesterdayAmountPaise: 0, lowStock: [], soldOut: [], unreportedSalesCount: 0, lastReportSentAt: null, followUpsDue: [] });
    await renderWithTheme(<HomeView model={buildHomeModel(empty, { ...extras, shopName: '', lastBackupAt: null, realProducts: 0 }, 1, NOW)} actions={a} />);
    expect(screen.getByTestId('loom')).toBeTruthy();
    expect(screen.getByTestId('home-shop-name').props.children).toBe('My shop');
    expect(screen.queryByTestId('home-stock')).toBeNull();
    expect(screen.queryByTestId('home-backup')).toBeNull();
    await fireEvent.press(screen.getByText('Add your first shawl'));
    expect(mockPush).toHaveBeenCalledWith('/product/new');
    await fireEvent.press(screen.getByTestId('home-empty-sample'));
    expect(a.trySample).toHaveBeenCalled();
  });

  it('a quiet day reads "No sales yet today"', async () => {
    await renderWithTheme(<HomeView model={buildHomeModel(summary({ todayPieces: 0, todayAmountPaise: 0, yesterdayAmountPaise: 0 }), extras, 1, NOW)} actions={actions()} />);
    expect(screen.getByTestId('home-today-compare', { includeHiddenElements: true }).props.children).toBe('No sales yet today');
  });
});
