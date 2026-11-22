import { Skia, type SkPath } from '@shopify/react-native-skia';

/**
 * Parse an SVG path string from geometry.ts into an SkPath (empty path on bad input).
 * Call from useMemo so parsing happens once per geometry change, never per frame.
 */
export function toSkPath(svg: string): SkPath {
  return (svg ? Skia.Path.MakeFromSVGString(svg) : null) ?? Skia.Path.Make();
}
