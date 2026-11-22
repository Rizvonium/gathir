import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../theme';
import { colorTransition } from './cssMotion';
import { useReduceMotionEnabled } from './useReduceMotionEnabled';

export type ProgressDotsProps = {
  total: number;
  /** Zero-based current step. */
  current: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Wizard step indicator. Done and current steps fill with primary; the current one is a
 * longer pill. Colour cross-fades (160 ms). Announced as "Step 2 of 3".
 */
export function ProgressDots({ total, current, style }: ProgressDotsProps) {
  const { colors, space, radius } = useTheme();
  const { t } = useTranslation('ui');
  const reduced = useReduceMotionEnabled();
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t('progress.step', { current: current + 1, total })}
      accessibilityValue={{ min: 1, max: total, now: current + 1 }}
      style={[styles.row, { gap: space.xs }, style]}>
      {Array.from({ length: total }, (_, i) => (
        <Animated.View
          key={i}
          style={{
            width: i === current ? 24 : 8,
            height: 8,
            borderRadius: radius.pill,
            backgroundColor: i <= current ? colors.primary : colors.border,
            ...colorTransition(['backgroundColor'], reduced),
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
