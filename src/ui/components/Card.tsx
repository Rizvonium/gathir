import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme';
import { PressableScale } from './PressableScale';
import { warmShadow } from './surface';

export type CardProps = {
  children?: ReactNode;
  /** Makes the whole card a button (scale feedback). Give it an accessibilityLabel. */
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** Inner padding token. Default `lg` (16). Use `none` for full-bleed media. */
  padding?: 'none' | 'md' | 'lg' | 'xl';
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

/** Surface with radius 20, 1px border and a soft warm shadow. Composes children. */
export function Card({ children, onPress, accessibilityLabel, accessibilityHint, padding = 'lg', testID, style }: CardProps) {
  const { colors, radius, space, scheme } = useTheme();
  const cardStyle: StyleProp<ViewStyle> = [
    styles.base,
    {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radius.card,
      padding: padding === 'none' ? 0 : space[padding],
    },
    warmShadow(scheme),
    style,
  ];
  if (onPress) {
    return (
      <PressableScale
        testID={testID}
        onPress={onPress}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        style={cardStyle}>
        {children}
      </PressableScale>
    );
  }
  return (
    <View testID={testID} style={cardStyle} accessible={!!accessibilityLabel} accessibilityLabel={accessibilityLabel}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { borderWidth: 1, overflow: 'hidden' },
});
