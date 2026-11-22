import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { BackHandler, Pressable, Text, View } from 'react-native';

import { ToastProvider } from '@/ui/components';
import { renderWithTheme } from '@/ui/components/__tests__/renderWithTheme';

import { ExitMark } from '../components/ExitMark';
import { SendMeThisSheet } from '../components/SendMeThisSheet';
import { ShowroomOverlay } from '../components/ShowroomOverlay';
import { useIdle } from '../hooks/useIdle';
import { useShowroomExit } from '../hooks/useShowroomExit';
import { EXIT_HOLD_MS } from '../logic/showroom';

jest.mock('react-native-keyboard-controller', () => require('react-native-keyboard-controller/jest'));
jest.mock('@shopify/react-native-skia', () => require('../../catalogue/__tests__/catalogueMocks').skia);
jest.mock('@expo/ui', () => require('../../catalogue/__tests__/catalogueMocks').expoUi);
jest.mock('@/ui/components/Toast', () => require('../../catalogue/__tests__/catalogueMocks').makeToastModule());
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useFocusEffect: (fn: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react');
    useEffect(() => fn(), [fn]);
  },
}));
jest.mock('@/db/client', () => ({ db: {} }));
jest.mock('@/db/hooks', () => ({
  useCustomers: ({ search }: { search?: string }) =>
    [{ id: 'c1', name: 'Mrs Shah', phone: '+919876543210' }].filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase())),
}));
const mockLiked = jest.fn();
const mockQuickAdd = jest.fn(() => ({ id: 'new1', name: 'Zainab' }));
jest.mock('@/features/catalogue/logic/record', () => ({
  recordLikedItems: (...a: unknown[]) => mockLiked(...a),
  quickAddCustomer: (...a: unknown[]) => mockQuickAdd(...(a as [])),
}));

const product = require('../../catalogue/__tests__/catalogueMocks').product;
const { router } = jest.requireMock('expo-router') as { router: { replace: jest.Mock; back: jest.Mock } };

describe('overlay', () => {
  it('shows rate, colours and plain availability, never cost', async () => {
    await renderWithTheme(
      <ShowroomOverlay
        product={product('p1', { totalPieces: 2, costPaise: 999_999 })}
        index={0}
        total={3}
        lowStockLevel={1}
        showExactCounts={false}
        bottomInset={0}
        onSendMeThis={jest.fn()}
      />,
    );
    expect(screen.getByText('Only 2 left')).toBeTruthy();
    expect(screen.getAllByText('₹6,500').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Colours: Red')).toBeTruthy();
    expect(screen.getByText('1 of 3')).toBeTruthy();
    expect(screen.queryByText(/9,999/)).toBeNull();
  });

  it('shows exact counts only when the seller allows it', async () => {
    await renderWithTheme(<ShowroomOverlay product={product('p1', { totalPieces: 12 })} index={1} total={3} lowStockLevel={1} showExactCounts bottomInset={0} onSendMeThis={jest.fn()} />);
    expect(screen.getByText('12 pieces')).toBeTruthy();
  });

  it('says Available and asks for the rate when none is set', async () => {
    await renderWithTheme(<ShowroomOverlay product={product('p1', { totalPieces: 12, ratePaise: 0 })} index={0} total={1} lowStockLevel={1} showExactCounts={false} bottomInset={0} onSendMeThis={jest.fn()} />);
    expect(screen.getByText('Available')).toBeTruthy();
    expect(screen.getAllByText('Ask for the rate').length).toBeGreaterThan(0);
  });
});

describe('leaving the showroom', () => {
  afterEach(() => jest.useRealTimers());

  it('needs a full 1.5 s hold on the corner mark', async () => {
    const onExit = jest.fn();
    await renderWithTheme(<ExitMark onExit={onExit} color="#000000" trackColor="#cccccc" />);
    jest.useFakeTimers();
    const mark = screen.getByLabelText('Leave showroom');
    await fireEvent(mark, 'pressIn');
    await act(async () => {
      jest.advanceTimersByTime(EXIT_HOLD_MS - 200);
    });
    await fireEvent(mark, 'pressOut');
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(onExit).not.toHaveBeenCalled();
    await fireEvent(mark, 'pressIn');
    await act(async () => {
      jest.advanceTimersByTime(EXIT_HOLD_MS);
    });
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('blocks the back button and asks for the PIN when one is set', async () => {
    const listeners: (() => boolean)[] = [];
    const spy = jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_e, fn) => {
      listeners.push(fn as () => boolean);
      return { remove: jest.fn() };
    });
    const onBlocked = jest.fn();
    function Harness({ pinSet }: { pinSet: boolean }) {
      const exit = useShowroomExit({ pinSet, onBackBlocked: onBlocked });
      return <Pressable testID="exit" onPress={exit} />;
    }
    await renderWithTheme(<Harness pinSet />);
    expect(listeners.map((fn) => fn())).toContain(true);
    expect(onBlocked).toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('exit'));
    expect(router.replace).toHaveBeenCalledWith({ pathname: '/lock', params: { mode: 'verify', returnTo: 'back' } });
    spy.mockRestore();
  });
});

describe('idle', () => {
  it('turns idle after the timeout and wakes on touch', async () => {
    function Harness() {
      const { idle, poke } = useIdle(40);
      return (
        <View>
          <Text testID="idle">{idle ? 'idle' : 'awake'}</Text>
          <Pressable testID="poke" onPress={poke} />
        </View>
      );
    }
    await renderWithTheme(<Harness />);
    expect(screen.getByTestId('idle')).toHaveTextContent('awake');
    await waitFor(() => expect(screen.getByTestId('idle')).toHaveTextContent('idle'));
    await fireEvent.press(screen.getByTestId('poke'));
    expect(screen.getByTestId('idle')).toHaveTextContent('awake');
  });
});

describe('Send me this', () => {
  it('finds a customer only after typing, saves the like, then offers card or small catalogue', async () => {
    const onLiked = jest.fn();
    const onSendCard = jest.fn();
    await renderWithTheme(
      <ToastProvider>
        <SendMeThisSheet product={product('p1')} visible onClose={jest.fn()} liked={{ c1: ['p0'] }} onLiked={onLiked} onSendCard={onSendCard} onSendMini={jest.fn()} />
      </ToastProvider>,
    );
    expect(screen.queryByText('Mrs Shah')).toBeNull();
    await fireEvent.changeText(screen.getByLabelText('Find a customer'), 'sh');
    await fireEvent.press(screen.getByText('Mrs Shah'));
    expect(mockLiked).toHaveBeenCalledWith({}, 'c1', ['p1']);
    expect(onLiked).toHaveBeenCalledWith('c1', ['p0', 'p1']);
    expect(screen.getByText('Small catalogue: 2 shawls they liked')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('sheet-send-card'));
    expect(onSendCard).toHaveBeenCalledWith({ id: 'c1', name: 'Mrs Shah', likedIds: ['p0', 'p1'] }, 'p1');
  });

  it('adds a new customer with just a number', async () => {
    await renderWithTheme(
      <ToastProvider>
        <SendMeThisSheet product={product('p1')} visible onClose={jest.fn()} liked={{}} onLiked={jest.fn()} onSendCard={jest.fn()} onSendMini={jest.fn()} />
      </ToastProvider>,
    );
    await fireEvent.press(screen.getByTestId('sheet-new'));
    expect(screen.getByTestId('sheet-add')).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('WhatsApp number'), '98765 43210');
    await fireEvent.press(screen.getByTestId('sheet-add'));
    expect(mockQuickAdd).toHaveBeenCalledWith({}, { name: '', phone: '+919876543210' });
    expect(screen.getByText('Send to Zainab')).toBeTruthy();
  });
});
