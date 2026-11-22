import { fireEvent, screen } from '@testing-library/react-native';

import type { CatalogueVersion, CustomerCatalogueRow } from '@/db/repo/customerCatalogue';
import type { CustomerProfile, SuggestedProduct } from '@/db/repo/customerQueries';

import { CustomerProfileScreen } from '../components/CustomerProfileScreen';
import { followUpDueAt } from '../logic/customerLogic';
import { customer, profile, renderScreen, router } from './customersMocks';

jest.mock('react-native-reanimated', () => require('@/ui/components/__tests__/reanimatedMock'));
jest.mock('react-native-keyboard-controller', () => require('react-native-keyboard-controller/jest'));
jest.mock('react-native-gesture-handler', () => require('./customersMocks').gestureHandler);
jest.mock('@expo/ui', () => require('./customersMocks').expoUi);
jest.mock('@expo/ui/community/datetime-picker', () => require('./customersMocks').datePicker);
jest.mock('@/ui/patterns', () => require('./customersMocks').patterns);
jest.mock('@/lib/photos', () => require('./customersMocks').photos);
jest.mock('expo-router', () => ({ router: require('./customersMocks').router, useIsFocused: () => true }));
jest.mock('@/share', () => require('./customersMocks').share);
// `transaction` is hidden from equality so `toHaveBeenCalledWith({}, …)` still matches the db.
jest.mock('@/db/client', () => ({
  db: Object.defineProperty({}, 'transaction', { value: (fn: (tx: unknown) => unknown) => fn({}), enumerable: false }),
}));
jest.mock('@/db/repo/customerCatalogue', () => ({
  addToCustomerCatalogue: jest.fn((_db: unknown, input: { productId: string }) => `item-${input.productId}`),
  removeFromCustomerCatalogue: jest.fn(() => true),
  restoreCustomerCatalogueItem: jest.fn(() => true),
  updateCatalogueItem: jest.fn(),
  reorderCustomerCatalogue: jest.fn(),
}));
jest.mock('@/db/repo/customers', () => ({ updateCustomer: jest.fn(), softDeleteCustomer: jest.fn(), restoreCustomer: jest.fn() }));
jest.mock('@/db/repo/events', () => ({ addNote: jest.fn(() => 'note-1'), deleteEvent: jest.fn(), setFollowUpNotification: jest.fn() }));
jest.mock('@/db/repo/products', () => ({ getProductDetail: jest.fn(() => null) }));
jest.mock('../followUpNotifications', () => ({
  createFollowUp: jest.fn(async () => ({ eventId: 'f1', status: 'scheduled', notificationId: 'n1' })),
  finishFollowUp: jest.fn(async () => undefined),
  undoFinishFollowUp: jest.fn(async () => undefined),
  removeFollowUp: jest.fn(async () => undefined),
  cancelFollowUpNotification: jest.fn(async () => undefined),
  scheduleFollowUpNotification: jest.fn(async () => ({ status: 'scheduled', notificationId: 'n2' })),
}));

const mockData: { profile: CustomerProfile | null; suggestions: SuggestedProduct[]; catalogue: CustomerCatalogueRow[]; versions: CatalogueVersion[] } = {
  profile: null,
  suggestions: [],
  catalogue: [],
  versions: [],
};
jest.mock('@/db/hooks', () => ({
  useCustomerProfile: () => mockData.profile,
  useSuggestedProducts: () => mockData.suggestions,
  useCustomerCatalogue: () => mockData.catalogue,
  useCatalogueVersions: () => mockData.versions,
  useLowStockLevel: () => 1,
  useDbQuery: (fn: (d: unknown) => unknown) => fn({}),
  useToday: () => 0,
}));

const repo = jest.requireMock('@/db/repo/customers') as Record<string, jest.Mock>;
const events = jest.requireMock('@/db/repo/events') as Record<string, jest.Mock>;
const followUps = jest.requireMock('../followUpNotifications') as Record<string, jest.Mock>;

function suggestion(id: string, name: string): SuggestedProduct {
  return {
    id,
    code: 'GTH-1',
    name,
    categoryId: null,
    categoryName: null,
    craft: 'Sozni',
    material: '',
    size: '',
    ratePaise: 650_000,
    oneOfAKind: false,
    isSample: false,
    createdAt: 0,
    totalPieces: 3,
    status: 'in',
    colours: [],
    coverThumb: null,
    coverFile: null,
    score: 3,
    reasons: ['craft', 'colour'],
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockData.profile = profile();
  mockData.suggestions = [];
  mockData.catalogue = [];
  mockData.versions = [];
});

it('shows contact, totals and big WhatsApp / Call buttons', async () => {
  await renderScreen(<CustomerProfileScreen id="c1" />);
  expect(screen.getByText('Anita Kaul')).toBeTruthy();
  expect(screen.getByText('Regular · Srinagar')).toBeTruthy();
  expect(screen.getByText('₹45,000')).toBeTruthy();
  expect(screen.getByText('yesterday')).toBeTruthy();
  expect(screen.getByTestId('customer-whatsapp')).toBeTruthy();
  expect(screen.getByTestId('customer-call')).toBeTruthy();
});

it('offers learned likes and saves them in one tap, with Undo', async () => {
  await renderScreen(<CustomerProfileScreen id="c1" />);
  expect(screen.getByText('Usually buys Sozni')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('learned-accept'));
  expect(repo.updateCustomer).toHaveBeenCalledWith({}, 'c1', { likes: { colours: ['maroon'], crafts: ['Sozni'] } });
  await fireEvent.press(screen.getByText('Undo'));
  expect(repo.updateCustomer).toHaveBeenLastCalledWith({}, 'c1', { likes: { colours: ['maroon'], crafts: [] } });
});

it('sends suggested designs as a catalogue for this customer', async () => {
  mockData.suggestions = [suggestion('p1', 'Maroon Sozni'), suggestion('p2', 'Kani stole')];
  await renderScreen(<CustomerProfileScreen id="c1" />);
  await fireEvent.press(screen.getByTestId('suggested-send'));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/catalogue', params: { customerId: 'c1', productIds: 'p1,p2' } });
  await fireEvent.press(screen.getByTestId('suggested-p2'));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/product/[id]', params: { id: 'p2' } });
});

it('sells to this customer from the thumb-zone footer', async () => {
  await renderScreen(<CustomerProfileScreen id="c1" />);
  await fireEvent.press(screen.getByTestId('customer-sell'));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/sell', params: { customerId: 'c1' } });
});

it('sets a follow-up from a quick chip', async () => {
  await renderScreen(<CustomerProfileScreen id="c1" />);
  await fireEvent.press(screen.getByTestId('follow-up-add'));
  await fireEvent.press(screen.getByTestId('follow-up-choice-tomorrow'));
  await fireEvent.changeText(screen.getByTestId('follow-up-note'), 'New Kani arrived');
  await fireEvent.press(screen.getByTestId('follow-up-save'));
  expect(followUps.createFollowUp).toHaveBeenCalledWith(
    {},
    expect.objectContaining({
      customerId: 'c1',
      note: 'New Kani arrived',
      texts: expect.objectContaining({ title: 'Follow up with Anita Kaul', body: 'New Kani arrived', channelName: 'Customer follow-ups' }),
    }),
  );
  const dueAt = followUps.createFollowUp.mock.calls[0][1].dueAt as number;
  // Same day as "tomorrow at 10:00" computed now (the test may straddle a second, not a day).
  expect(new Date(dueAt).toDateString()).toBe(new Date(followUpDueAt('tomorrow', Date.now())).toDateString());
  expect(await screen.findByText(/Reminder set for/)).toBeTruthy();
});

it('marks an open follow-up done', async () => {
  const fu = { id: 'f1', customerId: 'c1', kind: 'follow_up' as const, refId: null, note: 'Call about wedding', dueAt: Date.now() - 2 * 86_400_000, doneAt: null, notificationId: 'n1', createdAt: 0 };
  mockData.profile = profile({ openFollowUps: [fu] });
  await renderScreen(<CustomerProfileScreen id="c1" />);
  expect(screen.getByText('2 days late')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('follow-up-done-f1'));
  expect(followUps.finishFollowUp).toHaveBeenCalledWith({}, 'f1');
});

it('saves a note with Undo', async () => {
  await renderScreen(<CustomerProfileScreen id="c1" />);
  await fireEvent.press(screen.getByText('Add note'));
  await fireEvent.changeText(screen.getByTestId('note-input'), 'Wants maroon');
  await fireEvent.press(screen.getByTestId('note-save'));
  expect(events.addNote).toHaveBeenCalledWith({}, 'c1', 'Wants maroon');
  await fireEvent.press(screen.getByText('Undo'));
  expect(events.deleteEvent).toHaveBeenCalledWith({}, 'note-1');
});

it('deletes without a dialog, explains sales stay, and Undo restores', async () => {
  const fu = { id: 'f1', customerId: 'c1', kind: 'follow_up' as const, refId: null, note: '', dueAt: Date.now() + 5 * 86_400_000, doneAt: null, notificationId: 'n1', createdAt: 0 };
  mockData.profile = profile({ openFollowUps: [fu] });
  await renderScreen(<CustomerProfileScreen id="c1" />);
  expect(screen.getByText(/Their past sales stay in your totals/)).toBeTruthy();
  await fireEvent.press(screen.getByTestId('customer-delete'));
  expect(repo.softDeleteCustomer).toHaveBeenCalledWith({}, 'c1');
  expect(followUps.cancelFollowUpNotification).toHaveBeenCalledWith('n1');
  expect(router.back).toHaveBeenCalled();
  expect(screen.getByText('Anita Kaul deleted. Sales keep their amounts.')).toBeTruthy();
  await fireEvent.press(screen.getByText('Undo'));
  expect(repo.restoreCustomer).toHaveBeenCalledWith({}, 'c1');
  expect(followUps.scheduleFollowUpNotification).toHaveBeenCalled();
});

it('shows a restore banner for a deleted customer', async () => {
  mockData.profile = profile({ customer: customer({ deletedAt: 1 }) });
  await renderScreen(<CustomerProfileScreen id="c1" />);
  expect(screen.queryByTestId('customer-sell')).toBeNull();
  await fireEvent.press(screen.getByTestId('customer-restore'));
  expect(repo.restoreCustomer).toHaveBeenCalled();
});

it('shows a not-found state', async () => {
  mockData.profile = null;
  await renderScreen(<CustomerProfileScreen id="gone" />);
  expect(screen.getByText('Customer not found')).toBeTruthy();
});

it('without a phone, offers to add one instead of dead buttons', async () => {
  mockData.profile = profile({ customer: customer({ phone: null }) });
  await renderScreen(<CustomerProfileScreen id="c1" />);
  expect(screen.queryByTestId('customer-whatsapp')).toBeNull();
  await fireEvent.press(screen.getByLabelText('Add phone number'));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/customer/[id]/edit', params: { id: 'c1' } });
});

describe('their catalogue', () => {
  const cat = jest.requireMock('@/db/repo/customerCatalogue') as Record<string, jest.Mock>;

  function item(o: Partial<CustomerCatalogueRow> = {}): CustomerCatalogueRow {
    return {
      id: 'i1',
      productId: 'p1',
      code: 'GTH-0001',
      name: 'Maroon Kani',
      craft: 'Kani',
      material: '',
      categoryName: null,
      coverThumb: null,
      coverFile: null,
      normalRatePaise: 1_000_000,
      specialRatePaise: null,
      ratePaise: 1_000_000,
      note: '',
      sortOrder: 0,
      addedAt: 0,
      colours: [],
      totalPieces: 3,
      status: 'in',
      soldOut: false,
      productDeleted: false,
      ...o,
    };
  }

  it('invites adding pieces when empty', async () => {
    await renderScreen(<CustomerProfileScreen id="c1" />);
    expect(screen.getByText(/Save shawls chosen for Anita Kaul here/)).toBeTruthy();
    expect(screen.queryByTestId('their-catalogue-send')).toBeNull();
    await fireEvent.press(screen.getByTestId('their-catalogue-add'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/customer/[id]/add-pieces', params: { id: 'c1' } });
  });

  it('shows the special rate with the normal rate struck through, the note and sold-out pieces', async () => {
    mockData.catalogue = [
      item({ specialRatePaise: 900_000, ratePaise: 900_000, note: 'For the wedding' }),
      item({ id: 'i2', productId: 'p2', name: 'Blue stole', totalPieces: 0, soldOut: true, status: 'out' }),
    ];
    await renderScreen(<CustomerProfileScreen id="c1" />);
    expect(screen.getByTestId('their-item-normal-i1')).toHaveTextContent('₹10,000');
    expect(screen.getByText('₹9,000')).toBeTruthy();
    expect(screen.getByText('10% off')).toBeTruthy();
    expect(screen.getByText('For the wedding')).toBeTruthy();
    expect(screen.getByText(/1 piece is sold out/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('their-catalogue-send'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/catalogue', params: { customerId: 'c1', mode: 'customer' } });
    expect(screen.getByText('Send their catalogue (1 piece)')).toBeTruthy();
  });

  it('edits the special rate and note in a sheet, with Undo', async () => {
    mockData.catalogue = [item()];
    await renderScreen(<CustomerProfileScreen id="c1" />);
    await fireEvent.press(screen.getByTestId('their-item-i1'));
    expect(screen.getByText('Normal rate ₹10,000')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('their-item-rate'), '8500');
    expect(screen.getByText('15% below the normal rate')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('their-item-note'), ' Likes maroon ');
    await fireEvent.press(screen.getByTestId('their-item-save'));
    expect(cat.updateCatalogueItem).toHaveBeenCalledWith({}, 'i1', { specialRatePaise: 850_000, note: 'Likes maroon' });
    expect(screen.queryByTestId('their-item-sheet')).toBeNull();
    await fireEvent.press(screen.getByText('Undo'));
    expect(cat.updateCatalogueItem).toHaveBeenLastCalledWith({}, 'i1', { specialRatePaise: null, note: '' });
  });

  it('arranges with up/down buttons and removes with Undo (no dialog)', async () => {
    mockData.catalogue = [item(), item({ id: 'i2', productId: 'p2', name: 'Blue stole' })];
    await renderScreen(<CustomerProfileScreen id="c1" />);
    await fireEvent.press(screen.getByText('Arrange'));
    expect(screen.getByTestId('their-item-up-i1')).toBeDisabled();
    await fireEvent.press(screen.getByTestId('their-item-down-i1'));
    expect(cat.reorderCustomerCatalogue).toHaveBeenCalledWith({}, 'c1', ['i2', 'i1']);
    await fireEvent.press(screen.getByTestId('their-item-remove-i2'));
    expect(cat.removeFromCustomerCatalogue).toHaveBeenCalledWith({}, 'i2');
    expect(screen.getByText('Blue stole taken out of their catalogue')).toBeTruthy();
    await fireEvent.press(screen.getByText('Undo'));
    expect(cat.restoreCustomerCatalogueItem).toHaveBeenCalledWith({}, 'i2');
  });

  it('lists versions sent and opens the rates offered', async () => {
    mockData.catalogue = [item()];
    mockData.versions = [
      {
        eventId: 'e1',
        sentAt: Date.UTC(2026, 10, 2, 6),
        reportId: 'r1',
        personal: true,
        title: 'Chosen for you',
        productIds: ['p1', 'p2'],
        items: [
          { productId: 'p1', name: 'Maroon Kani', ratePaise: 900_000, specialPrice: true },
          { productId: 'p2', name: 'Blue stole', ratePaise: 500_000, specialPrice: false },
        ],
      },
    ];
    await renderScreen(<CustomerProfileScreen id="c1" />);
    expect(screen.getByText('2 designs · 1 at a special rate')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('their-version-e1'));
    expect(screen.getByTestId('their-version-sheet')).toBeTruthy();
    expect(screen.getByText('Special')).toBeTruthy();
    expect(screen.getByText('₹5,000')).toBeTruthy();
  });

  it('adds a suggestion to their catalogue, and marks ones already in it', async () => {
    mockData.suggestions = [suggestion('p1', 'Maroon Sozni'), suggestion('p2', 'Kani stole')];
    mockData.catalogue = [item({ productId: 'p2', name: 'Kani stole' })];
    await renderScreen(<CustomerProfileScreen id="c1" />);
    expect(screen.queryByTestId('suggested-add-p2')).toBeNull();
    expect(screen.getByLabelText('Kani stole is in their catalogue')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('suggested-add-p1'));
    expect(cat.addToCustomerCatalogue).toHaveBeenCalledWith({}, { customerId: 'c1', productId: 'p1' });
    expect(screen.getByText('Added to Anita Kaul’s catalogue')).toBeTruthy();
    await fireEvent.press(screen.getByText('Undo'));
    expect(cat.removeFromCustomerCatalogue).toHaveBeenCalledWith({}, 'item-p1');
  });
});
