/**
 * Pinch-zoom maths for the product photo viewer. Plain worklet functions: they run on the UI
 * thread inside gesture callbacks and in Node tests.
 */
export const MIN_SCALE = 1;
export const MAX_SCALE = 4;
export const DOUBLE_TAP_SCALE = 2.5;
/** How much of an over-pull is let through past a limit (rubber band). */
const RUBBER = 0.35;

/** Rubber-band a value past [min, max]: past the edge it moves at a fraction of the finger. */
export function rubberBand(value: number, min: number, max: number): number {
  'worklet';
  if (value < min) return min - (min - value) * RUBBER;
  if (value > max) return max + (value - max) * RUBBER;
  return value;
}

export function clamp(value: number, min: number, max: number): number {
  'worklet';
  return Math.min(max, Math.max(min, value));
}

/** Largest translation that keeps the zoomed image covering the frame on one axis. */
export function maxOffset(size: number, scale: number): number {
  'worklet';
  return Math.max(0, (size * scale - size) / 2);
}

/**
 * Translation that keeps the point under the fingers still while zooming.
 * `focal` and `startFocal` are measured from the frame centre.
 */
export function focalOffset(startOffset: number, startFocal: number, focal: number, ratio: number): number {
  'worklet';
  return focal - (startFocal - startOffset) * ratio;
}

/** Offset for a double-tap zoom to `scale` centred on the tapped point (`tap` from the frame start). */
export function doubleTapOffset(tap: number, size: number, scale: number): number {
  'worklet';
  return clamp(-(tap - size / 2) * (scale - 1), -maxOffset(size, scale), maxOffset(size, scale));
}
