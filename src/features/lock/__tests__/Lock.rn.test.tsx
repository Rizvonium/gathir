import 'react-native-gesture-handler/jestSetup';

import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { renderWithTheme } from '@/ui/components/__tests__/renderWithTheme';

import { PinVerifyPanel } from '../components/PinVerifyPanel';
import { SetPinPanel } from '../components/SetPinPanel';

// The shared stand-in has no withSequence (the wrong-PIN shake): settle on the last step.
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  ...jest.requireActual('@/ui/components/__tests__/reanimatedMock'),
  withSequence: (...steps: unknown[]) => steps[steps.length - 1],
}));
jest.mock('react-native-keyboard-controller', () => require('react-native-keyboard-controller/jest'));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@expo/ui', () => ({ Host: () => null, BottomSheet: () => null }));
jest.mock('@/db/client', () => ({ db: {} }));
const mockUpdateSettings = jest.fn();
jest.mock('@/db/repo/settings', () => ({ updateSettings: (...a: unknown[]) => mockUpdateSettings(...a) }));
const mockStore = {
  savePin: jest.fn(async () => undefined),
  verifyPin: jest.fn(),
  readAttempts: jest.fn(async () => ({ fails: 0, lockedUntil: null })),
  canUseFingerprint: jest.fn(async () => false),
  unlockWithFingerprint: jest.fn(async () => false),
};
jest.mock('../pinStore', () => ({
  savePin: (...a: unknown[]) => (mockStore.savePin as jest.Mock)(...a),
  verifyPin: (...a: unknown[]) => mockStore.verifyPin(...a),
  readAttempts: () => mockStore.readAttempts(),
  canUseFingerprint: () => mockStore.canUseFingerprint(),
  unlockWithFingerprint: () => mockStore.unlockWithFingerprint(),
}));
jest.mock('@/ui/components/Toast', () => ({
  useToast: () => ({ show: jest.fn(), hide: jest.fn() }),
  ToastProvider: ({ children }: { children: ReactNode }) => children,
}));

async function type(prefix: string, pin: string) {
  for (const d of pin) await fireEvent.press(screen.getByTestId(`${prefix}-key-${d}`));
}

beforeEach(() => jest.clearAllMocks());

describe('Set PIN', () => {
  it('asks twice, starts over on a mismatch, then saves the hash and the flag', async () => {
    const onDone = jest.fn();
    await renderWithTheme(<SetPinPanel onDone={onDone} />);
    expect(screen.getByText('Choose a PIN')).toBeTruthy();
    await type('pin-set', '1234');
    expect(screen.getByText('Type it again')).toBeTruthy();
    await type('pin-set', '1235');
    expect(screen.getByText('The two PINs were different. Choose your PIN again.')).toBeTruthy();
    expect(screen.getByText('Choose a PIN')).toBeTruthy();
    expect(mockStore.savePin).not.toHaveBeenCalled();

    await type('pin-set', '2580');
    await type('pin-set', '2580');
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(mockStore.savePin).toHaveBeenCalledWith('2580');
    expect(mockUpdateSettings).toHaveBeenCalledWith({}, { pinHashSet: true });
  });

  it('backspace removes the last digit', async () => {
    await renderWithTheme(<SetPinPanel onDone={jest.fn()} />);
    await type('pin-set', '12');
    await fireEvent.press(screen.getByLabelText('Delete last digit'));
    expect(screen.getByLabelText('1 of 4 digits entered')).toBeTruthy();
  });
});

describe('Enter PIN', () => {
  it('says how many tries are left after a wrong PIN, and unlocks on the right one', async () => {
    const onSuccess = jest.fn();
    mockStore.verifyPin.mockResolvedValueOnce({ status: 'wrong', attempts: { fails: 1, lockedUntil: null } }).mockResolvedValueOnce({ status: 'ok' });
    await renderWithTheme(<PinVerifyPanel onSuccess={onSuccess} />);
    await type('pin-verify', '1111');
    await waitFor(() => expect(screen.getByText('Wrong PIN. 4 tries left before a short pause.')).toBeTruthy());
    expect(onSuccess).not.toHaveBeenCalled();
    await type('pin-verify', '2580');
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  });

  it('pauses the keypad after 5 wrong tries', async () => {
    mockStore.verifyPin.mockResolvedValueOnce({ status: 'locked', remainingMs: 30_000, attempts: { fails: 0, lockedUntil: Date.now() + 30_000 } });
    await renderWithTheme(<PinVerifyPanel onSuccess={jest.fn()} />);
    await type('pin-verify', '0000');
    await waitFor(() => expect(screen.getByText(/Too many wrong tries. Try again in (30|29) s./)).toBeTruthy());
    await fireEvent.press(screen.getByTestId('pin-verify-key-1'));
    expect(screen.getByLabelText('0 of 4 digits entered')).toBeTruthy();
  });

  it('offers the fingerprint key when the phone has one', async () => {
    mockStore.canUseFingerprint.mockResolvedValue(true);
    await renderWithTheme(<PinVerifyPanel onSuccess={jest.fn()} autoFingerprint={false} />);
    await waitFor(() => expect(screen.getByLabelText('Use fingerprint')).toBeTruthy());
    expect(mockStore.unlockWithFingerprint).not.toHaveBeenCalled();
  });
});
