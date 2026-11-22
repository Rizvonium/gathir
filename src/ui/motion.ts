/**
 * Motion tokens (docs/PLAN.md §10). Values come from the expo-animation skill tables.
 * Rules: no animation on tab switches or scrolling; press feedback <= 150 ms;
 * animate transform/opacity only; every animation respects ReduceMotion.System.
 */
import { Easing, ReduceMotion, type WithSpringConfig, type WithTimingConfig } from 'react-native-reanimated';

export const easings = {
  /** Strong ease-out for entering / UI responses. */
  out: Easing.bezier(0.23, 1, 0.32, 1),
  /** On-screen movement. */
  inOut: Easing.bezier(0.77, 0, 0.175, 1),
  /** Sheets. */
  sheet: Easing.bezier(0.32, 0.72, 0, 1),
};

export const durations = {
  press: 120,
  chip: 160,
  count: 180,
  standard: 260,
  stagger: 60,
  celebrate: 1200,
} as const;

export const timing = {
  press: { duration: durations.press, easing: easings.out, reduceMotion: ReduceMotion.System } satisfies WithTimingConfig,
  chip: { duration: durations.chip, easing: easings.out, reduceMotion: ReduceMotion.System } satisfies WithTimingConfig,
  count: { duration: durations.count, easing: easings.out, reduceMotion: ReduceMotion.System } satisfies WithTimingConfig,
  standard: { duration: durations.standard, easing: easings.out, reduceMotion: ReduceMotion.System } satisfies WithTimingConfig,
};

export const springs = {
  settle: { duration: 400, dampingRatio: 1, reduceMotion: ReduceMotion.System } satisfies WithSpringConfig,
  snap: { duration: 400, dampingRatio: 0.8, reduceMotion: ReduceMotion.System } satisfies WithSpringConfig,
  sheet: { duration: 300, dampingRatio: 0.8, reduceMotion: ReduceMotion.System } satisfies WithSpringConfig,
  /** Playful pop for rare moments only (badges, success). */
  bazaar: { duration: 450, dampingRatio: 0.65, reduceMotion: ReduceMotion.System } satisfies WithSpringConfig,
};

export const pressScale = 0.97;
