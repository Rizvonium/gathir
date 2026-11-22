import { useState, type ComponentRef, type ReactNode, type Ref } from 'react';
import { StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';

import { useTheme } from '../theme';
import { AppText } from './AppText';
import { Icon } from './Icon';

export type TextFieldProps = Omit<TextInputProps, 'style' | 'placeholderTextColor'> & {
  /** Visible label above the field; also the TalkBack name. */
  label: string;
  /** Hint under the field. Replaced by `error` when present. */
  helper?: string;
  /** Error message (shown with an icon, read by TalkBack). */
  error?: string;
  /** Fixed text before the input, e.g. "₹" or "+91". */
  prefix?: string;
  /** Fixed text or node after the input, e.g. "pcs" or an IconButton. */
  suffix?: ReactNode;
  /** Text alignment inside the field: start (default) or end (amounts). */
  align?: 'start' | 'end';
  /** Large tabular digits for money and counts. */
  numeric?: boolean;
  style?: StyleProp<ViewStyle>;
  ref?: Ref<ComponentRef<typeof TextInput>>;
};

/**
 * Labelled text input on a sunken well (≥56dp). Focus shows a chinar border; errors show a
 * danger border plus icon and text. Supports prefix/suffix, multiline and start/end alignment.
 */
export function TextField({
  label,
  helper,
  error,
  prefix,
  suffix,
  align = 'start',
  numeric = false,
  multiline,
  style,
  onFocus,
  onBlur,
  editable = true,
  ref,
  ...inputProps
}: TextFieldProps) {
  const { colors, fonts, type, space, radius } = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.danger : focused ? colors.primary : colors.border;
  const textStyle = numeric ? type.title : type.body;

  return (
    <View style={[{ gap: space.xs }, style]}>
      <AppText variant="small" weight="semibold">
        {label}
      </AppText>
      <View
        style={[
          styles.well,
          {
            minHeight: multiline ? 96 : 56,
            backgroundColor: colors.surfaceSunken,
            borderColor,
            borderWidth: focused || error ? 2 : 1,
            borderRadius: radius.md,
            paddingHorizontal: space.md,
            gap: space.sm,
            opacity: editable ? 1 : 0.6,
          },
          multiline && styles.wellMultiline,
        ]}>
        {prefix ? (
          <AppText variant={numeric ? 'title' : 'body'} muted numeric importantForAccessibility="no">
            {prefix}
          </AppText>
        ) : null}
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          accessibilityHint={error ?? helper}
          editable={editable}
          multiline={multiline}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.primary}
          cursorColor={colors.primary}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            styles.input,
            textStyle,
            {
              color: colors.text,
              fontFamily: numeric ? fonts.bodyBold : fonts.body,
              // RN swaps left/right in RTL, so 'left' = start.
              textAlign: align === 'end' ? 'right' : 'left',
              textAlignVertical: multiline ? 'top' : 'center',
              paddingVertical: multiline ? space.md : space.sm,
            },
            numeric && styles.tabular,
          ]}
          {...inputProps}
        />
        {typeof suffix === 'string' ? (
          <AppText muted importantForAccessibility="no">
            {suffix}
          </AppText>
        ) : (
          suffix
        )}
      </View>
      {error ? (
        <View style={[styles.message, { gap: space.xs }]} accessibilityLiveRegion="polite">
          <Icon name="error-outline" size={16} tone="danger" />
          <AppText variant="small" tone="danger" style={styles.flex}>
            {error}
          </AppText>
        </View>
      ) : helper ? (
        <AppText variant="small" muted>
          {helper}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  well: { flexDirection: 'row', alignItems: 'center' },
  wellMultiline: { alignItems: 'flex-start' },
  input: { flex: 1, minWidth: 0, margin: 0 },
  tabular: { fontVariant: ['tabular-nums'] },
  message: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
});
