import { cubicBezier } from 'react-native-reanimated';

import { durations } from '../motion';

/** Strong ease-out for Reanimated CSS transitions (CSS styles need cubicBezier, not Easing.bezier). */
export const cssEaseOut = cubicBezier(0.23, 1, 0.32, 1);

/** Transition style for a colour cross-fade (chip token, 160 ms). Instant when motion is reduced. */
export function colorTransition<P extends string>(properties: P[], reduced: boolean) {
  return {
    transitionProperty: properties,
    transitionDuration: reduced ? 0 : durations.chip,
    transitionTimingFunction: cssEaseOut,
  };
}
