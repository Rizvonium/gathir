import { botehBorderSvg, hashSeed, kaniCornerSvg, mulberry32, patternPalettes, placeholderSvg, sozniVineSvg } from '../patterns';

const KB = 1024;
const bytes = (s: string) => Buffer.byteLength(s, 'utf8');

describe('mulberry32 / hashSeed', () => {
  it('is deterministic and in [0, 1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 50 }, () => a());
    expect(Array.from({ length: 50 }, () => b())).toEqual(seqA);
    expect(seqA.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(mulberry32(43)()).not.toBe(seqA[0]);
  });
  it('hashes strings stably', () => {
    expect(hashSeed('Kashmir Looms')).toBe(hashSeed('Kashmir Looms'));
    expect(hashSeed('a')).not.toBe(hashSeed('b'));
  });
});

describe('SVG generators', () => {
  const cases: [string, (seed: number) => string, number][] = [
    ['boteh border (A4 cover)', (seed) => botehBorderSvg({ seed, width: 544, height: 770, palette: patternPalettes.bazaar, band: 40 }), 30 * KB],
    ['boteh border (default band)', (seed) => botehBorderSvg({ seed, width: 400, height: 300, palette: patternPalettes.ivory }), 30 * KB],
    ['sozni vine', (seed) => sozniVineSvg({ seed, width: 640, height: 32, palette: patternPalettes.bazaar }), 30 * KB],
    ['kani corner', (seed) => kaniCornerSvg({ seed, size: 120, palette: patternPalettes.ivory }), 30 * KB],
    ['placeholder', (seed) => placeholderSvg({ seed, width: 180, height: 240, palette: patternPalettes.bazaar, initials: 'SS' }), 30 * KB],
  ];
  it.each(cases)('%s: same seed → same SVG, other seeds vary, under budget', (_name, make, budget) => {
    const a = make(7);
    expect(make(7)).toBe(a);
    expect(new Set([1, 2, 3, 4, 5, 6].map(make)).size).toBeGreaterThan(1);
    expect(a.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(a.endsWith('</svg>')).toBe(true);
    expect(a).not.toMatch(/NaN|undefined|Infinity/);
    expect(bytes(a)).toBeLessThan(budget);
  });
  it('escapes placeholder initials', () => {
    const svg = placeholderSvg({ seed: 1, width: 100, height: 100, palette: patternPalettes.bazaar, initials: '<&' });
    expect(svg).toContain('>&lt;&amp;</text>');
  });
});
