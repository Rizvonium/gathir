import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme';
import { touchTarget } from '../tokens';
import { AppText } from './AppText';

export type SectionHeaderProps = {
  title: string;
  /** Link text on the end side, e.g. "See all". */
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
};

/** Section title (heading role) with an optional end-aligned text link. */
export function SectionHeader({ title, actionLabel, onAction, style }: SectionHeaderProps) {
  const { colors, space } = useTheme();
  return (
    <View style={[styles.row, { gap: space.md }, style]}>
      <AppText variant="title" accessibilityRole="header" style={styles.title}>
        {title}
      </AppText>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="link"
          accessibilityLabel={actionLabel}
          hitSlop={8}
          style={({ pressed }) => [styles.action, { opacity: pressed ? 0.6 : 1 }]}>
          <AppText variant="small" weight="bold" color={colors.teal}>
            {actionLabel}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: touchTarget },
  title: { flex: 1 },
  action: { minHeight: touchTarget, justifyContent: 'center', paddingHorizontal: 4 },
});
