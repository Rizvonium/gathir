import 'react-native-gesture-handler/jestSetup';

import { act, fireEvent, screen } from '@testing-library/react-native';
import { useEffect, useState } from 'react';

import { StockError } from '@/db/stock';
import { ToastProvider } from '@/ui/components';
import { renderWithTheme } from '@/ui/components/__tests__/renderWithTheme';

import { useProfitPrivacy } from '@/features/profit/privacy';

import { SellScreen } from '../components/SellScreen';
import type { SellParams } from '../hooks/useSellSheet';

jest.mock('react-native-keyboard-controller', () => require('react-native-keyboard-controller/jest'));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@expo/ui', () => require('./salesMocks').expoUi);
jest.mock('@/ui/components/Toast', () => require('./salesMocks').makeToastModule());
jest.mock('@/lib/photos', () => ({ thumbUri: (n: string) => `file:///thumbs/${n}` }));
jest.mock('@/ui/patterns', () => {
  const { useEffect } = require('react');
  const { View } = require('react-native');
  return {
    ...require('./salesMocks').patterns,
    ChinarLeaves: ({ onDone }: { onDone?: () => void }) => {
      useEffect(() => {
        onDone?.();
      }, [onDone]);
      return <View testID="leaves" />;
    },
  };
});

// ---- data layer stand-ins ----
type Col = { id: string; name: string; hex: string; pieces: number };
const products: Record<string, { name: string; ratePaise: number; costPaise?: number; colours: Col[] }> = {
  p1: { name: 'Sozni stole', ratePaise: 650_000, costPaise: 400_000, colours: [{ id: 'red', name: 'Red', hex: '#C0262D', pieces: 3 }, { id: 'beige', name: 'Beige', hex: '#D8C3A5', pieces: 0 }] },
  p2: { name: 'Kani shawl', ratePaise: 4_500_000, colours: [{ id: 'blue', name: 'Blue', hex: '#1F3A93', pieces: 2 }, { id: 'grey', name: 'Grey', hex: '#888888', pieces: 1 }] },
};
jest.mock('@/db/client', () => ({ db: {} }));
jest.mock('@/db/hooks', () => ({
  useDbQuery: (fn: (d: unknown) => unknown) => fn({}),
  useLowStockLevel: () => 1,
  useToday: () => 0,
  useProducts: () =>
    Object.entries(products).map(([id, p]) => ({ id, name: p.name, ratePaise: p.ratePaise, coverThumb: null, colours: p.colours, totalPieces: p.colours.reduce((n, c) => n + c.pieces, 0) })),
}));
jest.mock('@/db/repo/productQueries', () => ({
  getProductDetail: (_d: unknown, id: string) => {
    const p = products[id];
    return p ? { product: { id, name: p.name, ratePaise: p.ratePaise, deletedAt: null, costPaise: p.costPaise ?? null }, colours: p.colours, photos: [] } : null;
  },
}));
jest.mock('@/db/repo/saleQueries', () => ({ listSales: () => [] }));
jest.mock('@/db/repo/customerQueries', () => ({
  getCustomerProfile: (_d: unknown, id: string) => (id === 'c1' ? { customer: { id: 'c1', name: 'Anita Kaul', phone: '+919906000104', deletedAt: null } } : null),
}));
const mockCreateSale = jest.fn();
const mockCancelSale = jest.fn(() => true);
const mockVoidSale = jest.fn((..._a: unknown[]) => undefined);
jest.mock('@/db/repo/saleWrites', () => ({
  createSale: (...a: unknown[]) => mockCreateSale(...a),
  cancelSale: (...a: unknown[]) => mockCancelSale(...(a as [])),
  voidSale: (...a: unknown[]) => mockVoidSale(...a),
}));
jest.mock('@/pdf', () => ({ getPdfFontCss: jest.fn(), renderPdf: jest.fn() }));
jest.mock('@/share', () => ({ shareFileToWhatsApp: jest.fn() }));
jest.mock('../hooks/useCustomerPicker', () => ({ useCustomerPicker: () => ({ results: [], findSavedByPhone: () => null }) }));
jest.mock('../logic/pickContact', () => ({ pickContact: jest.fn() }));
const mockSendBill = jest.fn();
jest.mock('../logic/sendBill', () => ({ sendBill: (...a: unknown[]) => mockSendBill(...a) }));

let mockClose: () => void = () => undefined;
const mockBack = jest.fn(() => mockClose());
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { back: () => mockBack(), canGoBack: () => true, push: (...a: unknown[]) => mockPush(...a), replace: jest.fn() } }));

function Harness({ params }: { params: SellParams }) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    mockClose = () => setOpen(false);
  }, []);
  return <ToastProvider>{open ? <SellScreen params={params} /> : null}</ToastProvider>;
}

beforeEach(() => {
  mockCreateSale.mockReset();
  mockCancelSale.mockClear();
  mockVoidSale.mockReset();
  mockBack.mockClear();
  useProfitPrivacy.getState().setHidden(false);
});

describe('Sell sheet', () => {
  it('from product detail: one tap on "Sell · ₹6,500" records the sale, celebrates, closes and offers Undo', async () => {
    mockCreateSale.mockReturnValue({ saleId: 's1', billNo: 'B-2026-0001', totalPaise: 650_000, customerId: null });
    await renderWithTheme(<Harness params={{ productId: 'p1' }} />);
    // Only Red has pieces: it is pre-picked; Beige is disabled.
    expect(screen.getByLabelText('Red · 3 left')).toBeChecked();
    expect(screen.getByLabelText('Beige · sold out')).toBeDisabled();
    await fireEvent.press(screen.getByText('Sell · ₹6,500'));
    expect(mockCreateSale).toHaveBeenCalledWith({}, { items: [{ colourId: 'red', qty: 1, ratePaise: 650_000 }], payment: 'cash', discountPaise: 0 });
    expect(mockBack).toHaveBeenCalled();
    expect(screen.getByText('Sold 1 · Sozni stole (Red) · ₹6,500')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Undo'));
    // A true void: the sale disappears (no "returned" entry), not a return.
    expect(mockVoidSale).toHaveBeenCalledWith({}, 's1');
    expect(mockCancelSale).not.toHaveBeenCalled();
    expect(screen.getByText('Sale undone. Pieces are back in stock.')).toBeTruthy();
  });

  it('a walk-in sale offers "Send bill" on the toast (share sheet, no number)', async () => {
    mockCreateSale.mockReturnValue({ saleId: 's7', billNo: 'B-2026-0007', totalPaise: 650_000, customerId: null });
    mockSendBill.mockResolvedValue({ status: 'fallback_shared', hadPhone: false });
    await renderWithTheme(<Harness params={{ productId: 'p1' }} />);
    await fireEvent.press(screen.getByText('Sell · ₹6,500'));
    expect(mockBack).toHaveBeenCalled();
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Send bill'));
    });
    expect(mockSendBill).toHaveBeenCalledWith({}, 's7', expect.anything());
  });

  it('starts on the quantity picked in the reduce sheet ("Sold" for 2)', async () => {
    mockCreateSale.mockReturnValue({ saleId: 's8', billNo: 'B', totalPaise: 1_300_000, customerId: null });
    await renderWithTheme(<Harness params={{ productId: 'p1', colourId: 'red', qty: 2 }} />);
    await fireEvent.press(screen.getByTestId('sell-submit'));
    expect(mockCreateSale.mock.calls[0][1]).toMatchObject({ items: [{ colourId: 'red', qty: 2, ratePaise: 650_000 }] });
  });

  it('Undo falls back to a return when the sale can no longer be voided', async () => {
    mockCreateSale.mockReturnValue({ saleId: 's9', billNo: 'B-2026-0009', totalPaise: 650_000, customerId: null });
    mockVoidSale.mockImplementation(() => {
      throw new Error('too late');
    });
    await renderWithTheme(<Harness params={{ productId: 'p1' }} />);
    await fireEvent.press(screen.getByText('Sell · ₹6,500'));
    await fireEvent.press(screen.getByLabelText('Undo'));
    expect(mockCancelSale).toHaveBeenCalledWith({}, 's9');
    expect(screen.getByText('Sale undone. Pieces are back in stock.')).toBeTruthy();
  });

  it('picks a product, asks for a colour, bargains the rate, pays by UPI', async () => {
    mockCreateSale.mockReturnValue({ saleId: 's2', billNo: 'B-2026-0002', totalPaise: 8_000_000, customerId: null });
    await renderWithTheme(<Harness params={{}} />);
    await fireEvent.press(screen.getByTestId('sell-product-p2'));
    expect(screen.getByText('Pick a colour first')).toBeTruthy();
    expect(screen.getByTestId('sell-submit')).toBeDisabled();
    await fireEvent.press(screen.getByLabelText('Blue · 2 left'));
    await fireEvent.press(screen.getByTestId('sell-qty-inc'));
    await fireEvent.changeText(screen.getByLabelText('Rate for one piece'), '40000');
    expect(screen.getByText('Usual rate ₹45,000. Change it if you agreed another price.')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('UPI'));
    await fireEvent.press(screen.getByText('Sell · ₹80,000'));
    expect(mockCreateSale).toHaveBeenCalledWith({}, { items: [{ colourId: 'blue', qty: 2, ratePaise: 4_000_000 }], payment: 'upi', discountPaise: 0 });
  });

  it('sells two items in one bill with a discount', async () => {
    mockCreateSale.mockReturnValue({ saleId: 's3', billNo: 'B', totalPaise: 1, customerId: null });
    await renderWithTheme(<Harness params={{ productId: 'p1' }} />);
    await fireEvent.press(screen.getByTestId('sell-add-another'));
    expect(screen.getByText('Sozni stole (Red) × 1')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('sell-product-p2'));
    await fireEvent.press(screen.getByLabelText('Grey · 1 left'));
    await fireEvent.press(screen.getByTestId('sell-show-more'));
    await fireEvent.changeText(screen.getByLabelText('Discount on the bill'), '1500');
    await fireEvent.press(screen.getByText('Sell · ₹50,000'));
    expect(mockCreateSale).toHaveBeenCalledWith(
      {},
      {
        items: [
          { colourId: 'red', qty: 1, ratePaise: 650_000 },
          { colourId: 'grey', qty: 1, ratePaise: 4_500_000 },
        ],
        payment: 'cash',
        discountPaise: 150_000,
      },
    );
  });

  it('shows a plain message when stock ran out, and keeps the sheet open', async () => {
    mockCreateSale.mockImplementation(() => {
      throw new StockError('Not enough pieces', 'insufficient');
    });
    await renderWithTheme(<Harness params={{ productId: 'p1' }} />);
    await fireEvent.press(screen.getByTestId('sell-submit'));
    expect(screen.getByText('Not enough pieces left. Someone may have sold one just now; check the count.')).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('with a customer the sheet stays on the done panel to send the bill', async () => {
    mockCreateSale.mockReturnValue({ saleId: 's4', billNo: 'B', totalPaise: 650_000, customerId: 'c1' });
    await renderWithTheme(<Harness params={{ productId: 'p1', customerId: 'c1' }} />);
    expect(screen.getByLabelText('Customer: Anita Kaul')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('sell-submit'));
    expect(mockCreateSale.mock.calls[0][1]).toMatchObject({ customerId: 'c1' });
    expect(screen.getByTestId('sell-send-bill')).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.press(screen.getByTestId('sell-done-close'));
    });
    expect(mockBack).toHaveBeenCalled();
    expect(screen.getByText('Sold 1 · Sozni stole (Red) · ₹6,500')).toBeTruthy();
  });

  it('shows the seller the profit on this sale, warns below the buying price and hides on the eye', async () => {
    await renderWithTheme(<Harness params={{ productId: 'p1' }} />);
    expect(screen.getByTestId('sell-profit-text')).toHaveTextContent('Profit on this sale ₹2,500 (38.5%)');
    expect(screen.queryByTestId('sell-profit-warning')).toBeNull();
    await fireEvent.changeText(screen.getByLabelText('Rate for one piece'), '3000');
    expect(screen.getByTestId('sell-profit-warning')).toHaveTextContent('Below buying price');
    expect(screen.getByTestId('sell-profit-text')).toHaveTextContent('Profit on this sale −₹1,000 (−33.3%)');
    await fireEvent.press(screen.getByLabelText('Hide profit figures'));
    expect(screen.getByTestId('sell-profit-text')).toHaveTextContent('Profit on this sale ••••');
    expect(screen.queryByTestId('sell-profit-warning')).toBeNull();
    expect(screen.queryByText(/₹1,000/)).toBeNull();
  });

  it('says "profit unknown" for a design without a buying price (never 100 %)', async () => {
    await renderWithTheme(<Harness params={{ productId: 'p2', colourId: 'blue' }} />);
    expect(screen.getByTestId('sell-profit-text')).toHaveTextContent('Profit unknown: no buying price saved for this design.');
  });
});
