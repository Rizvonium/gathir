/**
 * Overlay rules (overlayStore): @expo/ui sheets are separate windows above the app, so
 * - the app lock takes sheets down (they would sit above the PIN pad) and holds toasts back;
 * - a toast raised while a sheet is open is shown inside that sheet, not under its scrim.
 */
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { useState, type ReactNode } from 'react';
import { AccessibilityInfo, AppState, Pressable, Text, View } from 'react-native';

import { AppLockGate } from '@/features/lock/AppLockGate';

import { AppSheet } from '../AppSheet';
import { useOverlayStore } from '../overlayStore';
import { ToastProvider, useToast } from '../Toast';
import { renderWithTheme } from './renderWithTheme';

jest.mock('react-native-gesture-handler', () => ({
  usePanGesture: () => ({}),
  GestureDetector: ({ children }: { children: unknown }) => children,
}));
jest.mock('@expo/ui', () => {
  const { View: V } = require('react-native');
  return {
    Host: ({ children }: { children?: ReactNode }) => <V>{children}</V>,
    BottomSheet: ({ isPresented, children, testID }: { isPresented: boolean; children?: ReactNode; testID?: string }) =>
      isPresented ? <V testID={testID}>{children}</V> : null,
  };
});
jest.mock('@/db/client', () => ({ db: {} }));
jest.mock('@/db/repo/settings', () => ({ updateSettings: jest.fn() }));
let mockPinFlag = true;
jest.mock('@/db/hooks', () => ({ useDbQuery: () => mockPinFlag }));
jest.mock('@/features/lock/pinStore', () => ({ isPinStored: jest.fn(async () => true) }));
jest.mock('@/features/lock/components/PinVerifyPanel', () => {
  const { Pressable: P, Text: T } = require('react-native');
  return {
    PinVerifyPanel: ({ onSuccess, testID }: { onSuccess: () => void; testID?: string }) => (
      <P testID={testID} onPress={onSuccess}>
        <T>PIN pad</T>
      </P>
    ),
  };
});

function Shop({ sheetOpen = true }: { sheetOpen?: boolean }) {
  const toast = useToast();
  const [visible, setVisible] = useState(sheetOpen);
  return (
    <View>
      <Pressable testID="toast-from-screen" onPress={() => toast.show({ message: 'Marked as sent', actionLabel: 'Undo', onAction: jest.fn() })} />
      <AppSheet visible={visible} onClose={() => setVisible(false)} testID="sheet">
        <Text>Anita · 98765 43210</Text>
        <Pressable testID="save-in-sheet" onPress={() => toast.show({ message: "Saved to Anita's catalogue", actionLabel: 'Undo', onAction: jest.fn() })} />
        <Pressable testID="close-sheet" onPress={() => setVisible(false)} />
      </AppSheet>
    </View>
  );
}

const app = (sheetOpen?: boolean) => (
  <ToastProvider>
    <AppLockGate>
      <Shop sheetOpen={sheetOpen} />
    </AppLockGate>
  </ToastProvider>
);

beforeEach(() => {
  mockPinFlag = true;
  useOverlayStore.setState({ locked: false, sheets: [] });
  jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('app lock and sheets', () => {
  it('takes an open sheet down while the PIN pad is up, and brings it back after the PIN', async () => {
    await renderWithTheme(app());
    expect(screen.getByTestId('app-lock')).toBeTruthy();
    expect(screen.queryByTestId('sheet')).toBeNull();
    expect(screen.queryByText('Anita · 98765 43210')).toBeNull();
    await fireEvent.press(screen.getByTestId('app-lock'));
    expect(screen.getByTestId('sheet')).toBeTruthy();
  });

  it('takes the sheet down when the lock engages on return after a long time away', async () => {
    const listeners: ((s: string) => void)[] = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_e, fn) => {
      listeners.push(fn as (s: string) => void);
      return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
    });
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    await renderWithTheme(app());
    await fireEvent.press(screen.getByTestId('app-lock'));
    expect(screen.getByTestId('sheet')).toBeTruthy();
    await act(async () => listeners.forEach((l) => l('background')));
    now.mockReturnValue(1_000_000 + 6 * 60_000);
    await act(async () => listeners.forEach((l) => l('active')));
    expect(screen.getByTestId('app-lock')).toBeTruthy();
    expect(screen.queryByTestId('sheet')).toBeNull();
  });

  it('holds a toast back while locked (nothing tappable above the PIN pad) and shows it after the PIN', async () => {
    mockPinFlag = false;
    await renderWithTheme(app(false));
    await act(async () => useOverlayStore.getState().setLocked(true));
    await fireEvent.press(screen.getByTestId('toast-from-screen'));
    expect(screen.queryByText('Marked as sent')).toBeNull();
    expect(screen.queryByTestId('toast-action-primary')).toBeNull();
    await act(async () => useOverlayStore.getState().setLocked(false));
    expect(screen.getByText('Marked as sent')).toBeTruthy();
    expect(screen.getByTestId('toast-action-primary')).toBeTruthy();
  });
});

describe('toasts and sheets', () => {
  it('shows a toast raised from inside a sheet within the sheet, with its Undo', async () => {
    mockPinFlag = false;
    await renderWithTheme(app());
    await fireEvent.press(screen.getByTestId('save-in-sheet'));
    const sheet = screen.getByTestId('sheet');
    expect(within(sheet).getByText("Saved to Anita's catalogue")).toBeTruthy();
    expect(within(sheet).getByTestId('toast-action-primary')).toBeTruthy();
    // Shown once: not also in the app window under the sheet.
    expect(screen.getAllByText("Saved to Anita's catalogue")).toHaveLength(1);
  });

  it('moves the toast back to the app window when the sheet closes', async () => {
    mockPinFlag = false;
    await renderWithTheme(app());
    await fireEvent.press(screen.getByTestId('save-in-sheet'));
    await fireEvent.press(screen.getByTestId('close-sheet'));
    expect(screen.queryByTestId('sheet')).toBeNull();
    expect(screen.getByText("Saved to Anita's catalogue")).toBeTruthy();
    expect(screen.queryByTestId('toast-inline')).toBeNull();
  });
});
