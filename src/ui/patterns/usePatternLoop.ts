import { useIsFocused } from 'expo-router';

import { useAppActive } from './useAppActive';
import { useReducedMotionLive } from './useReducedMotionLive';

export type PatternLoopState = {
  /** True when the loop should advance this frame. */
  running: boolean;
  /** True when the system asks for reduced motion: draw the static frame instead. */
  reduced: boolean;
};

/**
 * Decides whether an ambient pattern loop may run: the screen is focused, the app is in the
 * foreground, the caller has not paused it, and reduced motion is off.
 * Must be rendered inside an Expo Router screen (uses useIsFocused).
 */
export function usePatternLoop(paused = false): PatternLoopState {
  const focused = useIsFocused();
  const appActive = useAppActive();
  const reduced = useReducedMotionLive();
  return { running: focused && appActive && !paused && !reduced, reduced };
}
