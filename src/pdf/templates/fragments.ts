/** Small HTML fragments shared by the PDF templates. All inputs are escaped here. */
import { PDF_DISPLAY_FAMILY } from '../fontFamilies';
import { escapeHtml, initials, safeHex, safeImageSrc } from '../html';
import { hashSeed, patternPalettes, placeholderSvg, type PatternPalette } from '../patterns';

/** A colour dot; 'multi' (or an invalid hex) is drawn striped. */
export function colourDot(hex: string): string {
  const safe = safeHex(hex);
  return hex === 'multi' || !safe ? '<i class="dot multi"></i>' : `<i class="dot" style="background:${safe}"></i>`;
}

/** The photo as <img>, or a seeded pattern placeholder with the product's initials. */
export function photoOrPlaceholder(opts: {
  dataUri: string | null;
  name: string;
  seedKey: string;
  palette?: PatternPalette;
  width?: number;
  height?: number;
}): string {
  const src = safeImageSrc(opts.dataUri);
  if (src) return `<img src="${src}" alt="${escapeHtml(opts.name)}">`;
  return placeholderSvg({
    seed: hashSeed(opts.seedKey),
    width: opts.width ?? 120,
    height: opts.height ?? 120,
    palette: opts.palette ?? patternPalettes.bazaar,
    initials: initials(opts.name),
    fontFamily: PDF_DISPLAY_FAMILY,
  });
}
