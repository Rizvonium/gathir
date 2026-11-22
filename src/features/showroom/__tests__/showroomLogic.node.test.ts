import {
  addLiked,
  clamp,
  doubleTapOffset,
  focalOffset,
  KEN_BURNS_SCALE,
  kenBurnsPose,
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
