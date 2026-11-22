import { ClipOp, createPicture, PaintStyle, Skia, StrokeCap, StrokeJoin, type SkPicture } from '@shopify/react-native-skia';

import { toSkPath } from './skPath';

/** One ink layer of a static pattern: an SVG path filled or stroked in one colour. */
export type InkLayer = {
  svg: string;
  color: string;
  /** Stroke width; omit to fill. */
  stroke?: number;
  /** 0..1 layer opacity (default 1). */
  alpha?: number;
};

/**
 * Record static pattern layers into an SkPicture once, clipped to width×height. Drawing a
 * picture replays recorded commands: far cheaper than a tree of <Path> nodes per frame.
 * Call from useMemo (or a cache), never during animation.
 */
export function recordLayers(width: number, height: number, layers: readonly InkLayer[], background?: string): SkPicture {
  const bounds = Skia.XYWHRect(0, 0, width, height);
  return createPicture((canvas) => {
    canvas.clipRect(bounds, ClipOp.Intersect, true);
    const paint = Skia.Paint();
    paint.setAntiAlias(true);
    if (background) {
      paint.setColor(Skia.Color(background));
      canvas.drawRect(bounds, paint);
    }
    for (const layer of layers) {
      if (!layer.svg) continue;
      paint.setColor(Skia.Color(layer.color));
      paint.setAlphaf(layer.alpha ?? 1);
      if (layer.stroke !== undefined) {
        paint.setStyle(PaintStyle.Stroke);
        paint.setStrokeWidth(layer.stroke);
        paint.setStrokeCap(StrokeCap.Round);
        paint.setStrokeJoin(StrokeJoin.Round);
      } else {
        paint.setStyle(PaintStyle.Fill);
      }
      canvas.drawPath(toSkPath(layer.svg), paint);
    }
  }, bounds);
}
