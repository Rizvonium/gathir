import { botehMotif, circlePath, hashString, mulberry32, weaveLayers } from './geometry';
import type { InkLayer } from './picture';

/** Up to two initials from a product name ("Kani jamawar shawl" → "KJ"). Pure. */
export function productInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.slice(0, 2).map((w) => Array.from(w)[0] ?? '');
  return letters.join('').toLocaleUpperCase();
}

export type PlaceholderPalette = { ground: string; thread: string; inks: readonly string[] };

/**
 * SVG layers for a product placeholder, fully determined by the product id: a faint twill
 * ground plus one large boteh motif whose ink, tilt and curl come from the id's hash.
 */
export function placeholderLayers(productId: string, W: number, H: number, palette: PlaceholderPalette): InkLayer[] {
  const seed = hashString(productId);
  const rand = mulberry32(seed);
  const n = palette.inks.length;
  const ink = Math.floor(rand() * n);
  const size = Math.min(W, H) * (0.2 + rand() * 0.06);
  const angle = -0.6 + rand() * 0.9;
  const curl = rand();
  // Sit the bulb in the lower part so the centred initials stay readable.
  const m = botehMotif(W * (0.42 + rand() * 0.2), H * 0.66, size, angle, curl);
  const weave = weaveLayers(seed, W, H, Math.max(6, Math.round(Math.min(W, H) / 18)), 2, 0.2);
  return [
    { svg: weave[0], color: palette.thread, alpha: 0.1 },
    { svg: weave[1], color: palette.inks[(ink + 2) % n], alpha: 0.18 },
    { svg: m.outline, color: palette.inks[ink], stroke: Math.max(1.5, size * 0.1), alpha: 0.9 },
    { svg: m.inner, color: palette.inks[(ink + 1) % n], alpha: 0.9 },
    { svg: m.dots.map((d) => circlePath(d.x, d.y, d.r)).join(''), color: palette.inks[(ink + 3) % n], alpha: 0.9 },
  ];
}
