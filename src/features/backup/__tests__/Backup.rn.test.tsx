import 'react-native-gesture-handler/jestSetup';

import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { renderWithTheme } from '@/ui/components/__tests__/renderWithTheme';

import { BackupScreen } from '../components/BackupScreen';
import { RestoreResultScreen } from '../components/RestoreResultScreen';

jest.mock('react-native-keyboard-controller', () => require('react-native-keyboard-controller/jest'));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@expo/ui', () => {
  const { View } = require('react-native');
  return {
    Host: ({ children }: { children?: ReactNode }) => <View>{children}</View>,
    BottomSheet: ({ isPresented, children }: { isPresented: boolean; children?: ReactNode }) => (isPresented ? <View>{children}</View> : null),
  };
});
const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true };
jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
}));
jest.mock('expo-file-system', () => ({ Paths: { availableDiskSpace: 8 * 1024 ** 3 } }));
jest.mock('@/db/client', () => ({ db: {} }));
let mockLastBackup: number | null = null;
jest.mock('@/db/hooks', () => ({ useDbQuery: () => mockLastBackup, useToday: () => new Date(2026, 10, 22).getTime() }));
jest.mock('@/lib/storage', () => ({
  storageUsage: () => ({ photosBytes: 50 * 1024 ** 2, photoCount: 120, dbBytes: 2 * 1024 ** 2, exportsBytes: 0 }),
  formatBytes: (b: number) => `${Math.round(b / 1024 ** 2)} MB`,
}));
const mockService = { createBackup: jest.fn(), shareBackup: jest.fn(), pickAndRestoreBackup: jest.fn() };
jest.mock('../backupService', () => ({
  createBackup: (...a: unknown[]) => mockService.createBackup(...a),
  shareBackup: (...a: unknown[]) => mockService.shareBackup(...a),
  pickAndRestoreBackup: (...a: unknown[]) => mockService.pickAndRestoreBackup(...a),
}));
jest.mock('../backupReminder', () => ({ scheduleBackupReminder: jest.fn(async () => true) }));
type ToastOpts = { message: string; tone?: string };
const mockToast = jest.fn<string, [ToastOpts]>(() => 'id');
jest.mock('@/ui/components/Toast', () => ({
  useToast: () => ({ show: mockToast, hide: jest.fn() }),
  ToastProvider: ({ children }: { children: ReactNode }) => children,
  ToastOutlet: () => null,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockLastBackup = null;
});

describe('Backup screen', () => {
  it('says plainly when there is no backup yet', async () => {
    await renderWithTheme(<BackupScreen />);
    expect(screen.getByText('No backup yet')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('120 photos · 50 MB')).toBeTruthy());
  });

  it('makes a backup and opens the share sheet', async () => {
    mockService.createBackup.mockResolvedValue({ uri: 'file:///b.zip', sizeBytes: 60 * 1024 ** 2, counts: { tables: {}, photoFiles: 0 } });
    mockService.shareBackup.mockResolvedValue(true);
    await renderWithTheme(<BackupScreen />);
    await fireEvent.press(screen.getByTestId('backup-create'));
    await waitFor(() => expect(mockToast).toHaveBeenCalled());
    expect(mockService.shareBackup).toHaveBeenCalledWith('file:///b.zip', 'Keep your Gathir backup');
    expect(mockToast.mock.calls[0][0].message).toBe('Backup made (60 MB). Keep it somewhere other than this phone.');
  });

  it('restore: warns first, then shows the result screen', async () => {
    mockService.pickAndRestoreBackup.mockResolvedValue({ ok: true, counts: { tables: { products: 21, sales: 40, customers: 12 }, photoFiles: 126 } });
    await renderWithTheme(<BackupScreen />);
    await fireEvent.press(screen.getByTestId('backup-restore'));
    expect(screen.getByText('This replaces everything on this phone')).toBeTruthy();
    expect(mockService.pickAndRestoreBackup).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('restore-confirm'));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalled());
    expect(mockRouter.replace).toHaveBeenCalledWith({
      pathname: '/backup/result',
      params: { status: 'ok', designs: '21', sales: '40', customers: '12', photos: '63' },
    });
  });

  it('restore cancelled: a gentle note, nothing else', async () => {
    mockService.pickAndRestoreBackup.mockResolvedValue({ ok: false, reason: 'cancelled', message: '' });
    await renderWithTheme(<BackupScreen />);
    await fireEvent.press(screen.getByTestId('backup-restore'));
    await fireEvent.press(screen.getByTestId('restore-confirm'));
    await waitFor(() => expect(mockToast).toHaveBeenCalledWith({ message: 'No backup file was chosen.' }));
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });
});

describe('Restore result', () => {
  it('success opens the shop', async () => {
    await renderWithTheme(<RestoreResultScreen outcome={{ kind: 'ok', counts: { designs: 2, sales: 3, customers: 4, photos: 5 } }} />);
    expect(screen.getByText('Restored 2 designs, 3 sales, 4 customers and 5 photos.')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('restore-open-shop'));
    expect(mockRouter.replace).toHaveBeenCalledWith('/');
  });

  it('newer version explains and reassures', async () => {
    await renderWithTheme(<RestoreResultScreen outcome={{ kind: 'newer_version' }} />);
    expect(screen.getByText('This backup needs a newer Gathir')).toBeTruthy();
    expect(screen.getByText('Nothing on this phone was changed.')).toBeTruthy();
  });
});
