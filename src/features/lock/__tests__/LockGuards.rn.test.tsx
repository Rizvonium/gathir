/**
 * Lock guards that links and app switching must not get around:
 * - /lock?mode=set never replaces an existing PIN without it;
 * - the privacy cover hides shop data the moment the app leaves the screen;
 * - /showroom/leave only closes the Showroom after the PIN was entered for it.
 */
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { AppState, Pressable, Text } from 'react-native';

import { renderWithTheme } from '@/ui/components/__tests__/renderWithTheme';

import { enterShowroom, resetShowroomSessionForTests } from '@/features/showroom/logic/session';
import { useLeaveShowroom } from '@/features/showroom/hooks/useLeaveShowroom';

import { AppLockGate } from '../AppLockGate';
import { LockScreen } from '../components/LockScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), dismiss: jest.fn(), canGoBack: jest.fn(() => true) },
  Stack: { Screen: () => null },
  useNavigation: () => ({ getState: () => ({ routes: [{ name: '(tabs)' }, { name: 'showroom/index' }, { name: 'lock' }, { name: 'showroom/leave' }] }) }),
}));
jest.mock('@expo/ui', () => ({ Host: () => null, BottomSheet: () => null }));
jest.mock('@/db/client', () => ({ db: {} }));
jest.mock('@/db/repo/settings', () => ({ updateSettings: jest.fn() }));
let mockPinFlag = true;
jest.mock('@/db/hooks', () => ({ useDbQuery: () => mockPinFlag }));
let mockStored = true;
jest.mock('../pinStore', () => ({
  isPinStored: jest.fn(async () => mockStored),
  savePin: jest.fn(async () => undefined),
  verifyPin: jest.fn(),
  readAttempts: jest.fn(async () => ({ fails: 0, lockedUntil: null, rounds: 0 })),
  canUseFingerprint: jest.fn(async () => false),
  unlockWithFingerprint: jest.fn(async () => false),
}));
// The panels themselves are covered in Lock.rn.test; here only which one shows, and what success does.
jest.mock('../components/PinVerifyPanel', () => {
  const { Pressable: P, Text: T } = require('react-native');
  return {
    PinVerifyPanel: ({ onSuccess, testID, title }: { onSuccess: () => void; testID?: string; title?: string }) => (
      <P testID={testID ?? 'verify-panel'} onPress={onSuccess}>
        <T>{title ?? 'verify'}</T>
      </P>
    ),
  };
});
jest.mock('../components/SetPinPanel', () => {
  const { Text: T } = require('react-native');
  return { SetPinPanel: () => <T testID="set-panel">set</T> };
});
jest.mock('@/ui/components/Toast', () => ({
  useToast: () => ({ show: jest.fn(), hide: jest.fn() }),
  ToastProvider: ({ children }: { children: ReactNode }) => children,
  ToastOutlet: () => null,
}));

const mockRouter = (jest.requireMock('expo-router') as { router: Record<'push' | 'back' | 'replace' | 'dismiss' | 'canGoBack', jest.Mock> }).router;

beforeEach(() => {
  jest.clearAllMocks();
  mockRouter.canGoBack.mockReturnValue(true);
  mockPinFlag = true;
  mockStored = true;
  resetShowroomSessionForTests();
});

describe('/lock?mode=set', () => {
  it('asks for the current PIN first when one already exists (a link cannot replace it)', async () => {
    await renderWithTheme(<LockScreen mode="set" />);
    expect(screen.queryByTestId('set-panel')).toBeNull();
    expect(screen.getByTestId('verify-panel')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('verify-panel'));
    expect(screen.getByTestId('set-panel')).toBeTruthy();
  });

  it('also when only the device store holds a PIN (flag out of date)', async () => {
    mockPinFlag = false;
    await renderWithTheme(<LockScreen mode="set" />);
    await waitFor(() => expect(screen.getByTestId('verify-panel')).toBeTruthy());
    expect(screen.queryByTestId('set-panel')).toBeNull();
  });

  it('sets a first PIN directly', async () => {
    mockPinFlag = false;
    mockStored = false;
    await renderWithTheme(<LockScreen mode="set" />);
    await waitFor(() => expect(screen.getByTestId('set-panel')).toBeTruthy());
  });
});

describe('leaving the Showroom', () => {
  function Leave() {
    useLeaveShowroom();
    return <Text>leave</Text>;
  }

  it('a link straight to /showroom/leave only pops itself while the Showroom is open', async () => {
    enterShowroom();
    await renderWithTheme(<Leave />);
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(mockRouter.dismiss).not.toHaveBeenCalled();
  });

  it('after the PIN on the lock screen, closes the Showroom', async () => {
    enterShowroom();
    await renderWithTheme(<LockScreen mode="verify" returnTo="/showroom/leave" />);
    await fireEvent.press(screen.getByTestId('verify-panel'));
    expect(mockRouter.replace).toHaveBeenCalledWith('/showroom/leave');
    await renderWithTheme(<Leave />);
    expect(mockRouter.dismiss).toHaveBeenCalledWith(3);
    // The pass is used up: a second visit does nothing.
    mockRouter.back.mockClear();
    await renderWithTheme(<Leave />);
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });
});

describe('privacy cover', () => {
  it('covers the screen as soon as the app goes to the background, and uncovers on a quick return', async () => {
    const listeners: ((s: string) => void)[] = [];
    const spy = jest.spyOn(AppState, 'addEventListener').mockImplementation((_e, fn) => {
      listeners.push(fn as (s: string) => void);
      return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
    });
    await renderWithTheme(
      <AppLockGate>
        <Pressable>
          <Text>Profit ₹1,25,000</Text>
        </Pressable>
      </AppLockGate>,
    );
    // Cold start with a PIN: locked.
    await fireEvent.press(screen.getByTestId('app-lock'));
    expect(screen.queryByTestId('app-lock')).toBeNull();
    expect(screen.queryByTestId('app-privacy-cover')).toBeNull();

    await act(async () => listeners.forEach((l) => l('background')));
    expect(screen.getByTestId('app-privacy-cover')).toBeTruthy();
    await act(async () => listeners.forEach((l) => l('active')));
    expect(screen.queryByTestId('app-privacy-cover')).toBeNull();
    expect(screen.queryByTestId('app-lock')).toBeNull();
    spy.mockRestore();
  });
});
