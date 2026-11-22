import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text, View } from 'react-native';

import { ToastProvider } from '@/ui/components';
import { renderWithTheme } from '@/ui/components/__tests__/renderWithTheme';

import { useCatalogueSend } from '../hooks/useCatalogueSend';
import { DEFAULT_FORM } from '../logic/options';
import type { Recipient } from '../logic/recipient';

jest.mock('react-native-keyboard-controller', () => require('react-native-keyboard-controller/jest'));
jest.mock('@/ui/components/Toast', () => require('./catalogueMocks').makeToastModule());
jest.mock('@/db/client', () => ({ db: {} }));
jest.mock('@/db/hooks', () => ({ useDbQuery: () => ({ shopName: 'Kashmir Looms' }) }));
jest.mock('../hooks/useCatalogueOptions', () => ({ useLoadedForm: () => require('../logic/options').DEFAULT_FORM }));

const item = (id: string) => ({
  id,
  code: id,
  name: `Shawl ${id}`,
  categoryName: null,
  craft: 'Kani',
  material: '',
  size: '',
  ratePaise: 100_000,
  totalPieces: null,
  availability: { kind: 'available' },
  colours: [],
  cover: null,
  photoFileNames: [],
});
const mockPrepared = {
  key: 'k',
  data: {
    shop: { shopName: 'Kashmir Looms', sellerName: '', sellerCode: '', phone: '', address: '', upiId: '', ownerWhatsapp: '' },
    generatedAt: 0,
    options: { hideSoldOut: true, showRates: true, showCounts: false },
    products: [item('a'), item('b'), item('c')],
  },
  photos: new Map(),
  fontCss: '',
  fallbackTitle: '',
};
jest.mock('../hooks/useCataloguePreview', () => ({ usePrepared: () => ({ prepared: mockPrepared, status: 'ready', retry: jest.fn() }) }));
jest.mock('../logic/parts', () => {
  const actual = jest.requireActual('../logic/parts');
  // Two items per part so the multi-part path is exercised with three items.
  return { ...actual, catalogueParts: (d: unknown, f: unknown, e: unknown, p: unknown) => actual.catalogueParts(d, f, e, p, 2) };
});
const mockRender = jest.fn(async () => ({ uri: 'file:///cache/exports/c.pdf', sizeBytes: 1, pages: 3 }));
jest.mock('@/pdf', () => ({
  renderPdf: (...a: unknown[]) => mockRender(...(a as [])),
  renderCatalogueHtml: () => '<html></html>',
  catalogueMessage: (doc: { customerName?: string | null }) => `Namaste ${doc.customerName ?? ''}`,
  catalogueFileBaseName: () => 'Catalogue - Kashmir Looms',
}));
const mockShare = jest.fn();
jest.mock('@/share', () => ({ shareFileToWhatsApp: (...a: unknown[]) => mockShare(...a) }));
const mockRecord = jest.fn();
jest.mock('../logic/record', () => ({ recordCatalogueSent: (...a: unknown[]) => mockRecord(...a) }));

const shah: Recipient = { kind: 'customer', id: 'c1', name: 'Mrs Shah', phone: '+919876543210' };

function Harness() {
  const s = useCatalogueSend();
  return (
    <View>
      <Text testID="phase">{s.phase.kind === 'done' ? `done ${s.phase.partsSent}/${s.phase.totalParts}` : s.phase.kind}</Text>
      <Pressable testID="send-shah" onPress={() => void s.send(shah)} />
      <Pressable testID="send-chat" onPress={() => void s.send({ kind: 'chat' })} />
      <Pressable testID="next-part" onPress={s.sendNextPart} />
    </View>
  );
}

async function renderHarness() {
  await renderWithTheme(
    <ToastProvider>
      <Harness />
    </ToastProvider>,
  );
}

beforeEach(() => {
  mockShare.mockReset();
  mockRecord.mockReset();
  mockRender.mockClear();
});

it('greets the customer by name, opens their chat and logs the send once for all parts', async () => {
  mockShare.mockResolvedValue({ status: 'sent' });
  await renderHarness();
  await fireEvent.press(screen.getByTestId('send-shah'));
  await waitFor(() => expect(screen.getByTestId('phase')).toHaveTextContent('done 1/2'));
  expect(mockShare).toHaveBeenCalledWith(
    expect.objectContaining({ fileUri: 'file:///cache/exports/c.pdf', mimeType: 'application/pdf', phoneE164: '+919876543210', message: 'Namaste Mrs Shah' }),
  );
  expect(mockRecord).toHaveBeenCalledTimes(1);
  expect(mockRecord.mock.calls[0][1]).toMatchObject({ customerId: 'c1', productIds: ['a', 'b', 'c'], parts: 2 });

  await fireEvent.press(screen.getByTestId('next-part'));
  await waitFor(() => expect(screen.getByTestId('phase')).toHaveTextContent('done 2/2'));
  expect(mockShare).toHaveBeenCalledTimes(2);
  expect(mockRecord).toHaveBeenCalledTimes(1);
});

it('stays on the picker and says so when the seller backs out of WhatsApp', async () => {
  mockShare.mockResolvedValue({ status: 'dismissed' });
  await renderHarness();
  await fireEvent.press(screen.getByTestId('send-chat'));
  await waitFor(() => expect(screen.getByText('Not sent. Choose someone to try again.')).toBeTruthy());
  expect(screen.getByTestId('phase')).toHaveTextContent('choose');
  expect(mockRecord).not.toHaveBeenCalled();
});

it('counts the share sheet fallback as sent, without a timeline customer for a chosen chat', async () => {
  mockShare.mockResolvedValue({ status: 'fallback_shared' });
  await renderHarness();
  await fireEvent.press(screen.getByTestId('send-chat'));
  await waitFor(() => expect(screen.getByTestId('phase')).toHaveTextContent('done 1/2'));
  expect(mockRecord.mock.calls[0][1]).toMatchObject({ customerId: null });
  expect(mockShare.mock.calls[0][0].phoneE164).toBeNull();
});

it('explains a PDF that could not be made', async () => {
  mockRender.mockRejectedValueOnce(new Error('print failed'));
  await renderHarness();
  await fireEvent.press(screen.getByTestId('send-shah'));
  await waitFor(() => expect(screen.getByText('Could not make the PDF. Try again.')).toBeTruthy());
  expect(mockShare).not.toHaveBeenCalled();
  expect(DEFAULT_FORM.showRates).toBe(true);
});
