import 'react-native-gesture-handler/jestSetup';

import { fireEvent, screen } from '@testing-library/react-native';

import { ToastProvider } from '@/ui/components';
import { renderWithTheme } from '@/ui/components/__tests__/renderWithTheme';

import { OptionsStep } from '../components/OptionsStep';
import { RecipientPicker } from '../components/RecipientPicker';
import { SendDone } from '../components/SendStep';
import { SourceStep } from '../components/SourceStep';
import { DEFAULT_FORM } from '../logic/options';
import { useCatalogueFlow } from '../store';

jest.mock('react-native-keyboard-controller', () => require('react-native-keyboard-controller/jest'));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@shopify/flash-list', () => require('./catalogueMocks').flashList);
jest.mock('@expo/ui', () => require('./catalogueMocks').expoUi);
jest.mock('@/ui/patterns', () => require('./catalogueMocks').patterns);
jest.mock('@/ui/components/Toast', () => require('./catalogueMocks').makeToastModule());
jest.mock('@/lib/photos', () => ({ thumbUri: (n: string) => `file:///t/${n}`, photoUri: (n: string) => `file:///p/${n}` }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useNavigation: () => ({ getParent: () => ({ canGoBack: () => true, goBack: jest.fn() }) }),
}));

const mockProducts = [
  require('./catalogueMocks').product('p1'),
  require('./catalogueMocks').product('p2', { categoryId: 'cat2' }),
  require('./catalogueMocks').product('p3', { totalPieces: 0, colours: [] }),
];
const mockCustomers = [
  { id: 'c1', name: 'Mrs Shah', phone: '+919876543210', city: 'Srinagar' },
  { id: 'c2', name: 'Rafiq Dar', phone: null, city: '' },
];
const mockSettings = { catalogueOptionsJson: JSON.stringify({ title: 'Winter collection', showRates: true }), catalogueStyle: 'bazaar' };
jest.mock('@/db/client', () => ({ db: {} }));
jest.mock('@/share', () => ({ shareFileToWhatsApp: jest.fn() }));
jest.mock('@/pdf', () => ({ ...jest.requireActual('@/pdf/size'), renderPdf: jest.fn(), getPdfFontCss: jest.fn() }));
jest.mock('@/db/repo/reports', () => ({ buildCatalogueData: jest.fn() }));
jest.mock('../logic/record', () => ({ recordCatalogueSent: jest.fn() }));
jest.mock('@/db/hooks', () => ({
  useDbQuery: () => ({ shopName: 'Kashmir Looms' }),
  useProducts: () => mockProducts,
  useCategories: () => [
    { id: 'cat1', name: 'Shawls' },
    { id: 'cat2', name: 'Stoles' },
  ],
  useSuggestedProducts: (id?: string) => (id ? [mockProducts[1]] : []),
  useLowStockLevel: () => 1,
  useSettings: () => mockSettings,
  useCustomers: ({ search }: { search?: string }) => mockCustomers.filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase())),
}));
jest.mock('../hooks/useCustomerBrief', () => ({
  useCustomerBrief: (id?: string | null) => (id === 'c1' ? { id: 'c1', name: 'Mrs Shah', phone: '+919876543210' } : null),
}));
const mockUpdateSettings = jest.fn();
jest.mock('@/db/repo/settings', () => ({ updateSettings: (...a: unknown[]) => mockUpdateSettings(...a) }));

const { router } = jest.requireMock('expo-router') as { router: { push: jest.Mock } };

beforeEach(() => {
  router.push.mockClear();
  mockUpdateSettings.mockClear();
});

describe('Step 1: what to send', () => {
  it('starts with the shawls from the link and counts picks as they change', async () => {
    useCatalogueFlow.getState().start({ productIds: 'p1' });
    await renderWithTheme(<SourceStep />);
    expect(screen.getByText('Next: 1 design')).toBeTruthy();
    expect(screen.getByTestId('pick-p1')).toBeChecked();
    await fireEvent.press(screen.getByTestId('pick-p2'));
    expect(screen.getByText('Next: 2 designs')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('source-next'));
    expect(router.push).toHaveBeenCalledWith('/catalogue/options');
    expect(useCatalogueFlow.getState().source.productIds).toEqual(['p1', 'p2']);
  });

  it('counts only shawls in stock for "All in stock" and offers suggestions for the customer', async () => {
    useCatalogueFlow.getState().start({ customerId: 'c1' });
    await renderWithTheme(<SourceStep />);
    expect(screen.getByLabelText('For Mrs Shah')).toBeTruthy();
    expect(screen.getByText('Next: 1 design')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('All in stock'));
    expect(screen.getByText('Next: 2 designs')).toBeTruthy();
  });

  it('blocks Next until something is picked', async () => {
    useCatalogueFlow.getState().start({});
    await renderWithTheme(<SourceStep />);
    await fireEvent.press(screen.getByLabelText('Pick shawls'));
    expect(screen.getByText('Choose what to send')).toBeTruthy();
    expect(screen.getByTestId('source-next')).toBeDisabled();
  });
});

describe('Step 2: options', () => {
  it('loads the remembered options, edits them and remembers all but the note', async () => {
    useCatalogueFlow.getState().start({});
    await renderWithTheme(<OptionsStep />);
    expect(screen.getByDisplayValue('Winter collection')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('opt-rates'));
    expect(useCatalogueFlow.getState().form?.showRates).toBe(false);
    expect(screen.getByText('Turn on rates to print a date.')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('style-ivory'));
    await fireEvent.changeText(screen.getByLabelText('Personal note'), 'For your daughter’s wedding');
    await fireEvent.press(screen.getByTestId('options-preview'));
    const stored = JSON.parse(mockUpdateSettings.mock.calls[0][1].catalogueOptionsJson);
    expect(stored).toMatchObject({ style: 'ivory', showRates: false, title: 'Winter collection' });
    expect(stored.personalNote).toBeUndefined();
    expect(mockUpdateSettings.mock.calls[0][1].catalogueStyle).toBe('ivory');
    expect(router.push).toHaveBeenCalledWith('/catalogue/preview');
  });
});

describe('Recipient picker', () => {
  it('sends to a saved customer in one tap, to a typed number, or to a chat', async () => {
    const onPick = jest.fn();
    await renderWithTheme(<RecipientPicker onPick={onPick} />);
    await fireEvent.press(screen.getByTestId('recipient-c1'));
    expect(onPick).toHaveBeenLastCalledWith({ kind: 'customer', id: 'c1', name: 'Mrs Shah', phone: '+919876543210' });
    expect(screen.getByText(/No number saved/)).toBeTruthy();

    await fireEvent.press(screen.getByTestId('recipient-type-number'));
    expect(screen.getByTestId('recipient-send-number')).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('WhatsApp number'), '98765 43210');
    await fireEvent.press(screen.getByTestId('recipient-send-number'));
    expect(onPick).toHaveBeenLastCalledWith({ kind: 'number', phone: '+919876543210' });

    await fireEvent.press(screen.getByTestId('recipient-chat'));
    expect(onPick).toHaveBeenLastCalledWith({ kind: 'chat' });
  });

  it('filters customers and explains an empty search', async () => {
    await renderWithTheme(<RecipientPicker onPick={jest.fn()} />);
    await fireEvent.changeText(screen.getByLabelText('Find a customer'), 'zz');
    expect(screen.getByText('No customer called “zz”.')).toBeTruthy();
  });
});

describe('Sent', () => {
  it('offers the next part first, then another customer', async () => {
    const onNextPart = jest.fn();
    const onAnother = jest.fn();
    await renderWithTheme(
      <ToastProvider>
        <SendDone phase={{ kind: 'done', recipient: { kind: 'customer', id: 'c1', name: 'Mrs Shah', phone: null }, partsSent: 1, totalParts: 2 }} onNextPart={onNextPart} onAnother={onAnother} onFinish={jest.fn()} />
      </ToastProvider>,
    );
    expect(screen.getByText('Sent to Mrs Shah')).toBeTruthy();
    expect(screen.getByText('Saved on Mrs Shah’s page.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Send part 2 of 2'));
    expect(onNextPart).toHaveBeenCalled();
    await fireEvent.press(screen.getByText('Send to another customer'));
    expect(onAnother).toHaveBeenCalled();
  });
});

it('keeps defaults sane', () => {
  expect(DEFAULT_FORM.hideSoldOut).toBe(true);
});
