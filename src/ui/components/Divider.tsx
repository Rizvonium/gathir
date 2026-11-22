import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme';

export type DividerProps = {
  /** Start inset in dp (e.g. to align with row text after an avatar). */
  inset?: number;
  style?: StyleProp<ViewStyle>;
};

/** Hairline separator in the border colour. Decorative: hidden from TalkBack. */
export function Divider({ inset = 0, style }: DividerProps) {
  const { colors } = useTheme();
  return (
    <View
      importantForAccessibility="no"
      style={[{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginStart: inset }, style]}
    />
  );
}
