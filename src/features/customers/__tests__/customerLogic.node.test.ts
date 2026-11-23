import {
  acceptSuggestion,
  atReminderHour,
  avatarTint,
  budgetPresetOf,
  dayDiff,
  draftChanged,
  draftToInput,
  emptyDraft,
  followUpDue,
  followUpDueAt,
  learnedSuggestion,
  likesEmpty,
  OPEN_MAX_PAISE,
  relativePast,
  safeReturnTo,
  suggestionKey,
  swatchHex,
  swatchName,
  toggleColour,
  toggleCraft,
  validateDraft,
  withBudget,
} from '../logic/customerLogic';
import { referencedProductIds, timelineRows } from '../logic/timeline';
import { catalogueHref, customerListSeed, dueCustomersHref, newCustomerHref } from '../logic/links';

const NOW = new Date(2026, 10, 22, 15, 30).getTime(); // Sun 22 Nov 2026, 3:30 pm
const day = (d: number, h = 12) => new Date(2026, 10, d, h).getTime();

describe('relative dates', () => {
  it('counts calendar days, not 24h blocks', () => {
    expect(dayDiff(new Date(2026, 10, 21, 23, 59).getTime(), NOW)).toBe(-1);
    expect(dayDiff(day(23, 0), NOW)).toBe(1);
  });

  it('labels the past', () => {
    expect(relativePast(day(22, 9), NOW)).toEqual({ key: 'relative.today' });
    expect(relativePast(day(21), NOW)).toEqual({ key: 'relative.yesterday' });
    expect(relativePast(day(12), NOW)).toEqual({ key: 'relative.daysAgo', count: 10 });
    expect(relativePast(new Date(2026, 7, 20).getTime(), NOW)).toEqual({ key: 'relative.monthsAgo', count: 3 });
    expect(relativePast(new Date(2025, 5, 1).getTime(), NOW)).toEqual({ key: 'relative.overYear' });
  });

  it('labels follow-ups', () => {
    expect(followUpDue(day(20), NOW)).toMatchObject({ key: 'followUp.late', count: 2, overdue: true, due: true });
    expect(followUpDue(day(22, 10), NOW)).toMatchObject({ key: 'followUp.dueToday', due: true, overdue: false });
    expect(followUpDue(day(23), NOW)).toMatchObject({ key: 'followUp.dueTomorrow', due: false });
    expect(followUpDue(day(27), NOW)).toMatchObject({ key: 'followUp.dueIn', count: 5 });
  });
});

describe('follow-up dates', () => {
  it('lands quick choices at 10:00 local', () => {
    expect(new Date(followUpDueAt('tomorrow', NOW))).toEqual(new Date(2026, 10, 23, 10, 0));
    expect(new Date(followUpDueAt('days3', NOW))).toEqual(new Date(2026, 10, 25, 10, 0));
    expect(new Date(followUpDueAt('week1', NOW))).toEqual(new Date(2026, 10, 29, 10, 0));
    expect(new Date(followUpDueAt('weeks2', NOW))).toEqual(new Date(2026, 11, 6, 10, 0));
    expect(new Date(followUpDueAt('month1', NOW))).toEqual(new Date(2026, 11, 22, 10, 0));
  });

  it('clamps "1 month" at month ends and crosses years', () => {
    expect(new Date(followUpDueAt('month1', new Date(2027, 0, 31, 9).getTime()))).toEqual(new Date(2027, 1, 28, 10, 0));
    expect(new Date(followUpDueAt('month1', new Date(2026, 11, 15).getTime()))).toEqual(new Date(2027, 0, 15, 10, 0));
  });

  it('atReminderHour keeps the day', () => {
    expect(new Date(atReminderHour(day(30, 22)))).toEqual(new Date(2026, 10, 30, 10, 0));
  });
});

describe('avatar tint', () => {
  const accents = ['#111111', '#222222', '#333333'];
  it('uses the favourite swatch, else a stable accent', () => {
    expect(avatarTint('a', 'maroon', accents)).toBe('#6D1A24');
    const fallback = avatarTint('cust-1', 'multi', accents);
    expect(accents).toContain(fallback);
    expect(avatarTint('cust-1', null, accents)).toBe(fallback);
    expect(avatarTint('cust-1', 'not-a-colour', accents)).toBe(fallback);
  });
  it('names swatches', () => {
    expect(swatchName('rani')).toBe('Rani pink');
    expect(swatchName('saffron')).toBe('Saffron');
    expect(swatchHex('multi')).toBeNull();
  });
});

describe('likes', () => {
  const base = { colours: ['maroon'], crafts: ['Sozni'] };

  it('toggles case-insensitively and keeps order', () => {
    expect(toggleCraft(base, 'sozni').crafts).toEqual([]);
    expect(toggleCraft(base, 'Kani').crafts).toEqual(['Sozni', 'Kani']);
    expect(toggleColour(base, 'red').colours).toEqual(['maroon', 'red']);
    expect(toggleColour(base, 'maroon').colours).toEqual([]);
  });

  it('sets and clears budgets, recognising presets', () => {
    const b = withBudget(base, 500_000, 1_000_000);
    expect(budgetPresetOf(b)?.key).toBe('from5to10');
    expect(budgetPresetOf(withBudget(base, 1, 2))).toBeNull();
    const cleared = withBudget(b, null, null);
    expect(cleared.budgetMinPaise).toBeUndefined();
    expect(likesEmpty({ colours: [], crafts: [] })).toBe(true);
    expect(likesEmpty(withBudget({ colours: [], crafts: [] }, 0, OPEN_MAX_PAISE))).toBe(false);
  });

  it('suggests only what purchases taught that is not saved yet', () => {
    const learned = { crafts: ['Sozni', 'Kani'], colours: ['maroon', 'beige'], budgetMinPaise: 500_000, budgetMaxPaise: 800_000 };
    const s = learnedSuggestion(base, learned);
    expect(s).toEqual({ crafts: ['Kani'], colours: ['beige'], budget: { minPaise: 500_000, maxPaise: 800_000 } });
    const accepted = acceptSuggestion(base, s!);
    expect(accepted).toEqual({ colours: ['maroon', 'beige'], crafts: ['Sozni', 'Kani'], budgetMinPaise: 500_000, budgetMaxPaise: 800_000 });
    expect(learnedSuggestion(accepted, learned)).toBeNull();
    expect(learnedSuggestion(base, { crafts: [], colours: [], budgetMinPaise: null, budgetMaxPaise: null })).toBeNull();
    expect(suggestionKey(s!)).not.toBe(suggestionKey({ ...s!, crafts: [] }));
  });

  it('never overwrites a budget the seller set', () => {
    const own = withBudget(base, 2_500_000, OPEN_MAX_PAISE);
    const s = learnedSuggestion(own, { crafts: ['Kani'], colours: [], budgetMinPaise: 1, budgetMaxPaise: 2 });
    expect(s?.budget).toBeNull();
    expect(acceptSuggestion(own, s!).budgetMinPaise).toBe(2_500_000);
  });
});

describe('form draft', () => {
  it('validates name and half-typed phones', () => {
    const d = emptyDraft({ name: '  Anita  ' });
    expect(d.name).toBe('Anita');
    expect(validateDraft(d)).toEqual({});
    expect(validateDraft({ ...d, name: ' ' })).toEqual({ name: 'required' });
    expect(validateDraft({ ...d, phoneText: '98765', phone: '' })).toEqual({ phone: 'invalid' });
  });

  it('maps to repo input and detects changes', () => {
    const d = { ...emptyDraft(), name: ' Rafiq ', city: ' Srinagar ', phone: '+919876543210' };
    expect(draftToInput(d)).toMatchObject({ name: 'Rafiq', city: 'Srinagar', phone: '+919876543210', tag: 'regular', whatsappOk: true });
    expect(draftChanged(d, { ...d })).toBe(false);
    expect(draftChanged(d, { ...d, tag: 'tourist' })).toBe(true);
    expect(draftToInput(emptyDraft()).phone).toBeNull();
  });

  it('accepts only in-app returnTo paths', () => {
    expect(safeReturnTo('/sell')).toBe('/sell');
    expect(safeReturnTo('//evil.com')).toBeNull();
    expect(safeReturnTo('https://x.y/')).toBeNull();
    expect(safeReturnTo('sell')).toBeNull();
    expect(safeReturnTo(undefined)).toBeNull();
  });
});

describe('links', () => {
  it('builds contract routes without empty params', () => {
    expect(newCustomerHref({ name: 'Anita', phone: null })).toEqual({ pathname: '/customer/new', params: { name: 'Anita' } });
    expect(newCustomerHref()).toBe('/customer/new');
    expect(catalogueHref('c1', ['a', 'b'])).toEqual({ pathname: '/catalogue', params: { customerId: 'c1', productIds: 'a,b' } });
    expect(catalogueHref('c1')).toEqual({ pathname: '/catalogue', params: { customerId: 'c1' } });
  });
});

describe('timeline rows', () => {
  const ev = (o: Partial<import('@/db/schema').CustomerEvent>) => ({
    id: 'e',
    customerId: 'c',
    kind: 'note' as const,
    refId: null,
    note: '',
    dueAt: null,
    doneAt: null,
    notificationId: null,
    createdAt: 1,
    ...o,
  });

  it('maps every entry kind', () => {
    const rows = timelineRows([
      { kind: 'sale', at: 5, saleId: 's1', billNo: 'B-1', totalPaise: 100, cancelled: false, items: [
        { productName: 'Kani', colourName: 'Red', colourHex: '#C0262D', qty: 2, ratePaise: 50, photoName: null },
      ] },
      { kind: 'return', at: 4, saleId: 's0', billNo: 'B-0', totalPaise: 70 },
      { kind: 'event', at: 3, event: ev({ id: 'n', kind: 'catalogue_sent', note: JSON.stringify({ productIds: ['a', 'b', 'c'] }) }) },
      { kind: 'event', at: 2, event: ev({ id: 'k', kind: 'card_sent', refId: 'p1' }) },
      { kind: 'event', at: 1, event: ev({ id: 'f', kind: 'follow_up', dueAt: 10, doneAt: 11 }) },
      { kind: 'event', at: 0, event: ev({ id: 'x', kind: 'catalogue_sent', note: 'not json' }) },
    ]);
    expect(rows.map((r) => r.type)).toEqual(['sale', 'return', 'event', 'event', 'event', 'event']);
    expect(rows[0]).toMatchObject({ pieces: 2, icon: 'receipt-long' });
    expect(rows[2]).toMatchObject({ titleKey: 'timeline.catalogue', count: 3 });
    expect(rows[4]).toMatchObject({ titleKey: 'timeline.followUpDone', icon: 'check-circle', done: true });
    expect(rows[5]).toMatchObject({ count: 0 });
    expect(referencedProductIds(rows)).toEqual(['p1']);
  });
});

describe('link into the Customers tab', () => {
  it('"See all" follow-ups turns "Follow-up due" on, once per link', () => {
    expect(dueCustomersHref(7)).toEqual({ pathname: '/customers', params: { filter: 'due', at: '7' } });
    expect(customerListSeed({ filter: 'due', at: '7' })).toEqual({ key: 'due:7', followUpDue: true });
    expect(customerListSeed({})).toBeNull();
    expect(customerListSeed({ filter: 'other' })).toBeNull();
  });
});
