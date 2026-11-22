import { createCategory } from '@/db/repo/categories';
import { createCustomer } from '@/db/repo/customers';
import { createReportRecord, markSent } from '@/db/repo/reports';
import { updateSettings } from '@/db/repo/settings';
import { insertSampleData } from '@/db/sampleData';
import { createTestDb } from '@/test/testDb';

import { T0 } from '@/db/__tests__/fixtures';

import { checkName } from '../hooks/useCategoryEditor';
import { readMoreSummary, readTagCounts } from '../settingsData';
import {
  backupAge,
  backupIsStale,
  clampLowStock,
  cleanCategoryName,
  describeLowStock,
  isDuplicateName,
  isStorageLow,
  moveItem,
  orderWithReplacement,
  ownerNumberToSave,
  storageShares,
  validateShop,
} from '../settingsLogic';

jest.mock('@/db/client', () => ({ db: {} }));
jest.mock('@/db/hooks', () => ({ useDbQuery: jest.fn() }));
jest.mock('@/ui/components', () => ({ playHaptic: jest.fn(), useToast: jest.fn() }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

const DAY = 86_400_000;

describe('settingsLogic', () => {
  it('clamps the low-stock level to 0–20', () => {
    expect(clampLowStock(-3)).toBe(0);
    expect(clampLowStock(2.6)).toBe(3);
    expect(clampLowStock(99)).toBe(20);
    expect(clampLowStock(NaN)).toBe(1);
    expect(describeLowStock(0)).toEqual({ kind: 'off' });
    expect(describeLowStock(2)).toEqual({ kind: 'atOrBelow', count: 2 });
  });

  it('moves categories and restores an undone delete in place', () => {
    expect(moveItem(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c']);
    expect(moveItem(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'b', 'c']);
    expect(orderWithReplacement(['a', 'b', 'c'], 'b', 'z')).toEqual(['a', 'z', 'c']);
  });

  it('cleans category names and finds duplicates (any case)', () => {
    expect(cleanCategoryName('  Kani   shawls ')).toBe('Kani shawls');
    expect(cleanCategoryName('   ')).toBeNull();
    expect(cleanCategoryName('x'.repeat(31))).toBeNull();
    const list = [{ id: '1', name: 'Stoles' }];
    expect(isDuplicateName('stoles', list)).toBe(true);
    expect(isDuplicateName('stoles', list, '1')).toBe(false);
    expect(checkName(' ', list)).toEqual({ name: null, error: 'required' });
    expect(checkName('STOLES', list)).toEqual({ name: null, error: 'duplicate' });
    expect(checkName('Pherans', list)).toEqual({ name: 'Pherans', error: undefined });
  });

  it('validates the shop form', () => {
    expect(validateShop({ shopName: ' ', sellerName: '', phone: '', address: '', upiId: '' })).toEqual({ shopName: 'required' });
    expect(validateShop({ shopName: 'Valley', sellerName: '', phone: '', address: '', upiId: 'bad' })).toEqual({ upiId: 'upi' });
    expect(validateShop({ shopName: 'Valley', sellerName: '', phone: '', address: '', upiId: 'valley@okaxis' })).toEqual({});
  });

  it('owner number: empty clears, invalid blocks', () => {
    expect(ownerNumberToSave('  ', null)).toBe('');
    expect(ownerNumberToSave('98', null)).toBeNull();
    expect(ownerNumberToSave('98765 43210', '+919876543210')).toBe('+919876543210');
  });

  it('describes backup age in days and flags a week without one', () => {
    const now = new Date(2026, 10, 22, 18).getTime();
    expect(backupAge(null, now)).toEqual({ kind: 'never' });
    expect(backupAge(now - 3600_000, now)).toEqual({ kind: 'today' });
    expect(backupAge(now - 3 * DAY, now)).toEqual({ kind: 'days', days: 3 });
    expect(backupIsStale(null, now)).toBe(true);
    expect(backupIsStale(now - 7 * DAY, now)).toBe(false);
    expect(backupIsStale(now - 8 * DAY, now)).toBe(true);
  });

  it('storage: low space and bar shares', () => {
    expect(isStorageLow(null, null)).toBe(false);
    expect(isStorageLow(100 * 1024 * 1024, 64e9)).toBe(true);
    expect(isStorageLow(2e9, 64e9)).toBe(true);
    expect(isStorageLow(20e9, 64e9)).toBe(false);
    expect(storageShares({ a: 3, b: 1, c: 0 })).toEqual({ a: 0.75, b: 0.25, c: 0 });
    expect(storageShares({ a: 0 })).toEqual({ a: 0 });
  });
});

describe('settingsData', () => {
  it('reads the More summary without creating the settings row', () => {
    const db = createTestDb();
    const s = readMoreSummary(db);
    expect(s.shopName).toBe('');
    expect(s.pinSet).toBe(false);
    expect(s.includePhones).toBe(true);
    expect(s.includeProfit).toBe(false);
    expect(s.sentReports).toBe(0);
  });

  it('counts categories, sent reports and sample data', () => {
    const db = createTestDb();
    updateSettings(db, { shopName: 'Valley Pashmina', ownerWhatsapp: '+919906000999', lowStockLevel: 3 }, T0);
    createCategory(db, { name: 'Stoles' }, T0);
    const sent = createReportRecord(db, { kind: 'owner', periodFrom: T0 - DAY, periodTo: T0 }, T0);
    markSent(db, sent.id, T0);
    createReportRecord(db, { kind: 'owner', periodFrom: T0 - DAY, periodTo: T0 }, T0);
    const s = readMoreSummary(db);
    expect(s.shopName).toBe('Valley Pashmina');
    expect(s.lowStockLevel).toBe(3);
    expect(s.categoryCount).toBeGreaterThanOrEqual(1);
    expect(s.sentReports).toBe(1);
    expect(s.hasSample).toBe(false);
    insertSampleData(db, T0);
    expect(readMoreSummary(db).hasSample).toBe(true);
  });

  it('counts customers per tag', () => {
    const db = createTestDb();
    createCustomer(db, { name: 'Mrs Shah', tag: 'regular' }, T0);
    createCustomer(db, { name: 'Dealer Ali', tag: 'wholesale' }, T0);
    createCustomer(db, { name: 'Anna', tag: 'regular' }, T0);
    const c = readTagCounts(db);
    expect(c).toEqual({ regular: 2, wholesale: 1, tourist: 0, walk_in: 0, other: 0 });
  });
});
