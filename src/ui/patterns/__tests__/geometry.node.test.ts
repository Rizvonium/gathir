import path from 'path';

import * as geo from '../geometry';
import { placeholderLayers, productInitials } from '../placeholderArt';

/**
 * The Pattern Lab (design/pattern-lab/geometry.js) and the app (geometry.ts) must draw the
 * same art for the same seed. The lab file is UMD, so Node can require it directly.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const lab = require(path.join(__dirname, '../../../../design/pattern-lab/geometry.js')) as typeof geo;

describe('mulberry32', () => {
  it('is deterministic and in [0, 1)', () => {
    const a = geo.mulberry32(42);
    const b = geo.mulberry32(42);
    const seqA = Array.from({ length: 200 }, a);
    const seqB = Array.from({ length: 200 }, b);
    expect(seqA).toEqual(seqB);
    expect(seqA.every((v) => v >= 0 && v < 1)).toBe(true);
  });

  it('gives different sequences for different seeds', () => {
    const a = geo.mulberry32(1);
    const b = geo.mulberry32(2);
    expect(a()).not.toBe(b());
  });

  it('matches a known first value (guards accidental algorithm changes)', () => {
    expect(geo.mulberry32(0)()).toBeCloseTo(0.26642920868471265, 12);
  });
});

describe('hashString', () => {
  it('is stable FNV-1a', () => {
    expect(geo.hashString('')).toBe(0x811c9dc5);
    expect(geo.hashString('a')).toBe(0xe40c292c);
    expect(geo.hashString('prod_123')).toBe(geo.hashString('prod_123'));
    expect(geo.hashString('prod_123')).not.toBe(geo.hashString('prod_124'));
  });
});

describe('noise', () => {
  it('is seeded, bounded and continuous', () => {
    const n1 = geo.createNoise2D(7);
    const n2 = geo.createNoise2D(7);
    const n3 = geo.createNoise2D(8);
    let differs = false;
    for (let i = 0; i < 300; i++) {
      const x = i * 0.137;
      const y = i * 0.071;
      const v = n1(x, y);
      expect(v).toBe(n2(x, y));
      expect(Math.abs(v)).toBeLessThanOrEqual(1.5);
      expect(Math.abs(n1(x + 0.001, y) - v)).toBeLessThan(0.05);
      if (n3(x, y) !== v) differs = true;
    }
    expect(differs).toBe(true);
  });
});

describe('fmt', () => {
  it('rounds to 2 decimals without negative zero', () => {
    expect(geo.fmt(1.23456)).toBe('1.23');
    expect(geo.fmt(-0.0001)).toBe('0');
    expect(geo.fmt(10)).toBe('10');
  });
});

describe('shapes', () => {
  it('builds valid-looking SVG paths', () => {
    expect(geo.botehPath(50, 50, 10, 0.3, 0.5)).toMatch(/^M[-\d.]+ [-\d.]+(C[-\d. ]+){6}Z$/);
    expect(geo.circlePath(10, 10, 2)).toBe('M8 10a2 2 0 1 0 4 0a2 2 0 1 0 -4 0Z');
    expect(geo.chinarLeafPath(20).startsWith('M')).toBe(true);
    expect(geo.chinarLeafPath(20).endsWith('Z')).toBe(true);
    expect(geo.smoothPath([[0, 0]])).toBe('');
  });

  it('botehMotif has 7 dots and a nested inner shape', () => {
    const m = geo.botehMotif(100, 100, 20, 0, 0.5);
    expect(m.dots).toHaveLength(7);
    expect(m.inner).not.toBe(m.outline);
  });
});

describe('fields and particles', () => {
  it('botehField is deterministic, respects bounds and spacing', () => {
    const a = geo.botehField(11, 360, 160, 0.5, 6);
    expect(a).toEqual(geo.botehField(11, 360, 160, 0.5, 6));
    expect(a.length).toBeGreaterThan(3);
    for (const p of a) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThan(360);
      expect(p.ink).toBeGreaterThanOrEqual(0);
      expect(p.ink).toBeLessThan(6);
    }
    expect(geo.botehField(12, 360, 160, 0.5, 6)).not.toEqual(a);
  });

  it('denser fields hold more boteh', () => {
    expect(geo.botehField(3, 400, 200, 1, 6).length).toBeGreaterThan(geo.botehField(3, 400, 200, 0, 6).length);
  });

  it('weaveLayers returns one path per ink, ground ink always used', () => {
    const layers = geo.weaveLayers(5, 120, 80, 8, 4, 0.3);
    expect(layers).toHaveLength(4);
    expect(layers[0].length).toBeGreaterThan(0);
  });

  it('sozniVines returns the requested count', () => {
    const vines = geo.sozniVines(3, 300, 120, 3, 0.5, 6);
    expect(vines).toHaveLength(3);
    for (const v of vines) expect(v.stem.startsWith('M')).toBe(true);
  });

  it('caps leaves at 3 and confetti at 40', () => {
    expect(geo.leafDrift(1, 10, 300, 300)).toHaveLength(3);
    expect(geo.confettiParticles(1, 500)).toHaveLength(40);
  });

  it('poses stay finite and fade out by t = 1', () => {
    const leaf = geo.leafDrift(1, 2, 300, 300)[0];
    expect(geo.leafPose(leaf, 0).alpha).toBe(0);
    expect(geo.leafPose(leaf, 1).alpha).toBeCloseTo(0, 6);
    const c = geo.confettiParticles(4, 10)[0];
    const start = geo.confettiPose(c, 0, 100, 100, 80);
    expect(start.x).toBeCloseTo(100, 6);
    expect(start.y).toBeCloseTo(100, 6);
    expect(geo.confettiPose(c, 1, 100, 100, 80).alpha).toBeCloseTo(0, 6);
  });

  it('gathirMark has three threads with increasing delays', () => {
    const m = geo.gathirMark(1024, 0.6);
    expect(m.threads.map((t) => t.ink)).toEqual([0, 1, 2]);
    expect(m.threads[2].delay).toBeGreaterThan(m.threads[0].delay);
  });
});

describe('lab parity (design/pattern-lab/geometry.js ⇔ geometry.ts)', () => {
  const seeds = [0, 1, 42, 2024, 987654321];

  it.each(seeds)('seed %i draws the same art in both', (seed) => {
    const r1 = geo.mulberry32(seed);
    const r2 = lab.mulberry32(seed);
    for (let i = 0; i < 50; i++) expect(r1()).toBe(r2());
    expect(geo.botehField(seed, 400, 180, 0.6, 6)).toEqual(lab.botehField(seed, 400, 180, 0.6, 6));
    expect(geo.botehMotif(80, 90, 14, seed % 3, 0.4)).toEqual(lab.botehMotif(80, 90, 14, seed % 3, 0.4));
    expect(geo.weaveLayers(seed, 160, 96, 8, 6, 0.3)).toEqual(lab.weaveLayers(seed, 160, 96, 8, 6, 0.3));
    expect(geo.sozniVines(seed, 360, 140, 3, 0.5, 6)).toEqual(lab.sozniVines(seed, 360, 140, 3, 0.5, 6));
    expect(geo.leafDrift(seed, 3, 300, 400)).toEqual(lab.leafDrift(seed, 3, 300, 400));
    expect(geo.confettiParticles(seed, 40)).toEqual(lab.confettiParticles(seed, 40));
  });

  it('shared shapes match exactly', () => {
    expect(geo.chinarLeafPath(40)).toBe(lab.chinarLeafPath(40));
    expect(geo.chinarVeinPath(40)).toBe(lab.chinarVeinPath(40));
    expect(geo.loomGeometry(320, 200, 12, 8)).toEqual(lab.loomGeometry(320, 200, 12, 8));
    expect(geo.gathirMark(512, 0.7)).toEqual(lab.gathirMark(512, 0.7));
    expect(geo.hashString('Pashmina-01')).toBe(lab.hashString('Pashmina-01'));
    const leaf = geo.leafDrift(9, 3, 300, 300)[1];
    expect(geo.leafPose(leaf, 0.4)).toEqual(lab.leafPose(leaf, 0.4));
    const c = geo.confettiParticles(9, 12)[5];
    expect(geo.confettiPose(c, 0.5, 10, 20, 90)).toEqual(lab.confettiPose(c, 0.5, 10, 20, 90));
  });
});

describe('placeholder art', () => {
  const palette = { ground: '#F6ECDD', thread: '#6B5446', inks: ['#C62F17', '#F4A300', '#0B6E77', '#B0124F'] };

  it('takes up to two initials', () => {
    expect(productInitials('Kani jamawar shawl')).toBe('KJ');
    expect(productInitials('  sozni ')).toBe('S');
    expect(productInitials('')).toBe('');
  });

  it('is deterministic per product id and differs between ids', () => {
    const a = placeholderLayers('prod_1', 160, 160, palette);
    expect(a).toEqual(placeholderLayers('prod_1', 160, 160, palette));
    expect(placeholderLayers('prod_2', 160, 160, palette)).not.toEqual(a);
  });
});
