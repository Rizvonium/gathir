import { useEffect } from 'react';
import type { DimensionValue, StyleProp, ViewStyle } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { useTheme } from '../theme';
import { useReduceMotionEnabled } from './useReduceMotionEnabled';

export type SkeletonProps = {
  width?: DimensionValue;
  height?: number;
  rounded?: 'sm' | 'md' | 'card' | 'pill';
  style?: StyleProp<ViewStyle>;
};

/**
 * Placeholder block for content that takes a moment (e.g. decoding photos). Gently pulses
 * opacity only while "Remove animations" is off; otherwise static. Hidden from TalkBack.
 */
export function Skeleton({ width = '100%', height = 16, rounded = 'sm', style }: SkeletonProps) {
  const { colors, radius } = useTheme();
  const reduced = useReduceMotionEnabled();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (reduced) {
      cancelAnimation(opacity);
      opacity.set(1);
      return;
    }
    opacity.set(withRepeat(withTiming(0.5, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true));
    return () => cancelAnimation(opacity);
  }, [reduced, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return (
    <Animated.View
      importantForAccessibility="no-hide-descendants"
      style={[{ width, height, borderRadius: radius[rounded], backgroundColor: colors.surfaceSunken }, style, animatedStyle]}
    />
  );
}
