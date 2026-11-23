import { addTestProduct, DAY, expectNoDrift, T0 } from '@/db/__tests__/fixtures';
import { createCustomer, softDeleteCustomer } from '@/db/repo/customers';
import { getProductDetail, stockHistory } from '@/db/repo/productQueries';
import { removeColour as removeSavedColour, softDeleteProduct, updateProduct } from '@/db/repo/products';
import { createSale } from '@/db/repo/sales';
import { recordRestock } from '@/db/stock';
import { createTestDb } from '@/test/testDb';

import {
  addColour,
  addPhotos,
  draftFromDetail,
  emptyDraft,
  firstErrorStep,
  rebaseEditDraft,
  makeCover,
  movePhoto,
  removeColour,
  removePhoto,
  setColourPieces,
  setFields,
  setOneOfAKind,
  toggleSwatch,
  validateDraft,
  type DraftPhoto,
} from '../logic/draft';
import { catalogueHref, sellHref } from '../logic/links';
import { singular, suggestNames } from '../logic/naming';
import { filesOfDiscardedDraft, saveDraft } from '../logic/saveDraft';
import { deletedAgeDays, historyLine, listTotals } from '../logic/view';
import { purgeExpired } from '../logic/purge';
import { doubleTapOffset, focalOffset, maxOffset, rubberBand } from '../logic/zoom';

const photo = (n: string): DraftPhoto => ({ fileName: `${n}.jpg`, thumbName: `${n}.thumb.jpg`, width: 1600, height: 1200 });

describe('naming', () => {
  it('builds names from craft, material and category', () => {
    expect(suggestNames({ craft: 'Sozni', material: 'Pashmina', categoryName: 'Stoles' })).toEqual([
      'Sozni Pashmina Stole',
      'Sozni Stole',
      'Pashmina Stole',
    ]);
  });
  it('drops repeated words and "Other"', () => {
    expect(suggestNames({ craft: 'Kani', material: 'Pashmina', categoryName: 'Kani' })[0]).toBe('Kani Pashmina');
    expect(suggestNames({ craft: 'Other', material: 'Wool', categoryName: 'Other' })).toEqual(['Wool']);
  });
  it('uses the size as the noun when there is no category', () => {
    expect(suggestNames({ craft: 'Aari', size: 'Stole (70×200)' })[0]).toBe('Aari Stole');
  });
  it('is empty when nothing is picked', () => {
    expect(suggestNames({})).toEqual([]);
  });
  it('singularises plural category names only', () => {
    expect(singular('Pherans')).toBe('Pheran');
    expect(singular('Kani')).toBe('Kani');
    expect(singular('Glass')).toBe('Glass');
  });
});

describe('links', () => {
  it('pre-picks the colour only when one colour has pieces', () => {
    expect(sellHref('p1', [{ id: 'c1', pieces: 2 }, { id: 'c2', pieces: 0 }])).toEqual({
      pathname: '/sell',
      params: { productId: 'p1', colourId: 'c1' },
    });
    expect(sellHref('p1', [{ id: 'c1', pieces: 2 }, { id: 'c2', pieces: 1 }])).toEqual({ pathname: '/sell', params: { productId: 'p1' } });
    expect(sellHref('p1', [], 'c9')).toEqual({ pathname: '/sell', params: { productId: 'p1', colourId: 'c9' } });
  });
  it('joins catalogue ids with commas', () => {
    expect(catalogueHref(['a', 'b'])).toEqual({ pathname: '/catalogue', params: { productIds: 'a,b' } });
  });
});

describe('draft updates', () => {
  it('caps photos at 8 and returns the overflow', () => {
    const many = Array.from({ length: 10 }, (_, i) => photo(`p${i}`));
    const { draft, overflow } = addPhotos(emptyDraft(), many);
    expect(draft.photos).toHaveLength(8);
    expect(overflow.map((p) => p.fileName)).toEqual(['p8.jpg', 'p9.jpg']);
  });
  it('reorders photos and makes a cover', () => {
    let d = addPhotos(emptyDraft(), [photo('a'), photo('b'), photo('c')]).draft;
    d = movePhoto(d, 0, 2);
    expect(d.photos.map((p) => p.fileName)).toEqual(['b.jpg', 'c.jpg', 'a.jpg']);
    d = makeCover(d, 2);
    expect(d.photos[0].fileName).toBe('a.jpg');
    expect(movePhoto(d, 5, 0)).toBe(d);
  });
  it('remembers removed photo files for clean-up', () => {
    const d = removePhoto(addPhotos(emptyDraft(), [photo('a')]).draft, 'a.jpg');
    expect(d.photos).toEqual([]);
    expect(d.discardedFiles).toEqual(['a.jpg', 'a.thumb.jpg']);
  });
  it('toggles swatches and ignores duplicate names', () => {
    let d = toggleSwatch(emptyDraft(), 'Red', '#C0262D');
    d = addColour(d, ' red ', '#000000');
    expect(d.colours).toHaveLength(1);
    expect(d.colours[0].pieces).toBe(1);
    d = toggleSwatch(d, 'Red', '#C0262D');
    expect(d.colours).toEqual([]);
  });
  it('one-of-a-kind keeps one colour with one piece and gives the rest back when switched off', () => {
    let d = addColour(addColour(emptyDraft(), 'Red', '#C0262D'), 'Beige', '#D8C3A5');
    d = setColourPieces(d, d.colours[0].key, 5);
    d = setOneOfAKind(d, true);
    expect(d.colours.map((c) => [c.name, c.pieces])).toEqual([['Red', 1]]);
    expect(setColourPieces(d, d.colours[0].key, 4).colours[0].pieces).toBe(1);
    d = addColour(d, 'Black', '#1B1B1B');
    expect(d.colours.map((c) => c.name)).toEqual(['Black']);
    d = setOneOfAKind(d, false);
    expect(d.colours.map((c) => c.name).sort()).toEqual(['Beige', 'Black', 'Red']);
  });
  it('validates name (suggestion allowed), rate and colours', () => {
    const d = emptyDraft();
    const errors = validateDraft(d, undefined);
    expect(errors).toEqual({ name: 'nameRequired', rate: 'rateRequired', colours: 'coloursRequired' });
    expect(firstErrorStep(errors)).toBe(1);
    const ok = addColour(setFields(d, { ratePaise: 500_000 }), 'Red', '#C0262D');
    expect(validateDraft(ok, 'Sozni Stole')).toEqual({});
    expect(firstErrorStep(validateDraft(setFields(ok, { ratePaise: null }), 'x'))).toBe(1);
  });
});

describe('saveDraft', () => {
  it('creates a product with photos, colours and opening moves', () => {
    const db = createTestDb();
    let d = addPhotos(emptyDraft(), [photo('a'), photo('b')]).draft;
    d = removePhoto(d, 'b.jpg');
    d = setFields(d, { ratePaise: 650_000, craft: 'Sozni' });
    d = addColour(addColour(d, 'Red', '#C0262D'), 'Beige', '#D8C3A5');
    d = setColourPieces(d, d.colours[0].key, 3);
    const res = saveDraft(db, d, 'Sozni Stole', T0);
    expect(res.created).toBe(true);
    expect(res.filesToDelete.sort()).toEqual(['b.jpg', 'b.thumb.jpg']);
    const detail = getProductDetail(db, res.productId);
    expect(detail?.product.name).toBe('Sozni Stole');
    expect(detail?.photos.map((p) => p.fileName)).toEqual(['a.jpg']);
    expect(detail?.totalPieces).toBe(4);
    expectNoDrift(db);
  });

  it('edits details, photos and colours with honest stock moves', () => {
    const db = createTestDb();
    const { productId } = addTestProduct(db, { photos: 2, name: 'P' });
    const detail = getProductDetail(db, productId);
    if (!detail) throw new Error('missing');
    let d = draftFromDetail(detail);
    d = setFields(d, { ratePaise: 700_000, name: 'Renamed' });
    d = makeCover(d, 1);
    const [red, beige] = d.colours;
    d = setColourPieces(d, red.key, 6); // +2 restock
    d = removeColour(d, beige.key); // −2 deleted
    d = addColour(d, 'Black', '#1B1B1B'); // +1 added
    const res = saveDraft(db, d, 'Renamed', T0 + DAY);
    expect(res.created).toBe(false);
    const after = getProductDetail(db, productId);
    expect(after?.product.ratePaise).toBe(700_000);
    expect(after?.photos[0].fileName).toBe('P-1.jpg');
    expect(after?.colours.map((c) => [c.name, c.pieces])).toEqual([
      ['Red', 6],
      ['Black', 1],
    ]);
    const reasons = stockHistory(db, productId).map((h) => h.reason);
    expect(reasons).toEqual(expect.arrayContaining(['added', 'deleted']));
    expectNoDrift(db);
  });

  it('re-tapping a removed saved colour brings it back as it was (no write-off, no new colour)', () => {
    const db = createTestDb();
    const { productId, colourIds } = addTestProduct(db, { colours: [{ name: 'Maroon', hex: '#800000', pieces: 5, costPaise: 400_000 }, { name: 'Beige', hex: '#D8C3A5', pieces: 2 }] });
    const detail = getProductDetail(db, productId);
    if (!detail) throw new Error('missing');
    let d = draftFromDetail(detail);
    d = toggleSwatch(d, 'Maroon', '#800000'); // mis-tap: removed
    expect(d.removedColourIds).toEqual([colourIds[0]]);
    d = toggleSwatch(d, 'Maroon', '#800000'); // tapped again: the saved colour is back
    expect(d.removedColourIds).toEqual([]);
    expect(d.colours.find((c) => c.name === 'Maroon')).toMatchObject({ id: colourIds[0], pieces: 5, costPaise: 400_000 });
    saveDraft(db, d, 'Sozni stole', T0 + DAY);
    const after = getProductDetail(db, productId);
    expect(after?.colours.map((c) => [c.id, c.name, c.pieces, c.costPaise])).toEqual([
      [colourIds[0], 'Maroon', 5, 400_000],
      [colourIds[1], 'Beige', 2, null],
    ]);
    expect(stockHistory(db, productId).filter((h) => h.at === T0 + DAY)).toEqual([]);
    expectNoDrift(db);
  });

  it('a kept edit draft is re-based on newer saved counts and fields', () => {
    const db = createTestDb();
    const { productId, colourIds } = addTestProduct(db, { costPaise: 300_000, colours: [{ name: 'Maroon', hex: '#800000', pieces: 5 }, { name: 'Beige', hex: '#D8C3A5', pieces: 2 }] });
    const detail = getProductDetail(db, productId);
    if (!detail) throw new Error('missing');
    // Edit started: name changed, then the seller leaves (the draft is kept).
    let d = setFields(draftFromDetail(detail), { name: 'Maroon stole' });
    d = setColourPieces(d, d.colours[1].key, 3); // +1 Beige typed
    // Meanwhile: 2 Maroon sold, buying price changed elsewhere, 4 Beige restocked.
    createSale(db, { items: [{ colourId: colourIds[0], qty: 2, ratePaise: 650_000 }] }, T0 + 1);
    updateProduct(db, productId, { costPaise: 350_000 }, T0 + 2);
    recordRestock(db, colourIds[1], 4, '', T0 + 3);
    const fresh = getProductDetail(db, productId);
    if (!fresh) throw new Error('missing');
    const r = rebaseEditDraft(d, fresh);
    expect(r.colours.map((c) => [c.name, c.pieces])).toEqual([
      ['Maroon', 3],
      ['Beige', 7], // saved 6 + the seller's +1
    ]);
    expect(r.costPaise).toBe(350_000);
    expect(r.name).toBe('Maroon stole');
    expect(rebaseEditDraft(r, fresh)).toBe(r); // idempotent
    // Saving the STALE draft re-bases too: the sale is not undone, the newer cost is kept.
    saveDraft(db, d, 'Maroon stole', T0 + DAY);
    const after = getProductDetail(db, productId);
    expect(after?.product).toMatchObject({ name: 'Maroon stole', costPaise: 350_000 });
    expect(after?.colours.map((c) => [c.name, c.pieces])).toEqual([
      ['Maroon', 3],
      ['Beige', 7],
    ]);
    expectNoDrift(db);
  });

  it('the seller fixing a stale count to the real number writes no wrong correction', () => {
    const db = createTestDb();
    const { productId, colourIds } = addTestProduct(db, { colours: [{ name: 'Maroon', hex: '#800000', pieces: 5 }] });
    const detail = getProductDetail(db, productId);
    if (!detail) throw new Error('missing');
    const kept = setFields(draftFromDetail(detail), { notes: 'x' });
    createSale(db, { items: [{ colourId: colourIds[0], qty: 2, ratePaise: 1 }] }, T0 + 1);
    const fresh = getProductDetail(db, productId);
    if (!fresh) throw new Error('missing');
    // Reopening shows the real count (3); the seller leaves it.
    const shown = rebaseEditDraft(kept, fresh);
    expect(shown.colours[0].pieces).toBe(3);
    saveDraft(db, setColourPieces(shown, shown.colours[0].key, 3), 'Sozni stole', T0 + DAY);
    expect(getProductDetail(db, productId)?.colours[0].pieces).toBe(3);
    expectNoDrift(db);
  });

  it('drops colours deleted since the draft was started instead of restocking them', () => {
    const db = createTestDb();
    const { productId, colourIds } = addTestProduct(db);
    const detail = getProductDetail(db, productId);
    if (!detail) throw new Error('missing');
    let d = draftFromDetail(detail);
    d = setColourPieces(d, d.colours[1].key, 5);
    removeSavedColour(db, colourIds[1], T0 + 1);
    saveDraft(db, d, 'Sozni stole', T0 + DAY);
    const after = getProductDetail(db, productId);
    expect(after?.colours.map((c) => c.id)).toEqual([colourIds[0]]);
    expect(stockHistory(db, productId).filter((h) => h.colourId === colourIds[1] && h.delta > 0 && h.reason !== 'opening')).toEqual([]);
    expectNoDrift(db);
  });

  it('writes nothing when a step fails', () => {
    const db = createTestDb();
    const { productId } = addTestProduct(db);
    const detail = getProductDetail(db, productId);
    if (!detail) throw new Error('missing');
    const d = setFields(draftFromDetail(detail), { ratePaise: 1.5 });
    expect(() => saveDraft(db, d, 'X')).toThrow();
    expect(getProductDetail(db, productId)?.product.name).toBe('Sozni stole');
  });

  it('lists files left by a discarded draft', () => {
    const db = createTestDb();
    const d = removePhoto(addPhotos(emptyDraft(), [photo('x'), photo('y')]).draft, 'y.jpg');
    expect(filesOfDiscardedDraft(db, d).sort()).toEqual(['x.jpg', 'x.thumb.jpg', 'y.jpg', 'y.thumb.jpg']);
  });
});

describe('view helpers', () => {
  it('describes history lines with sign and reason key', () => {
    expect(historyLine({ delta: 3, reason: 'added' })).toEqual({ sign: '+', amount: 3, reasonKey: 'history.reason.added', tone: 'up' });
    expect(historyLine({ delta: -1, reason: 'sold' })).toEqual({ sign: '−', amount: 1, reasonKey: 'history.reason.sold', tone: 'down' });
  });
  it('counts days left before purge', () => {
    expect(deletedAgeDays(T0 + 30 * DAY, T0)).toBe(30);
    expect(deletedAgeDays(T0 + 2 * DAY, T0 + 1.5 * DAY)).toBe(1);
    expect(deletedAgeDays(T0, T0 + DAY)).toBe(0);
  });
  it('counts designs and pieces', () => {
    const rows = [
      { id: 'a', totalPieces: 2 },
      { id: 'b', totalPieces: 5 },
    ];
    expect(listTotals(rows)).toEqual({ designs: 2, pieces: 7 });
  });
});

describe('zoom maths', () => {
  it('rubber-bands past the limits', () => {
    expect(rubberBand(2, 1, 4)).toBe(2);
    expect(rubberBand(0.5, 1, 4)).toBeCloseTo(0.825);
    expect(rubberBand(5, 1, 4)).toBeCloseTo(4.35);
  });
  it('keeps the image covering the frame', () => {
    expect(maxOffset(400, 1)).toBe(0);
    expect(maxOffset(400, 2)).toBe(200);
  });
  it('keeps the focal point still', () => {
    // Zoom ×2 around a point 100 right of centre, fingers not moving: content shifts left by 100.
    expect(focalOffset(0, 100, 100, 2)).toBe(-100);
  });
  it('centres a double tap on the tapped point, within bounds', () => {
    expect(doubleTapOffset(200, 400, 2.5)).toBeCloseTo(0);
    expect(doubleTapOffset(400, 400, 2.5)).toBe(-300);
    expect(doubleTapOffset(0, 400, 2.5)).toBe(300);
  });
});

describe('purgeExpired', () => {
  it('removes products and customers deleted more than 30 days ago and returns their photo files', () => {
    const db = createTestDb();
    const old = addTestProduct(db, { name: 'Old', photos: 1 });
    const recent = addTestProduct(db, { name: 'Recent' });
    softDeleteProduct(db, old.productId, T0);
    softDeleteProduct(db, recent.productId, T0 + 20 * DAY);
    const customerId = createCustomer(db, { name: 'Gone' }, T0);
    softDeleteCustomer(db, customerId, T0);
    const res = purgeExpired(db, T0 + 31 * DAY);
    expect(res.products).toBe(1);
    expect(res.customers).toBe(1);
    expect(res.files.sort()).toEqual(['Old-0-t.jpg', 'Old-0.jpg']);
    expect(getProductDetail(db, recent.productId)).not.toBeNull();
    expect(getProductDetail(db, old.productId)).toBeNull();
  });
});
