import { billFileBaseName, catalogueFileBaseName, ownerReportFileBaseName, sanitizeFileName } from '../fileNames';
import { estimateCatalogueSize, formatBytes, splitForSize } from '../size';
import { NOW } from './fixtures';

describe('sanitizeFileName', () => {
  it('removes path separators, reserved and control characters', () => {
    expect(sanitizeFileName('a/b\\c:d*e?f"g<h>i|j')).toBe('a b c d e f g h i j');
    expect(sanitizeFileName('Shop\u0000\u001fName')).toBe('ShopName');
    expect(sanitizeFileName('../../etc/passwd')).toBe('etc passwd');
  });
  it('collapses spaces, trims dots and never returns empty', () => {
    expect(sanitizeFileName('  Kashmir   Looms.  ')).toBe('Kashmir Looms');
    expect(sanitizeFileName('...')).toBe('Document');
    expect(sanitizeFileName('', 'Bill')).toBe('Bill');
  });
  it('keeps non-Latin shop names and caps the length', () => {
    expect(sanitizeFileName('کشمیر لومز')).toBe('کشمیر لومز');
    expect(Array.from(sanitizeFileName('x'.repeat(300))).length).toBe(100);
  });
  it('builds friendly names', () => {
    expect(catalogueFileBaseName('Kashmir/Looms', NOW)).toBe('Catalogue - Kashmir Looms - 22 Nov 2026');
    expect(catalogueFileBaseName('Kashmir Looms', NOW, { index: 2, total: 3 })).toBe('Catalogue - Kashmir Looms - 22 Nov 2026 - Part 2 of 3');
    expect(ownerReportFileBaseName('Kashmir Looms', 12, NOW)).toBe('Sales report 12 - Kashmir Looms - 22 Nov 2026');
    expect(billFileBaseName('B-2026-0007', 'Kashmir Looms')).toBe('Bill B-2026-0007 - Kashmir Looms');
  });
});

describe('size budget', () => {
  it('keeps a 60-item catalogue under ~8 MB', () => {
    expect(estimateCatalogueSize(60)).toBeLessThan(8 * 1024 * 1024);
    expect(estimateCatalogueSize(0)).toBeGreaterThan(0);
    expect(formatBytes(estimateCatalogueSize(60))).toMatch(/MB$/);
    expect(formatBytes(2048)).toBe('2 KB');
  });
  it('splits large catalogues into balanced parts of at most 120', () => {
    const items = Array.from({ length: 130 }, (_, i) => i);
    const parts = splitForSize(items);
    expect(parts.map((p) => p.length)).toEqual([65, 65]);
    expect(parts.flat()).toEqual(items);
    expect(splitForSize(Array.from({ length: 241 }, (_, i) => i)).map((p) => p.length)).toEqual([81, 80, 80]);
    expect(splitForSize([1, 2, 3])).toEqual([[1, 2, 3]]);
    expect(splitForSize([])).toEqual([[]]);
    expect(splitForSize([1, 2, 3, 4, 5], 2).map((p) => p.length)).toEqual([2, 2, 1]);
  });
});
