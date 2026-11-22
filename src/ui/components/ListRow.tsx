import type { ReactNode } from 'react';
import { I18nManager, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme';
import { AppText } from './AppText';
import { Icon } from './Icon';

export type ListRowProps = {
  title: string;
  subtitle?: string;
  /** Start slot: Avatar, Thumbnail or ColourSwatch. */
  leading?: ReactNode;
  /** End slot: PieceBadge, amount, switch… */
  trailing?: ReactNode;
  onPress?: () => void;
  /** Show a navigation chevron. Defaults to true when the row is pressable. */
  chevron?: boolean;
  /** TalkBack label for the whole row; defaults to title + subtitle. */
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Full-width list row (≥56dp). Pressed state highlights the background instead of
 * scaling (a scaling row reads as the screen squishing). Chevron flips in RTL.
 */
export function ListRow({ title, subtitle, leading, trailing, onPress, chevron, accessibilityLabel, testID, style }: ListRowProps) {
  const { colors, space } = useTheme();
  const showChevron = chevron ?? !!onPress;
  const label = accessibilityLabel ?? (subtitle ? `${title}, ${subtitle}` : title);

  const content = (
    <>
      {leading ? <View>{leading}</View> : null}
      <View style={styles.text}>
        <AppText weight="semibold" numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="small" muted numberOfLines={2}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {trailing ? <View>{trailing}</View> : null}
      {showChevron ? (
        <Icon name="chevron-right" tone="textMuted" style={I18nManager.isRTL ? styles.flip : undefined} />
      ) : null}
    </>
  );
  const rowStyle = [styles.row, { paddingHorizontal: space.lg, paddingVertical: space.sm, gap: space.md }];

  if (!onPress) {
    return (
      <View testID={testID} style={[rowStyle, style]} accessible accessibilityLabel={label}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [rowStyle, pressed && { backgroundColor: colors.surfaceSunken }, style]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 56 },
  text: { flex: 1, minWidth: 0 },
  flip: { transform: [{ scaleX: -1 }] },
});
