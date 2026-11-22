/**
 * Minimal Reanimated stand-in for jest-expo component tests: Reanimated 4's own mock boots the
 * native worklets runtime, which Jest cannot load. Animations resolve to their end values.
 */
import { Text, View } from 'react-native';

type Builder = { [key: string]: (...args: unknown[]) => Builder };

function builder(): Builder {
  const b: Builder = new Proxy({} as Builder, { get: () => () => b });
  return b;
}

const identityEasing = () => (t: number) => t;

export const ReduceMotion = { System: 'system', Always: 'always', Never: 'never' } as const;
export const Easing = {
  bezier: identityEasing,
  inOut: identityEasing,
  in: identityEasing,
  out: identityEasing,
  quad: (t: number) => t,
  linear: (t: number) => t,
};
export const cubicBezier = () => 'ease';
export const useSharedValue = <T,>(initial: T) => {
  let v = initial;
  return {
    get: () => v,
    set: (next: T | ((p: T) => T)) => {
      v = typeof next === 'function' ? (next as (p: T) => T)(v) : next;
    },
    value: initial,
  };
};
export const useAnimatedStyle = () => ({});
export const withTiming = <T,>(v: T) => v;
export const withSpring = <T,>(v: T) => v;
export const withRepeat = <T,>(v: T) => v;
/** A sequence settles on its last step. */
export const withSequence = <T,>(...steps: T[]) => steps[steps.length - 1];
export const withDelay = <T,>(_ms: number, v: T) => v;
export const useDerivedValue = <T,>(fn: () => T) => {
  const v = fn();
  return { get: () => v, set: () => undefined, value: v };
};
export const useAnimatedReaction = () => undefined;
export const useFrameCallback = () => ({ setActive: () => undefined, isActive: false });
export const useReducedMotion = () => false;
export const runOnJS = <F,>(fn: F) => fn;
export const cancelAnimation = () => undefined;
export const createAnimatedComponent = <C,>(c: C) => c;
export const FadeIn = builder();
export const FadeInDown = builder();
export const FadeOut = builder();
export const FadeInUp = builder();
export const FadeOutDown = builder();
export const FadeOutUp = builder();
export const ZoomIn = builder();
export const ZoomOut = builder();
export const LinearTransition = builder();
export const Layout = builder();

const Animated = { View, Text, createAnimatedComponent };
export default Animated;
