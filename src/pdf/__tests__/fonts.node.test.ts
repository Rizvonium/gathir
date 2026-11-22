const mockDownload = jest.fn();
const mockBase64 = jest.fn();

jest.mock('expo-asset', () => ({
  Asset: { fromModule: (m: number) => ({ localUri: `file:///font-${m}.ttf`, uri: '', downloadAsync: () => mockDownload(m) }) },
}));
jest.mock('expo-file-system', () => ({
  File: function MockFile(this: { base64: () => Promise<string> }, mockUri: string) {
    this.base64 = () => mockBase64(mockUri);
  },
}));
jest.mock('@expo-google-fonts/fraunces/600SemiBold', () => ({ Fraunces_600SemiBold: 1 }));
jest.mock('@expo-google-fonts/fraunces/700Bold', () => ({ Fraunces_700Bold: 2 }));
jest.mock('@expo-google-fonts/manrope/400Regular', () => ({ Manrope_400Regular: 3 }));
jest.mock('@expo-google-fonts/manrope/600SemiBold', () => ({ Manrope_600SemiBold: 4 }));
jest.mock('@expo-google-fonts/manrope/700Bold', () => ({ Manrope_700Bold: 5 }));

import { buildFontFaceCss, clearPdfFontCache, getPdfFontCss } from '../fonts';

beforeEach(() => {
  clearPdfFontCache();
  mockDownload.mockReset().mockResolvedValue(undefined);
  mockBase64.mockReset().mockResolvedValue('QUJD');
});

describe('PDF fonts', () => {
  it('builds @font-face rules', () => {
    const css = buildFontFaceCss([{ family: 'Gathir Display', weight: 700, base64: 'QUJD' }]);
    expect(css).toContain('font-family:"Gathir Display"');
    expect(css).toContain('font-weight:700');
    expect(css).toContain('url(data:font/ttf;base64,QUJD) format("truetype")');
  });
  it('embeds all five faces once and caches the result', async () => {
    const css = await getPdfFontCss();
    expect((css.match(/@font-face/g) ?? []).length).toBe(5);
    await getPdfFontCss();
    expect(mockBase64).toHaveBeenCalledTimes(5);
  });
  it('skips faces that fail and falls back to empty CSS when none load', async () => {
    mockBase64.mockImplementation((uri: string) => (uri.includes('font-1') ? Promise.reject(new Error('io')) : Promise.resolve('QUJD')));
    expect(((await getPdfFontCss()).match(/@font-face/g) ?? []).length).toBe(4);
    clearPdfFontCache();
    mockDownload.mockRejectedValue(new Error('no asset'));
    await expect(getPdfFontCss()).resolves.toBe('');
  });
});
