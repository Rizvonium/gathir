import 'react-native-gesture-handler/jestSetup';

import { fireEvent, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { renderWithTheme } from '@/ui/components/__tests__/renderWithTheme';

import { MoreScreen } from '../components/MoreScreen';
import { SampleDataScreen } from '../components/SampleDataScreen';
import { StockSettingsScreen } from '../components/StockSettingsScreen';

jest.mock('react-native-keyboard-controller', () => require('react-native-keyboard-controller/jest'));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@expo/ui', () => {
  const { View } = require('react-native');
  return {
    Host: ({ children }: { children?: ReactNode }) => <View>{children}</View>,
    Switch: () => <View />,
    BottomSheet: ({ isPresented, children }: { isPresented: boolean; children?: ReactNode }) => (isPresented ? <View>{children}</View> : null),
  };
});
jest.mock('expo-application', () => ({ nativeApplicationVersion: '1.0.0', nativeBuildVersion: '7' }));
const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true };
jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
  useRouter: () => mockRouter,
}));
jest.mock('@/db/client', () => ({ db: {} }));

let mockResults: Record<string, unknown> = {};
jest.mock('@/db/hooks', () => ({
  useDbQuery: (fn: { name: string }) => mockResults[fn.name],
  useToday: () => new Date(2026, 10, 22).getTime(),
  useLowStockLevel: () => 2,
}));
const mockUpdateSettings = jest.fn();
jest.mock('@/db/repo/settings', () => ({ updateSettings: (...a: unknown[]) => mockUpdateSettings(...a) }));
const mockCats = { createCategory: jest.fn(() => 'new'), deleteCategory: jest.fn(), renameCategory: jest.fn(), reorderCategories: jest.fn() };
jest.mock('@/db/repo/categories', () => ({
  listCategoriesWithCounts: function listCategoriesWithCounts() {},
  createCategory: (...a: unknown[]) => (mockCats.createCategory as jest.Mock)(...a),
  deleteCategory: (...a: unknown[]) => mockCats.deleteCategory(...a),
  renameCategory: (...a: unknown[]) => mockCats.renameCategory(...a),
  reorderCategories: (...a: unknown[]) => mockCats.reorderCategories(...a),
}));
const mockSample = { insertSampleData: jest.fn(), clearSampleData: jest.fn(() => ({ products: 5, sales: 3, customers: 4 })) };
jest.mock('@/db/sampleData', () => ({
  hasSampleData: function hasSampleData() {},
  insertSampleData: (...a: unknown[]) => mockSample.insertSampleData(...a),
  clearSampleData: (...a: unknown[]) => (mockSample.clearSampleData as jest.Mock)(...a),
}));

type ToastOpts = { message: string; actionLabel?: string; onAction?: () => void; tone?: string };
const mockToast = jest.fn<string, [ToastOpts]>(() => 'id');
jest.mock('@/ui/components/Toast', () => ({
  useToast: () => ({ show: mockToast, hide: jest.fn() }),
  ToastProvider: ({ children }: { children: ReactNode }) => children,
  ToastOutlet: () => null,
}));

const summary = {
  shopName: 'Valley Pashmina',
  sellerName: 'Bilal',
  ownerWhatsapp: '',
  includePhones: true,
  includeProfit: false,
  lowStockLevel: 2,
  categoryCount: 4,
  catalogueStyle: 'bazaar',
  language: 'en',
  pinSet: false,
  lastBackupAt: null,
  sentReports: 3,
  hasSample: false,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockResults = {
    readMoreSummary: summary,
    listCategoriesWithCounts: [
      { id: 'a', name: 'Stoles', icon: 'category', productCount: 0 },
      { id: 'b', name: 'Shawls', icon: 'category', productCount: 3 },
    ],
    hasSampleData: true,
  };
});

describe('More tab', () => {
  it('shows current values and warns in words when the owner number and backup are missing', async () => {
    await renderWithTheme(<MoreScreen />);
    expect(screen.getByText('Valley Pashmina · Bilal')).toBeTruthy();
    expect(screen.getByText('Not set. Reports cannot be sent yet.')).toBeTruthy();
    expect(screen.getByText('Never backed up. Make one today.')).toBeTruthy();
    expect(screen.getByText('Low at 2 pieces or fewer')).toBeTruthy();
    expect(screen.getByText('3 reports sent')).toBeTruthy();
    expect(screen.getByText('Gathir 1.0.0 (7)')).toBeTruthy();
    expect(screen.getByText('Made for Kashmiri artisans')).toBeTruthy();
  });

  it('opens sub-screens and saves the phones toggle at once', async () => {
    await renderWithTheme(<MoreScreen />);
    await fireEvent.press(screen.getByTestId('more-owner'));
    expect(mockRouter.push).toHaveBeenCalledWith('/settings/owner');
    await fireEvent.press(screen.getByTestId('more-backup'));
    expect(mockRouter.push).toHaveBeenCalledWith('/backup');
    await fireEvent.press(screen.getByTestId('more-deleted'));
    expect(mockRouter.push).toHaveBeenCalledWith('/deleted');
    await fireEvent.press(screen.getByTestId('more-report-phones'));
    expect(mockUpdateSettings).toHaveBeenCalledWith({}, { reportIncludesCustomerPhones: false });
  });

  it('buying price & profit in owner reports: off by default, one tap turns it on', async () => {
    await renderWithTheme(<MoreScreen />);
    expect(screen.getByTestId('more-report-profit')).not.toBeChecked();
    await fireEvent.press(screen.getByTestId('more-report-profit'));
    expect(mockUpdateSettings).toHaveBeenCalledWith({}, { reportIncludesProfit: true });
  });
});

describe('Stock settings', () => {
  it('rejects a duplicate category name and adds a new one', async () => {
    await renderWithTheme(<StockSettingsScreen />);
    await fireEvent.changeText(screen.getByLabelText('New category name'), 'stoles');
    await fireEvent.press(screen.getByTestId('category-add'));
    expect(screen.getByText('There is already a category with this name.')).toBeTruthy();
    expect(mockCats.createCategory).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByLabelText('New category name'), '  Pherans ');
    await fireEvent.press(screen.getByTestId('category-add'));
    expect(mockCats.createCategory).toHaveBeenCalledWith({}, { name: 'Pherans' });
  });

  it('deletes an unused category with Undo, and explains when it is in use', async () => {
    await renderWithTheme(<StockSettingsScreen />);
    await fireEvent.press(screen.getByLabelText('Delete Shawls'));
    expect(mockCats.deleteCategory).not.toHaveBeenCalled();
    expect(mockToast.mock.calls[0][0].message).toBe('3 designs use this. Move them to another category first.');

    await fireEvent.press(screen.getByLabelText('Delete Stoles'));
    expect(mockCats.deleteCategory).toHaveBeenCalledWith({}, 'a');
    const toast = mockToast.mock.calls[1][0];
    expect(toast.actionLabel).toBe('Undo');
    toast.onAction?.();
    expect(mockCats.createCategory).toHaveBeenCalledWith({}, { name: 'Stoles', icon: 'category' });
    expect(mockCats.reorderCategories).toHaveBeenCalledWith({}, ['new', 'b']);
  });

  it('moves a category down', async () => {
    await renderWithTheme(<StockSettingsScreen />);
    await fireEvent.press(screen.getByLabelText('Move Stoles down'));
    expect(mockCats.reorderCategories).toHaveBeenCalledWith({}, ['b', 'a']);
  });
});

describe('Sample data', () => {
  it('clears sample data with Undo (no confirm dialog)', async () => {
    await renderWithTheme(<SampleDataScreen />);
    await fireEvent.press(screen.getByTestId('sample-clear'));
    expect(mockSample.clearSampleData).toHaveBeenCalled();
    const toast = mockToast.mock.calls[0][0];
    expect(toast.message).toBe('Sample data cleared: 5 designs, 3 sales, 4 customers');
    toast.onAction?.();
    expect(mockSample.insertSampleData).toHaveBeenCalled();
  });
});
