import { createCustomer, getCustomerProfile } from '@/db/repo/customers';
import { buildCatalogueData, listReports } from '@/db/repo/reports';
import { addTestProduct, DAY, T0 } from '@/db/__tests__/fixtures';
import { renderCatalogueHtml } from '@/pdf/templates/catalogue';
import { createTestDb } from '@/test/testDb';

import { DEFAULT_FORM, dataOptions, layoutOptions, parseStoredForm, ratesValidTill, storedFormJson } from '../logic/options';
import { catalogueParts, partProductIds, partStats } from '../logic/parts';
import { FAN_MAX_PAGES, previewHtml } from '../logic/previewHtml';
import { quickAddCustomer, recordCardSent, recordCatalogueSent, recordLikedItems } from '../logic/record';
import { initialSource, parseIdList, toggleId, toSelection } from '../logic/selection';
import { mayReceive, personalOwner } from '../logic/flowData';

describe('catalogue options', () => {
  it('falls back to defaults for missing or broken JSON', () => {
    expect(parseStoredForm('{}')).toEqual(DEFAULT_FORM);
    expect(parseStoredForm('not json')).toEqual(DEFAULT_FORM);
    expect(parseStoredForm('[1,2]', 'ivory').style).toBe('ivory');
    expect(parseStoredForm(null).columns).toBe(2);
  });

  it('remembers everything except the personal note', () => {
    const form = { ...DEFAULT_FORM, title: '  Winter  ', personalNote: 'For Mrs Shah', columns: 3 as const, style: 'ivory' as const, validForDays: 15 as const, showRates: false };
    const back = parseStoredForm(storedFormJson(form));
    expect(back).toEqual({ ...form, title: 'Winter', personalNote: '' });
  });

  it('rejects unknown values', () => {
    const f = parseStoredForm(JSON.stringify({ columns: 4, style: 'neon', validForDays: 9, showRates: 'yes', title: 42 }));
    expect(f).toMatchObject({ columns: 2, style: 'bazaar', validForDays: 0, showRates: true, title: '' });
  });

  it('maps to repo options and layout, and computes the valid-till date', () => {
    expect(dataOptions({ ...DEFAULT_FORM, showExactCounts: true })).toEqual({ hideSoldOut: true, showRates: true, showCounts: true });
    expect(layoutOptions(DEFAULT_FORM)).toEqual({ style: 'bazaar', columns: 2, showOnlyLeft: true });
    expect(ratesValidTill(0, T0)).toBeNull();
    const till = ratesValidTill(7, T0)!;
    expect(new Date(till).getDate()).toBe(new Date(T0 + 7 * DAY).getDate());
    expect(new Date(till).getHours()).toBe(23);
  });
});

describe('catalogue selection', () => {
  it('parses id lists', () => {
    expect(parseIdList('a,b,,a, c')).toEqual(['a', 'b', 'c']);
    expect(parseIdList(['a,b', 'c'])).toEqual(['a', 'b', 'c']);
    expect(parseIdList(undefined)).toEqual([]);
  });

  it('starts on the choice implied by the link', () => {
    expect(initialSource({}).kind).toBe('all');
    expect(initialSource({ productIds: 'a,b' })).toEqual({ kind: 'selected', categoryId: null, productIds: ['a', 'b'] });
    expect(initialSource({ categoryId: 'c1' }).kind).toBe('category');
    expect(initialSource({ customerId: 'x' }).kind).toBe('suggested');
    expect(initialSource({ customerId: 'x', productIds: 'p' }).kind).toBe('selected');
  });

  it('turns a choice into a repo selection, or null when empty', () => {
    expect(toSelection({ kind: 'all', categoryId: null, productIds: [] }, [])).toBe('all');
    expect(toSelection({ kind: 'category', categoryId: null, productIds: [] }, [])).toBeNull();
    expect(toSelection({ kind: 'category', categoryId: 'c', productIds: [] }, [])).toEqual({ categoryId: 'c' });
    expect(toSelection({ kind: 'selected', categoryId: null, productIds: [] }, [])).toBeNull();
    expect(toSelection({ kind: 'suggested', categoryId: null, productIds: [] }, ['p1'])).toEqual({ productIds: ['p1'] });
    expect(toggleId(['a', 'b'], 'a')).toEqual(['b']);
    expect(toggleId(['a'], 'b')).toEqual(['a', 'b']);
  });
});

describe('catalogue parts', () => {
  it('builds one doc with the seller choices and never cost', () => {
    const db = createTestDb();
    addTestProduct(db, { name: 'Kani shawl', costPaise: 123_456 });
    addTestProduct(db, { name: 'Sold out stole', colours: [{ name: 'Red', hex: '#C0262D', pieces: 0 }] });
    const form = { ...DEFAULT_FORM, title: '', personalNote: ' Hello ', discountLine: '10% off', validForDays: 7 as const };
    const data = buildCatalogueData(db, 'all', dataOptions(form), T0);
    const [doc, ...rest] = catalogueParts(data, form, { customerName: 'Mrs Shah', fontCss: '', now: T0, fallbackTitle: 'Pashmina' }, new Map());
    expect(rest).toHaveLength(0);
    expect(doc.items.map((i) => i.name)).toEqual(['Kani shawl']);
    expect(doc).toMatchObject({ title: 'Pashmina', customerName: 'Mrs Shah', personalNote: 'Hello', discountLine: '10% off', part: null });
    expect(doc.ratesValidTill).toBe(ratesValidTill(7, T0));
    expect(JSON.stringify(doc)).not.toContain('123456');
    expect(partStats(doc)).toMatchObject({ items: 1, pages: 3 });
  });

  it('drops the valid-till date when rates are hidden', () => {
    const db = createTestDb();
    addTestProduct(db);
    const form = { ...DEFAULT_FORM, showRates: false, validForDays: 30 as const };
    const [doc] = catalogueParts(buildCatalogueData(db, 'all', dataOptions(form), T0), form, { customerName: null, fontCss: '', now: T0 }, new Map());
    expect(doc.ratesValidTill).toBeNull();
    expect(doc.items[0].ratePaise).toBeNull();
  });

  it('splits large catalogues into balanced parts', () => {
    const db = createTestDb();
    for (let i = 0; i < 5; i++) addTestProduct(db, { name: `P${i}` });
    const data = buildCatalogueData(db, 'all', dataOptions(DEFAULT_FORM), T0);
    const docs = catalogueParts(data, DEFAULT_FORM, { customerName: null, fontCss: '', now: T0 }, new Map(), 2);
    expect(docs.map((d) => d.items.length)).toEqual([2, 2, 1]);
    expect(docs.map((d) => d.part)).toEqual([
      { index: 1, total: 3 },
      { index: 2, total: 3 },
      { index: 3, total: 3 },
    ]);
    expect(partProductIds(docs)).toHaveLength(5);
  });
});

describe('preview html', () => {
  const style = { background: '#F6ECDD', shadow: 'rgba(0,0,0,.3)', reducedMotion: false };

  it('keeps the real pages and adds a wide viewport and fan-in stagger', () => {
    const db = createTestDb();
    addTestProduct(db);
    const [doc] = catalogueParts(buildCatalogueData(db, 'all', dataOptions(DEFAULT_FORM), T0), DEFAULT_FORM, { customerName: null, fontCss: '', now: T0 }, new Map());
    const html = renderCatalogueHtml(doc);
    const out = previewHtml(html, style);
    expect(out).toContain('width=860');
    expect(out.match(/name="viewport"/g)).toHaveLength(1);
    expect(out).toContain('gathir-fan');
    expect(out).toContain(`nth-child(${FAN_MAX_PAGES})`);
    expect(out).toContain('animation-delay:240ms');
    expect(out).toContain(html.slice(html.indexOf('<body>')));
  });

  it('has no motion when reduced motion is on', () => {
    expect(previewHtml('<html><head></head><body></body></html>', { ...style, reducedMotion: true })).not.toContain('animation');
  });
});

describe('recording sends', () => {
  it('records a catalogue on the report list and the customer timeline', () => {
    const db = createTestDb();
    const { productId } = addTestProduct(db);
    const customerId = createCustomer(db, { name: 'Mrs Shah', phone: '+919876543210' }, T0);
    const reportId = recordCatalogueSent(db, { customerId, productIds: [productId], fileName: 'Catalogue.pdf', title: 'Winter', parts: 1 }, T0);
    const report = listReports(db, 'catalogue')[0];
    expect(report).toMatchObject({ id: reportId, kind: 'catalogue', customerId, sentAt: T0 });
    const timeline = getCustomerProfile(db, customerId)!.timeline;
    expect(JSON.stringify(timeline)).toContain('catalogue_sent');
  });

  it('records a chat chosen in WhatsApp without a timeline event', () => {
    const db = createTestDb();
    recordCatalogueSent(db, { customerId: null, productIds: [], fileName: 'x.pdf', title: '', parts: 1 }, T0);
    expect(listReports(db, 'catalogue')).toHaveLength(1);
  });

  it('logs cards and liked items, and quick-adds customers by number', () => {
    const db = createTestDb();
    const { productId } = addTestProduct(db);
    const a = quickAddCustomer(db, { name: '', phone: '+919876543210' }, T0);
    expect(a.name).toContain('98765');
    const again = quickAddCustomer(db, { name: 'Someone', phone: '+919876543210' }, T0);
    expect(again).toEqual(a);
    // "Send me this" is the customer asking for it: that is their yes to being sent catalogues.
    expect(getCustomerProfile(db, a.id)!.customer.whatsappOk).toBe(true);
    recordCardSent(db, a.id, productId, T0);
    recordCardSent(db, null, productId, T0);
    recordLikedItems(db, a.id, [productId, productId], T0);
    const kinds = JSON.stringify(getCustomerProfile(db, a.id)!.timeline);
    expect(kinds).toContain('card_sent');
    expect(kinds.match(/liked_item/g)).toHaveLength(1);
  });
});

describe("a customer's own catalogue goes only to them", () => {
  const plain = { customerId: null } as unknown as Parameters<typeof mayReceive>[0];
  const theirs = { customerId: 'c1' } as unknown as Parameters<typeof mayReceive>[0];

  it('locks personal data to its customer', () => {
    expect(personalOwner(theirs)).toBe('c1');
    expect(personalOwner(plain)).toBeNull();
    expect(mayReceive(theirs, { kind: 'customer', id: 'c1', name: 'Mrs Shah', phone: null })).toBe(true);
    expect(mayReceive(theirs, { kind: 'customer', id: 'c2', name: 'Rafiq', phone: null })).toBe(false);
    expect(mayReceive(theirs, { kind: 'number', phone: '+919876543210' })).toBe(false);
    expect(mayReceive(theirs, { kind: 'chat' })).toBe(false);
  });

  it('lets a plain catalogue go to anyone', () => {
    expect(mayReceive(plain, { kind: 'chat' })).toBe(true);
    expect(mayReceive(plain, { kind: 'customer', id: 'c2', name: 'Rafiq', phone: null })).toBe(true);
  });
});
