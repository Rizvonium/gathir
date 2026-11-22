import type { SkPicture } from '@shopify/react-native-skia';

import { recordLayers } from './picture';
import { placeholderLayers, type PlaceholderPalette } from './placeholderArt';

const MAX_CACHED = 48;
const cache = new Map<string, SkPicture>();

/**
 * Recorded placeholder picture, memoised in a small LRU so scrolling a grid back and forth
 * never re-runs the geometry. Key = id + size + palette.
 */
export function placeholderPicture(productId: string, W: number, H: number, palette: PlaceholderPalette): SkPicture {
  const key = `${productId}|${W}x${H}|${palette.ground}|${palette.inks.join(',')}`;
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const picture = recordLayers(W, H, placeholderLayers(productId, W, H, palette), palette.ground);
  cache.set(key, picture);
  if (cache.size > MAX_CACHED) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  return picture;
}
