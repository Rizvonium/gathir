/** The product card screen: customer-safe over the Showroom, consent asked before a direct send. */
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/ui/components/__tests__/renderWithTheme';
import { enterShowroom, resetShowroomSessionForTests } from '@/features/showroom/logic/session';

import { CardScreen } from '../components/CardScreen';

jest.mock('react-native-keyboard-controller', () => require('react-native-keyboard-controller/jest'));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@shopify/flash-list', () => require('./catalogueMocks').flashList);
jest.mock('@expo/ui', () => require('./catalogueMocks').expoUi);
jest.mock('@/ui/patterns', () => require('./catalogueMocks').patterns);
jest.mock('@/ui/components/Toast', () => require('./catalogueMocks').makeToastModule());
jest.mock('@/db/client', () => ({ db: {} }));
jest.mock('@/db/hooks', () => ({
  useCustomers: () => [{ id: 'c9', name: 'Other Customer', phone: '+919822222222', city: '', whatsappOk: true }],
}));
jest.mock('@/share', () => {
  const { View } = require('react-native');
  return { ProductCardImage: () => <View /> };
});
jest.mock('../hooks/useExitFlow', () => ({ useExitFlow: () => jest.fn() }));
const mockSend = jest.fn();
jest.mock('../hooks/useProductCardSend', () => ({
  useProductCardSend: () => ({
    detail: { product: { deletedAt: null } },
    phase: { kind: 'choose' },
    data: { name: 'Kani shawl' },
    cardNode: null,
    send: (...a: unknown[]) => mockSend(...a),
    again: jest.fn(),
  }),
}));
const mockCatalogueSend = jest.fn();
const mockSendState: { status: string; phase: { kind: string }; lockedTo: string | null; sendAnother: jest.Mock; send: (...a: unknown[]) => unknown; retry: jest.Mock } = {
  status: 'ready',
  phase: { kind: 'choose' },
  lockedTo: null,
  sendAnother: jest.fn(),
  send: (...a: unknown[]) => mockCatalogueSend(...a), retry: jest.fn() };
jest.mock('../hooks/useCatalogueSend', () => ({ useCatalogueSend: () => mockSendState }));
jest.mock('expo-router', () => ({ router: { back: jest.fn() } }));
let mockBrief: { id: string; name: string; phone: string | null; whatsappOk: boolean } | null = null;
jest.mock('../hooks/useCustomerBrief', () => ({ useCustomerBrief: () => mockBrief }));

beforeEach(() => {
  mockSend.mockReset();
  mockCatalogueSend.mockReset();
  mockSendState.lockedTo = null;
  mockSendState.phase = { kind: 'choose' };
  resetShowroomSessionForTests();
  mockBrief = { id: 'c1', name: 'Mrs Shah', phone: '+919876543210', whatsappOk: true };
});

it('offers "Someone else" outside the Showroom', async () => {
  await renderWithTheme(<CardScreen productId="p1" customerId="c1" />);
  await fireEvent.press(screen.getByTestId('card-someone-else'));
  expect(screen.getByText('Other Customer')).toBeTruthy();
});

it('opened from the Showroom: only the chosen customer, never the customer book', async () => {
  enterShowroom();
  await renderWithTheme(<CardScreen productId="p1" customerId="c1" />);
  expect(screen.queryByTestId('card-someone-else')).toBeNull();
  expect(screen.queryByText('Other Customer')).toBeNull();
  await fireEvent.press(screen.getByTestId('card-send-customer'));
  expect(mockSend).toHaveBeenCalledWith({ kind: 'customer', id: 'c1', name: 'Mrs Shah', phone: '+919876543210' });
});

it('says so and asks first when the customer said no to catalogues', async () => {
  mockBrief = { id: 'c1', name: 'Mrs Shah', phone: '+919876543210', whatsappOk: false };
  await renderWithTheme(<CardScreen productId="p1" customerId="c1" />);
  expect(screen.getByText('Mrs Shah does not want catalogues on WhatsApp.')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('card-send-customer'));
  expect(mockSend).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByTestId('consent-send-anyway'));
  expect(mockSend).toHaveBeenCalledTimes(1);
});

describe('catalogue send step with a preset customer', () => {
  // Rendered in isolation with a stand-in send hook.
  const { SendStep } = jest.requireActual('../components/SendStep') as typeof import('../components/SendStep');

  it('sends straight away when they are OK with catalogues, asks first when they said no', async () => {
    await renderWithTheme(<SendStep toCustomerId="c1" />);
    expect(mockCatalogueSend).toHaveBeenCalledTimes(1);

    mockCatalogueSend.mockClear();
    mockBrief = { id: 'c1', name: 'Mrs Shah', phone: '+919876543210', whatsappOk: false };
    await renderWithTheme(<SendStep toCustomerId="c1" />);
    expect(mockCatalogueSend).not.toHaveBeenCalled();
    expect(screen.getByText('Mrs Shah said no to catalogues')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('consent-send-anyway'));
    expect(mockCatalogueSend).toHaveBeenCalledWith({ kind: 'customer', id: 'c1', name: 'Mrs Shah', phone: '+919876543210' });
  });

  it("their own catalogue is locked to them: no customer book, number or chat; after a cancel only 'Try again'", async () => {
    mockSendState.lockedTo = 'c1';
    await renderWithTheme(<SendStep toCustomerId="c1" />);
    expect(mockCatalogueSend).toHaveBeenCalledTimes(1);
    // WhatsApp dismissed: the phase is back to "choose", but no picker appears.
    expect(screen.queryByText('Other Customer')).toBeNull();
    expect(screen.queryByTestId('recipient-chat')).toBeNull();
    expect(screen.queryByTestId('recipient-type-number')).toBeNull();
    await fireEvent.press(screen.getByText('Try again: send to Mrs Shah'));
    expect(mockCatalogueSend).toHaveBeenLastCalledWith({ kind: 'customer', id: 'c1', name: 'Mrs Shah', phone: '+919876543210' });
  });

  it('their own catalogue, once sent, offers no "Send to another customer"', async () => {
    mockSendState.lockedTo = 'c1';
    mockSendState.phase = { kind: 'done', recipient: { kind: 'customer', id: 'c1', name: 'Mrs Shah', phone: null }, partsSent: 1, totalParts: 1 } as never;
    await renderWithTheme(<SendStep toCustomerId="c1" />);
    expect(screen.getByTestId('done-finish')).toBeTruthy();
    expect(screen.queryByTestId('done-another')).toBeNull();
  });

  it('a plain catalogue still offers the full picker and another customer', async () => {
    await renderWithTheme(<SendStep />);
    expect(screen.getByText('Other Customer')).toBeTruthy();
    expect(screen.getByTestId('recipient-chat')).toBeTruthy();
  });
});
