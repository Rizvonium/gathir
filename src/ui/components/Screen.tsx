import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme';
import { AppText } from './AppText';

export type ScreenEdge = 'top' | 'bottom';

export type ScreenProps = {
  children?: ReactNode;
  /** Large Fraunces page title. Omit when the native stack header shows the title. */
  title?: string;
  subtitle?: string;
  /** Start-side header slot, e.g. a back IconButton. */
  leading?: ReactNode;
  /** End-side header actions (IconButtons). */
  actions?: ReactNode;
  /** Wrap content in a keyboard-aware ScrollView (forms, long pages). Lists should pass false and use FlashList. */
  scroll?: boolean;
  /** Sticky bottom area (primary action in the thumb zone). Rides above the keyboard. */
  footer?: ReactNode;
  /** Safe-area edges to pad. Default: top only (tabs handle the bottom). */
  edges?: ScreenEdge[];
  /** Horizontal 16dp gutter on content. Default true. */
  padded?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Page container: theme background, safe areas, optional large title header, optional
 * keyboard-aware scroll and a sticky footer for the main action.
 */
export function Screen({
  children,
  title,
  subtitle,
  leading,
  actions,
  scroll = false,
  footer,
  edges = ['top'],
  padded = true,
  contentStyle,
  testID,
}: ScreenProps) {
  const { colors, space } = useTheme();
  const insets = useSafeAreaInsets();
  const top = edges.includes('top') ? insets.top : 0;
  const bottom = edges.includes('bottom') ? insets.bottom : 0;
  const gutter = padded ? space.lg : 0;

  const header =
    title || leading || actions ? (
      <View style={[styles.header, { paddingHorizontal: space.lg, paddingTop: space.md, gap: space.sm }]}>
        {leading ? <View style={styles.leading}>{leading}</View> : null}
        <View style={styles.titleBlock}>
          {title ? (
            <AppText variant="display" accessibilityRole="header">
              {title}
            </AppText>
          ) : null}
          {subtitle ? <AppText muted>{subtitle}</AppText> : null}
        </View>
        {actions ? <View style={[styles.actions, { gap: space.xs }]}>{actions}</View> : null}
      </View>
    ) : null;

  const body = scroll ? (
    <KeyboardAwareScrollView
      style={styles.flex}
      bottomOffset={space.xl}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        { paddingHorizontal: gutter, paddingTop: space.lg, paddingBottom: footer ? space.lg : bottom + space.xxl, gap: space.lg },
        contentStyle,
      ]}>
      {children}
    </KeyboardAwareScrollView>
  ) : (
    <View style={[styles.flex, { paddingHorizontal: gutter, paddingBottom: footer ? 0 : bottom }, contentStyle]}>{children}</View>
  );

  return (
    <View testID={testID} style={[styles.flex, { backgroundColor: colors.bg, paddingTop: top }]}>
      {header}
      {body}
      {footer ? (
        <KeyboardStickyView offset={{ opened: bottom }}>
          <View
            style={[
              styles.footer,
              {
                paddingHorizontal: space.lg,
                paddingTop: space.md,
                paddingBottom: bottom + space.md,
                backgroundColor: colors.bg,
                borderTopColor: colors.border,
                gap: space.sm,
              },
            ]}>
            {footer}
          </View>
        </KeyboardStickyView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-start' },
  leading: { marginStart: -12, justifyContent: 'center' },
  titleBlock: { flex: 1, minWidth: 0 },
  actions: { flexDirection: 'row', alignItems: 'center', marginEnd: -12 },
  footer: { borderTopWidth: StyleSheet.hairlineWidth },
});
