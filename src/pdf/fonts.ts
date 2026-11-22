/**
 * Embeds the brand fonts (Fraunces 600/700, Manrope 400/600/700) into PDF HTML as base64
 * @font-face rules. The print WebView cannot see app-registered fonts, so they travel inside
 * the HTML. Loaded once per app run and cached; on any failure the CSS falls back to the
 * system serif / sans-serif stacks declared in ./styles/base.ts.
 */
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';

import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces/600SemiBold';
import { Fraunces_700Bold } from '@expo-google-fonts/fraunces/700Bold';
import { Manrope_400Regular } from '@expo-google-fonts/manrope/400Regular';
import { Manrope_600SemiBold } from '@expo-google-fonts/manrope/600SemiBold';
import { Manrope_700Bold } from '@expo-google-fonts/manrope/700Bold';

import { PDF_DISPLAY_FAMILY, PDF_TEXT_FAMILY } from './fontFamilies';

export { PDF_DISPLAY_FAMILY, PDF_TEXT_FAMILY };

export type PdfFontFace = { family: string; weight: 400 | 600 | 700; base64: string };

type FontSource = { family: string; weight: PdfFontFace['weight']; module: number };

const SOURCES: FontSource[] = [
  { family: PDF_DISPLAY_FAMILY, weight: 600, module: Fraunces_600SemiBold },
  { family: PDF_DISPLAY_FAMILY, weight: 700, module: Fraunces_700Bold },
  { family: PDF_TEXT_FAMILY, weight: 400, module: Manrope_400Regular },
  { family: PDF_TEXT_FAMILY, weight: 600, module: Manrope_600SemiBold },
  { family: PDF_TEXT_FAMILY, weight: 700, module: Manrope_700Bold },
];

/** Builds @font-face rules from base64 TTF data. Pure (tested in Node). */
export function buildFontFaceCss(faces: readonly PdfFontFace[]): string {
  return faces
    .map(
      (f) =>
        `@font-face{font-family:"${f.family}";font-style:normal;font-weight:${f.weight};font-display:block;` +
        `src:url(data:font/ttf;base64,${f.base64}) format("truetype");}`,
    )
    .join('\n');
}

async function loadFace(source: FontSource): Promise<PdfFontFace | null> {
  try {
    const asset = Asset.fromModule(source.module);
    await asset.downloadAsync();
    const uri = asset.localUri ?? asset.uri;
    const base64 = await new File(uri).base64();
    return base64 ? { family: source.family, weight: source.weight, base64 } : null;
  } catch {
    return null;
  }
}

let cached: Promise<string> | null = null;

/**
 * @font-face CSS with all PDF fonts embedded. Resolves to '' if nothing could be loaded
 * (templates then use system fonts). Never rejects. Cached in memory after the first call.
 */
export function getPdfFontCss(): Promise<string> {
  if (!cached) {
    cached = Promise.all(SOURCES.map(loadFace)).then((faces) => {
      const ok = faces.filter((f): f is PdfFontFace => f !== null);
      if (ok.length === 0) cached = null; // try again next time
      return buildFontFaceCss(ok);
    });
  }
  return cached;
}

/** Forgets the cached CSS (tests, or after low-memory warnings). */
export function clearPdfFontCache(): void {
  cached = null;
}
