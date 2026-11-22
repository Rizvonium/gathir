import { softDeleteProduct } from '@/db/repo/products';
import { updateSettings } from '@/db/repo/settings';
import { clearSampleData, insertSampleData } from '@/db/sampleData';
import { ensureSeedData } from '@/db/seed';
import { addTestProduct } from '@/db/__tests__/fixtures';
import { createTestDb } from '@/test/testDb';

import { readHomeExtras } from '../homeData';

const NOW = new Date(2026, 10, 22, 10, 0).getTime();

describe('readHomeExtras', () => {
  it('handles a missing settings row', () => {
    const db = createTestDb({ seed: false });
    expect(readHomeExtras(db)).toEqual({ shopName: '', lastBackupAt: null, hasSample: false, realProducts: 0 });
  });

  it('counts real live products and spots sample data', () => {
    const db = createTestDb();
    ensureSeedData(db, '', NOW);
    updateSettings(db, { shopName: 'Valley', lastBackupAt: NOW }, NOW);
    insertSampleData(db, NOW);
    addTestProduct(db, { name: 'Real one' });
    const { productId } = addTestProduct(db, { name: 'Gone' });
    softDeleteProduct(db, productId, NOW);
    expect(readHomeExtras(db)).toEqual({ shopName: 'Valley', lastBackupAt: NOW, hasSample: true, realProducts: 1 });
    clearSampleData(db);
    expect(readHomeExtras(db).hasSample).toBe(false);
  });
});
