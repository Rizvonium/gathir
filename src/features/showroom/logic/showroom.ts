/** Showroom rules (PLAN §4.9, §10). Pure; the drift/zoom helpers also run as worklets. */
import { fewThreshold } from '@/db/repo/catalogueData';

/** Idle time before the attract slideshow starts. */
export const IDLE_MS = 45_000;
/** Attract slideshow: one shawl every this many ms. */
export const ATTRACT_STEP_MS = 7_000;
/** Hold the corner mark this long to leave. */
export const EXIT_HOLD_MS = 1_500;
/** One slow Ken Burns pass. */
export const KEN_BURNS_MS = 8_000;
/** Ken Burns zoom at the end of a pass (kept small: the weave must stay sharp). */
export const KEN_BURNS_SCALE = 1.08;

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;
export const DOUBLE_TAP_ZOOM = 2.5;

/** What a customer may see about availability. Never cost, history or sales. */
export type ShowroomAvailability = { kind: 'available' } | { kind: 'few'; count: number } | { kind: 'count'; count: number } | { kind: 'sold_out' };

export function showroomAvailability(totalPieces: number, lowStockLevel: number, showExactCounts: boolean): ShowroomAvailability {
  if (totalPieces <= 0) return { kind: 'sold_out' };
  if (showExactCounts) return { kind: 'count', count: totalPieces };
  if (totalPieces <= fewThreshold(lowStockLevel)) return { kind: 'few', count: totalPieces };
  return { kind: 'available' };
}

/** Next slide in attract mode, wrapping to the first. */
export function nextSlide(index: number, total: number): number {
  return total <= 0 ? 0 : (index + 1) % total;
}

/** Ken Burns drift for a slide: direction alternates so consecutive photos do not move alike. */
/**
 * Whether the Ken Burns drift runs: only on the visible slide, while the Showroom screen is on
 * screen (focused, not under the product card or catalogue it pushed, and the app in the
 * foreground), and reduced motion is off.
 */
export function kenBurnsRunning(state: { active: boolean; onScreen: boolean; reducedMotion: boolean }): boolean {
  return state.active && state.onScreen && !state.reducedMotion;
}

export function kenBurnsPose(index: number, width: number, height: number, t: number): { scale: number; x: number; y: number } {
  'worklet';
  const dirX = index % 2 === 0 ? 1 : -1;
  const dirY = index % 3 === 0 ? -1 : 1;
  const scale = 1 + (KEN_BURNS_SCALE - 1) * t;
  return { scale, x: dirX * width * 0.025 * t, y: dirY * height * 0.015 * t };
}

export function clamp(v: number, min: number, max: number): number {
  'worklet';
  return Math.min(max, Math.max(min, v));
}

/** Soft resistance past a limit (pinch below 1× or beyond 4×, pan past the photo edge). */
export function rubberBand(v: number, min: number, max: number, k = 0.35): number {
  'worklet';
  if (v < min) return min - (min - v) * k;
  if (v > max) return max + (v - max) * k;
  return v;
}

/** How far a zoomed photo may move before its edge shows. */
export function maxOffset(size: number, scale: number): number {
  'worklet';
  return Math.max(0, (size * scale - size) / 2);
}

/** Keeps the point under the fingers fixed while zooming. Offsets are from the centre. */
export function focalOffset(startOffset: number, startFocal: number, focal: number, ratio: number): number {
  'worklet';
  return focal - (startFocal - startOffset) * ratio;
}

/** Offset that brings a double-tapped point (from the top/start edge) towards the centre. */
export function doubleTapOffset(tap: number, size: number, scale: number): number {
  'worklet';
  const m = maxOffset(size, scale);
  return clamp((size / 2 - tap) * (scale - 1), -m, m);
}

/** Unique ids in first-liked order. */
export function addLiked(liked: readonly string[], id: string): string[] {
  return liked.includes(id) ? [...liked] : [...liked, id];
}
