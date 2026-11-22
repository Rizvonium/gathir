import { cubicBezier } from 'react-native-reanimated';

import { durations } from '../motion';

/** Strong ease-out for Reanimated CSS transitions (CSS styles need cubicBezier, not Easing.bezier). */
export const cssEaseOut = cubicBezier(0.23, 1, 0.32, 1);

/** Same curve as `cssEaseOut`, in CSS shorthand form. */
const EASE_OUT_SHORTHAND = 'cubic-bezier(0.23, 1, 0.32, 1)';

const toKebab = (prop: string) => prop.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/**
 * Transition style for a colour cross-fade (chip token, 160 ms). Instant when motion is reduced.
 *
 * Uses the `transition` shorthand (parsed by Reanimated on the UI thread) rather than
 * `transitionTimingFunction: cubicBezier(...)`: `expo-env.d.ts` pulls in expo's
 * react-native-web style augmentation, which types `transitionTimingFunction` as
 * `string | Function` and rejects Reanimated's easing object at type-check time.
 */
export function colorTransition(properties: string[], reduced: boolean) {
  const duration = reduced ? 0 : durations.chip;
  return {
    transition: properties.map((p) => `${toKebab(p)} ${duration}ms ${EASE_OUT_SHORTHAND}`).join(', '),
  };
}
