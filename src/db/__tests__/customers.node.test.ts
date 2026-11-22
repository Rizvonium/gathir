import { eq } from 'drizzle-orm';

import {
  createCustomer,
  findByPhone,
  getCustomerProfile,
  listCustomers,
  listDeletedCustomers,
  normalizePhone,
  purgeDeletedCustomers,
  restoreCustomer,
  softDeleteCustomer,
  suggestedProducts,
  updateCustomer,
} from '@/db/repo/customers';
import { DuplicateCustomerError } from '@/db/repo/errors';
import { addFollowUp, addNote, completeFollowUp, dueFollowUps, logCatalogueSent } from '@/db/repo/events';
import { cancelSale, createSale } from '@/db/repo/sales';
import { customerEvents, sales } from '@/db/schema';
import { createTestDb } from '@/test/testDb';

import { addTestProduct, DAY, T0 } from './fixtures';

describe('customers', () => {
  it('normalises phones and guards duplicates with the existing id', () => {
    const db = createTestDb();
    expect(normalizePhone('098765 43210')).toBe('+919876543210');
    expect(normalizePhone('  ')).toBeNull();
    const id = createCustomer(db, { name: 'Mrs. Shah', phone: '9876543210' }, T0);
    let err: unknown;
    try {
      createCustomer(db, { name: 'Other', phone: '+91 98765-43210' }, T0);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(DuplicateCustomerError);
    expect((err as DuplicateCustomerError).existingId).toBe(id);
    const other = createCustomer(db, { name: 'B', phone: '9000000001' }, T0);
    expect(() => updateCustomer(db, other, { phone: '9876543210' })).toThrow(DuplicateCustomerError);
    expect(findByPhone(db, '9876543210')?.id).toBe(id);
    expect(createCustomer(db, { name: 'No phone' }, T0)).toBeTruthy();
    expect(createCustomer(db, { name: 'No phone 2' }, T0)).toBeTruthy();
  });

  it('soft delete keeps sale snapshots; purge clears them; restore works', () => {
    const db = createTestDb();
    const { colourIds } = addTestProduct(db);
    const id = createCustomer(db, { name: 'Asha', phone: '9876543210' }, T0);
    const { saleId } = createSale(db, { items: [{ colourId: colourIds[0], qty: 1, ratePaise: 100 }], customerId: id }, T0);
    softDeleteCustomer(db, id, T0 + DAY);
    expect(listCustomers(db)).toHaveLength(0);
    expect(listDeletedCustomers(db)[0].id).toBe(id);
    expect(db.select().from(sales).where(eq(sales.id, saleId)).get()?.customerNameSnapshot).toBe('Asha');
    restoreCustomer(db, id, T0 + DAY);
    expect(listCustomers(db)).toHaveLength(1);
    softDeleteCustomer(db, id, T0 + DAY);
    expect(purgeDeletedCustomers(db, T0 + 10 * DAY)).toEqual([]);
    expect(purgeDeletedCustomers(db, T0 + 32 * DAY)).toEqual([id]);
    const sale = db.select().from(sales).where(eq(sales.id, saleId)).get();
    expect(sale).toMatchObject({ customerId: null, customerNameSnapshot: null, customerPhoneSnapshot: null, totalPaise: 100 });
  });

  it('computes stats, learned likes and a newest-first timeline', () => {
    const db = createTestDb();
    const sozni = addTestProduct(db, { craft: 'Sozni' });
    const kani = addTestProduct(db, { name: 'Kani', craft: 'Kani', colours: [{ name: 'Maroon', hex: '#6D1A24', pieces: 5 }] });
    const id = createCustomer(db, { name: 'Asha', likes: { colours: ['beige'], crafts: [] } }, T0);
    createSale(db, { items: [{ colourId: sozni.colourIds[0], qty: 2, ratePaise: 500_000 }], customerId: id }, T0 + 1 * DAY);
    createSale(db, { items: [{ colourId: sozni.colourIds[0], qty: 1, ratePaise: 600_000 }], customerId: id }, T0 + 2 * DAY);
    const returned = createSale(db, { items: [{ colourId: kani.colourIds[0], qty: 3, ratePaise: 9_000_000 }], customerId: id }, T0 + 3 * DAY);
    cancelSale(db, returned.saleId, T0 + 4 * DAY);
    addNote(db, id, 'Likes deep reds', T0 + 5 * DAY);

    const p = getCustomerProfile(db, id);
    expect(p?.stats).toEqual({ lifetimeSpendPaise: 1_600_000, purchases: 2, lastVisitAt: T0 + 2 * DAY, piecesBought: 3 });
    expect(p?.learnedLikes.crafts).toEqual(['Sozni']);
    expect(p?.learnedLikes.colours).toEqual(['red']);
    expect(p?.learnedLikes.budgetMinPaise).toBe(500_000);
    expect(p?.timeline.map((t) => t.kind)).toEqual(['event', 'return', 'sale', 'sale', 'sale']);
    expect(p?.likes.colours).toEqual(['beige']);

    const row = listCustomers(db)[0];
    expect(row).toMatchObject({ lifetimeSpendPaise: 1_600_000, purchases: 2, lastVisitAt: T0 + 2 * DAY, favouriteColour: 'beige' });
  });

  it('filters and sorts the list', () => {
    const db = createTestDb();
    const { colourIds } = addTestProduct(db);
    const a = createCustomer(db, { name: 'Zara', tag: 'wholesale', phone: '9000000001' }, T0);
    const b = createCustomer(db, { name: 'Amir', tag: 'tourist' }, T0);
    createSale(db, { items: [{ colourId: colourIds[0], qty: 1, ratePaise: 900 }], customerId: a }, T0 + DAY);
    createSale(db, { items: [{ colourId: colourIds[0], qty: 1, ratePaise: 100 }], customerId: b }, T0 + 100 * DAY);
    addFollowUp(db, { customerId: b, dueAt: T0 + 50 * DAY }, T0);
    const now = T0 + 120 * DAY;
    expect(listCustomers(db, { sort: 'name' }, now).map((c) => c.name)).toEqual(['Amir', 'Zara']);
    expect(listCustomers(db, { sort: 'spend' }, now)[0].name).toBe('Zara');
    expect(listCustomers(db, { sort: 'recent' }, now)[0].name).toBe('Amir');
    expect(listCustomers(db, { tag: 'tourist' }, now).map((c) => c.id)).toEqual([b]);
    expect(listCustomers(db, { inactiveDays: 90 }, now).map((c) => c.id)).toEqual([a]);
    expect(listCustomers(db, { followUpDue: true }, now).map((c) => c.id)).toEqual([b]);
    expect(listCustomers(db, { search: '0000001' }, now).map((c) => c.id)).toEqual([a]);
    expect(listCustomers(db, { search: 'ami' }, now).map((c) => c.id)).toEqual([b]);
  });

  it('suggests in-stock products matching likes, ranked', () => {
    const db = createTestDb();
    const kani = addTestProduct(db, { name: 'Kani maroon', craft: 'Kani', ratePaise: 500_000, colours: [{ name: 'Maroon', hex: '#6D1A24', pieces: 2 }] });
    addTestProduct(db, { name: 'Kani blue', craft: 'Kani', colours: [{ name: 'Blue', hex: '#2F5DA8', pieces: 1 }] });
    addTestProduct(db, { name: 'Sold out kani', craft: 'Kani', colours: [{ name: 'Maroon', hex: '#6D1A24', pieces: 0 }] });
    addTestProduct(db, { name: 'Aari grey', craft: 'Aari', colours: [{ name: 'Grey', hex: '#8E8E93', pieces: 3 }] });
    const id = createCustomer(db, { name: 'A', likes: { crafts: ['Kani'], colours: ['maroon'], budgetMinPaise: 100_000, budgetMaxPaise: 600_000 } }, T0);
    const s = suggestedProducts(db, id);
    expect(s.map((x) => x.name)).toEqual(['Kani maroon', 'Kani blue']);
    expect(s[0].score).toBe(5);
    expect(s[0].reasons.sort()).toEqual(['budget', 'colour', 'craft']);
    expect(s[0].id).toBe(kani.productId);
    const none = createCustomer(db, { name: 'B' }, T0);
    expect(suggestedProducts(db, none)).toEqual([]);
  });

  it('handles events and due follow-ups', () => {
    const db = createTestDb();
    const id = createCustomer(db, { name: 'A', phone: '9000000002' }, T0);
    const due = addFollowUp(db, { customerId: id, dueAt: T0 + DAY, note: 'Call', notificationId: 'n1' }, T0);
    addFollowUp(db, { customerId: id, dueAt: T0 + 5 * DAY }, T0);
    logCatalogueSent(db, id, 'r1', ['p1', 'p2'], T0);
    expect(dueFollowUps(db, T0 + DAY).map((f) => f.eventId)).toEqual([due]);
    expect(completeFollowUp(db, due, T0 + DAY)).toBe('n1');
    expect(dueFollowUps(db, T0 + DAY)).toEqual([]);
    softDeleteCustomer(db, id, T0);
    expect(dueFollowUps(db, T0 + 10 * DAY)).toEqual([]);
    expect(db.select().from(customerEvents).all()).toHaveLength(3);
    expect(() => addNote(db, 'missing', 'x')).toThrow();
  });
});
