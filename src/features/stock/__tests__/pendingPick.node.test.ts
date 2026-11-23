jest.mock('expo-file-system', () => require('@/lib/__tests__/fakeFileSystem'));

import { listFiles, resetFakeFs } from '@/lib/__tests__/fakeFileSystem';

import { emptyDraft } from '../logic/draft';
import { forgetPick, PENDING_PICK_MAX_AGE_MS, readPendingPick, rememberPick } from '../logic/pendingPick';

beforeEach(() => resetFakeFs());

describe('pending picker marker', () => {
  const draft = { ...emptyDraft(), craft: 'Sozni', step: 0 };

  it('survives in app storage until the picker comes back', () => {
    rememberPick({ key: 'new', productId: null, at: 1_000, draft });
    expect(listFiles('file:///doc/')).toEqual(['file:///doc/pending-photo-pick.json']);
    expect(readPendingPick(2_000)).toEqual({ key: 'new', productId: null, at: 1_000, draft });
    forgetPick();
    expect(readPendingPick(2_000)).toBeNull();
    expect(() => forgetPick()).not.toThrow();
  });

  it('drops a marker that is too old or unreadable', () => {
    rememberPick({ key: 'p1', productId: 'p1', at: 1_000, draft });
    expect(readPendingPick(1_000 + PENDING_PICK_MAX_AGE_MS + 1)).toBeNull();
    expect(listFiles('file:///doc/')).toEqual([]);
    rememberPick({ key: 'new', productId: null, at: 1_000, draft: null as never });
    expect(readPendingPick(1_500)).toBeNull();
    expect(listFiles('file:///doc/')).toEqual([]);
  });
});
