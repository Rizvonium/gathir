import type { ComponentRef, Ref } from 'react';
import { Pressable, type GestureResponderEvent, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { pressScale, timing } from '../motion';
import { playHaptic, type HapticKind } from './haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type PressableScaleProps = Omit<PressableProps, 'style' | 'children'> & {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Haptic fired on press (not on press-in). */
  haptic?: HapticKind;
  /** Scale while pressed. Defaults to the 0.97 motion token. */
  scaleTo?: number;
  ref?: Ref<ComponentRef<typeof Pressable>>;
};

/**
 * Base pressable for button-like controls: scales to 0.97 in 120 ms on the UI thread on
 * press-in (ReduceMotion.System via motion tokens), dims when disabled, optional haptic.
 * Full-width rows should use ListRow (background highlight) instead.
 */
export function PressableScale({
  children,
  style,
  haptic,
  scaleTo = pressScale,
  disabled,
  onPressIn,
  onPressOut,
  onPress,
  accessibilityRole = 'button',
  accessibilityState,
  ref,
  ...rest
}: PressableScaleProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const isDisabled = !!disabled;

  const handlePressIn = (e: GestureResponderEvent) => {
    scale.set(withTiming(scaleTo, timing.press));
    onPressIn?.(e);
  };
  const handlePressOut = (e: GestureResponderEvent) => {
    scale.set(withTiming(1, timing.press));
    onPressOut?.(e);
  };
  const handlePress = (e: GestureResponderEvent) => {
    if (haptic) playHaptic(haptic);
    onPress?.(e);
  };

  return (
    <AnimatedPressable
      ref={ref}
      disabled={isDisabled}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ ...accessibilityState, disabled: isDisabled }}
      pressRetentionOffset={16}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      style={[style, isDisabled && disabledStyle, animatedStyle]}
      {...rest}>
      {children}
    </AnimatedPressable>
  );
}

const disabledStyle: ViewStyle = { opacity: 0.4 };
