import { act, fireEvent, screen } from '@testing-library/react-native';
import { useEffect } from 'react';
import { AccessibilityInfo } from 'react-native';

import { toastActions, toastAnnouncement, ToastProvider, useToast, type ToastOptions } from '../Toast';
import { renderWithTheme } from './renderWithTheme';

// The swipe-to-dismiss gesture needs the native Reanimated runtime; the buttons are what is tested here.
jest.mock('react-native-gesture-handler', () => ({
  usePanGesture: () => ({}),
  GestureDetector: ({ children }: { children: unknown }) => children,
}));

function Show({ options }: { options: ToastOptions }) {
  const toast = useToast();
  useEffect(() => {
    toast.show(options);
  }, [toast, options]);
  return null;
}

async function renderToast(options: ToastOptions) {
  return renderWithTheme(
    <ToastProvider>
      <Show options={options} />
    </ToastProvider>,
  );
}

describe('Toast actions', () => {
  beforeEach(() => jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  it('orders the secondary action before the main one and drops actions without a handler', () => {
    const undo = jest.fn();
    const send = jest.fn();
    expect(toastActions({ message: 'Sold', actionLabel: 'Undo', onAction: undo, secondaryActionLabel: 'Send bill', onSecondaryAction: send }).map((a) => a.label)).toEqual([
      'Send bill',
      'Undo',
    ]);
    expect(toastActions({ message: 'Sold', actionLabel: 'Undo' })).toEqual([]);
    expect(toastAnnouncement({ message: 'Sold', actionLabel: 'Undo', onAction: undo, secondaryActionLabel: 'Send bill', onSecondaryAction: send })).toBe(
      'Sold. Send bill. Undo',
    );
  });

  it('renders both buttons; each runs its own handler and closes the toast', async () => {
    const undo = jest.fn();
    const send = jest.fn();
    const options = { message: 'Sold 1 piece', actionLabel: 'Undo', onAction: undo, secondaryActionLabel: 'Send bill', onSecondaryAction: send };
    await renderToast(options);
    expect(screen.getByText('Sold 1 piece')).toBeTruthy();
    expect(screen.getByLabelText('Undo')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Send bill'));
    expect(send).toHaveBeenCalledTimes(1);
    expect(undo).not.toHaveBeenCalled();
    expect(screen.queryByText('Sold 1 piece')).toBeNull();
  });

  it('the main action still works alone', async () => {
    const undo = jest.fn();
    await renderToast({ message: 'Deleted', actionLabel: 'Undo', onAction: undo });
    expect(screen.queryByTestId('toast-action-secondary')).toBeNull();
    await fireEvent.press(screen.getByTestId('toast-action-primary'));
    expect(undo).toHaveBeenCalledTimes(1);
    await act(async () => undefined);
    expect(screen.queryByText('Deleted')).toBeNull();
  });
});
