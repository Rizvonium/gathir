import { addDays } from '@/lib/dates';
import { getSettings, updateSettings } from '@/db/repo/settings';
import { hasSampleData } from '@/db/sampleData';
import { products } from '@/db/schema';
import { ensureSeedData } from '@/db/seed';
import { createTestDb } from '@/test/testDb';

import { finishOnboarding, readOnboarded, readOnboardingDraft, saveLanguage, saveOwnerWhatsapp, saveShop } from '../onboardingData';

const NOW = new Date(2026, 10, 22, 10, 0).getTime();

describe('onboarding data', () => {
  it('reads as not onboarded with no settings row, without creating one', () => {
    const db = createTestDb({ seed: false });
    expect(readOnboarded(db)).toBe(false);
    expect(readOnboardingDraft(db).shopName).toBe('');
    expect(readOnboarded(db)).toBe(false);
  });

  it('pre-fills the owner number seeded from the build', () => {
    const db = createTestDb();
    ensureSeedData(db, '', NOW);
    updateSettings(db, { ownerWhatsapp: '+919906000999' }, NOW);
    expect(readOnboardingDraft(db).ownerWhatsapp).toBe('+919906000999');
  });

  it('saves each step as it goes', () => {
    const db = createTestDb();
    ensureSeedData(db, '', NOW);
    saveLanguage(db, 'en', NOW);
    saveShop(db, { shopName: 'Valley', sellerName: 'Ali', phone: '+919876543210', address: 'Lal Chowk', upiId: 'ali@okaxis' }, NOW);
    saveOwnerWhatsapp(db, '+919906000111', NOW);
    expect(readOnboardingDraft(db)).toMatchObject({ shopName: 'Valley', sellerName: 'Ali', upiId: 'ali@okaxis', ownerWhatsapp: '+919906000111', pinSet: false });
    expect(readOnboarded(db)).toBe(false);
  });

  it('finishes with sample data once, even if tapped twice', () => {
    const db = createTestDb();
    ensureSeedData(db, '', NOW);
    finishOnboarding(db, { sample: true }, NOW);
    expect(readOnboarded(db)).toBe(true);
    expect(hasSampleData(db)).toBe(true);
    const count = () => db.select().from(products).all().length;
    const before = count();
    finishOnboarding(db, { sample: true }, addDays(NOW, 0) + 1000);
    expect(count()).toBe(before);
  });

  it('finishes without sample data', () => {
    const db = createTestDb();
    ensureSeedData(db, '', NOW);
    finishOnboarding(db, { sample: false }, NOW);
    expect(getSettings(db).onboardedAt).toBe(NOW);
    expect(hasSampleData(db)).toBe(false);
  });

  it('a restored backup with onboardedAt counts as onboarded', () => {
    const db = createTestDb();
    updateSettings(db, { onboardedAt: NOW }, NOW);
    expect(readOnboarded(db)).toBe(true);
  });
});
