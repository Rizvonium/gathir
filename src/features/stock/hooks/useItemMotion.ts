/**
 * Two small list-item motions (PLAN §10):
 * - `usePopIn`: a just-saved product pops into the grid once (springBazaar). Rare → delight.
 * - `useCollapseOut`: a deleted row fades and shrinks before it leaves (state change), then
 *   the write runs. Both are transform/opacity on the UI thread and respect ReduceMotion.System.
 */
import { useEffect } from 'react';
import { ReduceMotion, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { durations, easings, springs } from '@/ui/motion';

import { useDraftStore } from '../store/draftStore';

const POP_FROM = 0.9;
const COLLAPSE_TO = 0.92;

/**
 * Scale/opacity style for one list item, keyed by product id (resets when a recycled cell shows
 * another product). The save pop waits until the list screen is `visible` so it is actually seen.
 */
export function useItemMotion(productId: string, visible = true) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const justSavedId = useDraftStore((s) => s.justSavedId);
  const markSaved = useDraftStore((s) => s.markSaved);

  useEffect(() => {
    // Recycled cell or restored item: always start visible.
    scale.set(1);
    opacity.set(1);
  }, [productId, scale, opacity]);

  useEffect(() => {
    if (!visible || justSavedId !== productId) return;
    markSaved(null);
    scale.set(POP_FROM);
    opacity.set(0);
    opacity.set(withTiming(1, { duration: durations.chip, easing: easings.out, reduceMotion: ReduceMotion.System }));
    scale.set(withSpring(1, springs.bazaar));
  }, [visible, justSavedId, productId, markSaved, scale, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.get(), transform: [{ scale: scale.get() }] }));

  /** Plays the collapse, then runs `commit` on the JS thread (immediately with reduced motion). */
  const collapseThen = (commit: () => void) => {
    const config = { duration: durations.standard, easing: easings.out, reduceMotion: ReduceMotion.System };
    scale.set(withTiming(COLLAPSE_TO, config));
    opacity.set(
      withTiming(0, config, (finished) => {
        'worklet';
        if (finished) scheduleOnRN(commit);
      }),
    );
  };

  return { style, collapseThen };
}
