import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme';
import { AppText } from './AppText';
import { Button } from './Button';
import type { IconName } from './Icon';

export type EmptyStateProps = {
  /** Illustration slot (e.g. a Skia loom pattern or an Icon). */
  illustration?: ReactNode;
  title: string;
  body?: string;
  /** Primary action: an empty screen is an invitation to act. */
  actionLabel?: string;
  actionIcon?: IconName;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
};

/** Centred empty/first-use state: illustration, Fraunces title, short body and one action. */
export function EmptyState({ illustration, title, body, actionLabel, actionIcon, onAction, style }: EmptyStateProps) {
  const { space } = useTheme();
  return (
    <View style={[styles.root, { padding: space.xl, gap: space.md }, style]}>
      {illustration ? <View style={{ marginBottom: space.sm }}>{illustration}</View> : null}
      <AppText variant="heading" align="center" accessibilityRole="header">
        {title}
      </AppText>
      {body ? (
        <AppText muted align="center" style={styles.body}>
          {body}
        </AppText>
      ) : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} icon={actionIcon} onPress={onAction} style={{ marginTop: space.sm }} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { maxWidth: 320 },
});
