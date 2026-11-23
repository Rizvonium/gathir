import { screensToLeave } from '../logic/leave';
import {
  addLiked,
  clamp,
  doubleTapOffset,
  focalOffset,
  KEN_BURNS_SCALE,
  kenBurnsPose,
  kenBurnsRunning,
  maxOffset,
  nextSlide,
  rubberBand,
  showroomAvailability,
} from '../logic/showroom';

describe('showroom availability', () => {
  it('says Available or Only n left, never exact counts unless allowed', () => {
    expect(showroomAvailability(12, 1, false)).toEqual({ kind: 'available' });
    expect(showroomAvailability(2, 1, false)).toEqual({ kind: 'few', count: 2 });
    expect(showroomAvailability(3, 3, false)).toEqual({ kind: 'few', count: 3 });
    expect(showroomAvailability(12, 1, true)).toEqual({ kind: 'count', count: 12 });
    expect(showroomAvailability(0, 1, true)).toEqual({ kind: 'sold_out' });
  });
});

describe('attract mode and drift', () => {
  it('wraps to the first slide', () => {
    expect(nextSlide(0, 3)).toBe(1);
    expect(nextSlide(2, 3)).toBe(0);
    expect(nextSlide(0, 0)).toBe(0);
  });

  it('rests at identity and drifts gently in alternating directions', () => {
    expect(kenBurnsPose(0, 400, 800, 0)).toEqual({ scale: 1, x: 0, y: -0 });
    const a = kenBurnsPose(0, 400, 800, 1);
    const b = kenBurnsPose(1, 400, 800, 1);
    expect(a.scale).toBeCloseTo(KEN_BURNS_SCALE);
    expect(Math.sign(a.x)).toBe(-Math.sign(b.x));
    expect(Math.abs(a.x)).toBeLessThanOrEqual(400 * 0.03);
  });

  it('drifts only on the visible slide of a Showroom that is on screen', () => {
    expect(kenBurnsRunning({ active: true, onScreen: true, reducedMotion: false })).toBe(true);
    // "Send me this" pushed the card or catalogue screen on top (or the app went to the background).
    expect(kenBurnsRunning({ active: true, onScreen: false, reducedMotion: false })).toBe(false);
    expect(kenBurnsRunning({ active: false, onScreen: true, reducedMotion: false })).toBe(false);
    expect(kenBurnsRunning({ active: true, onScreen: true, reducedMotion: true })).toBe(false);
  });
});

describe('zoom maths', () => {
  it('clamps and rubber-bands', () => {
    expect(clamp(5, 1, 4)).toBe(4);
    expect(rubberBand(2, 1, 4)).toBe(2);
    expect(rubberBand(0.5, 1, 4)).toBeCloseTo(0.825);
    expect(rubberBand(5, 1, 4)).toBeCloseTo(4.35);
  });

  it('keeps the photo edge inside the frame', () => {
    expect(maxOffset(400, 1)).toBe(0);
    expect(maxOffset(400, 2)).toBe(200);
  });

  it('keeps the pinched point under the fingers', () => {
    // A point 100 right of centre stays put when zooming 2× around it.
    expect(focalOffset(0, 100, 100, 2)).toBe(-100);
    expect(doubleTapOffset(0, 400, 2)).toBe(200);
    expect(doubleTapOffset(200, 400, 2)).toBe(0);
  });
});

describe('liked items', () => {
  it('keeps first-liked order without duplicates', () => {
    expect(addLiked(['a'], 'b')).toEqual(['a', 'b']);
    expect(addLiked(['a', 'b'], 'a')).toEqual(['a', 'b']);
  });
});

describe('screensToLeave', () => {
  it('pops the leave screen and the Showroom', () => {
    expect(screensToLeave(['(tabs)', 'showroom/index', 'showroom/leave'])).toBe(2);
    expect(screensToLeave(['(tabs)', 'product/[id]', 'showroom/index', 'showroom/leave'])).toBe(2);
  });
  it('also pops screens opened from the Showroom (e.g. a card send left open)', () => {
    expect(screensToLeave(['(tabs)', 'showroom/index', 'catalogue', 'showroom/leave'])).toBe(3);
  });
  it('goes Home when the Showroom was the first screen or is missing', () => {
    expect(screensToLeave(['showroom/index', 'showroom/leave'])).toBeNull();
    expect(screensToLeave(['(tabs)', 'showroom/leave'])).toBeNull();
  });
});

describe('Showroom session (what may open over the Showroom)', () => {
  // Imported lazily so this file's other tests keep their own module state.
  const session = require('../logic/session') as typeof import('../logic/session');
  const { redirectIncomingPath } = require('@/lib/deepLinks') as typeof import('@/lib/deepLinks');
  const { redirectSystemPath } = require('@/app/+native-intent') as typeof import('@/app/+native-intent');

  beforeEach(() => {
    session.resetShowroomSessionForTests();
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  it('lets /showroom/leave through only once per correct PIN while open', () => {
    expect(session.consumeShowroomLeave()).toBe(true); // nothing open: harmless
    const exit = session.enterShowroom();
    expect(session.isShowroomActive()).toBe(true);
    expect(session.consumeShowroomLeave()).toBe(false);
    session.grantShowroomLeave();
    expect(session.consumeShowroomLeave()).toBe(true);
    expect(session.consumeShowroomLeave()).toBe(false);
    exit();
    exit(); // a second cleanup call is ignored
    expect(session.isShowroomActive()).toBe(false);
  });

  it('holds navigation (latest per key) until the Showroom is left', () => {
    const now = jest.fn();
    expect(session.whenShowroomClosed('n', now)).toBe(true);
    expect(now).toHaveBeenCalledTimes(1);

    const exit = session.enterShowroom();
    const first = jest.fn();
    const latest = jest.fn();
    expect(session.whenShowroomClosed('n', first)).toBe(false);
    session.whenShowroomClosed('n', latest);
    jest.runAllTimers();
    expect(latest).not.toHaveBeenCalled();
    exit();
    jest.runAllTimers();
    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledTimes(1);
  });

  it('notifies subscribers when the Showroom opens and closes', () => {
    const listener = jest.fn();
    const unsubscribe = session.subscribeShowroom(listener);
    const exit = session.enterShowroom();
    exit();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it('never lets a gathir:// link open a screen: ignored while running, Home on a cold start', () => {
    for (const path of ['/showroom/leave', 'gathir://showroom/leave', '/owner', '/lock?mode=set', '/more', '/', '/settings/owner']) {
      expect(redirectIncomingPath(path, false)).toBeNull();
      expect(redirectIncomingPath(path, true)).toBe('/');
      expect(redirectSystemPath({ path, initial: false })).toBeNull();
      expect(redirectSystemPath({ path, initial: true })).toBe('/');
    }
  });
});

describe('Send me this: who may be listed', () => {
  const { maskedPhone, sheetMatches, MAX_MATCHES } = require('../logic/sendSheet') as typeof import('../logic/sendSheet');
  const rows = [
    { id: 'a', name: 'Anita', phone: '+919876543210' },
    { id: 'b', name: 'Bilal', phone: '+919811111111' },
    { id: 'c', name: 'No phone', phone: null },
  ];

  it('locked: only the exact full number, never a partial one or a name', () => {
    expect(sheetMatches(rows, 'an', false)).toEqual([]);
    expect(sheetMatches(rows, '98', false)).toEqual([]);
    expect(sheetMatches(rows, '9876543210', false).map((r) => r.id)).toEqual(['a']);
    expect(sheetMatches(rows, '+91 98765 43210', false).map((r) => r.id)).toEqual(['a']);
    expect(sheetMatches(rows, '9876543211', false)).toEqual([]);
  });

  it('unlocked: the search results after 2 letters, at most 5', () => {
    expect(sheetMatches(rows, 'a', true)).toEqual([]);
    expect(sheetMatches(rows, 'an', true)).toHaveLength(3);
    expect(sheetMatches(Array.from({ length: 9 }, () => rows[0]), 'an', true)).toHaveLength(MAX_MATCHES);
  });

  it('masks numbers down to the last 4 digits', () => {
    expect(maskedPhone('+919876543210')).toBe('•••• 3210');
    expect(maskedPhone(null)).toBeUndefined();
  });
});
