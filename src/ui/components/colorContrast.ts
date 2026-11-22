import { palette } from '../tokens';

/** Relative luminance (WCAG) of a #RRGGBB colour. Returns 0.5 for anything unparsable. */
export function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0.5;
  const n = parseInt(m[1], 16);
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** Walnut or white, whichever reads better on the given background hex. */
export function readableTextOn(hex: string): string {
  // Contrast against white vs walnut (L≈0.012); pick the larger ratio.
  const l = luminance(hex);
  const onWhite = 1.05 / (l + 0.05);
  const onWalnut = (l + 0.05) / (0.012 + 0.05);
  return onWhite >= onWalnut ? palette.white : palette.walnut;
}
