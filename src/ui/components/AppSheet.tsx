import { BottomSheet, Host, type SnapPoint } from '@expo/ui';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { AppText } from './AppText';

export type AppSheetProps = {
  /** Whether the sheet is shown. */
  visible: boolean;
  /** Called when the user swipes down, taps the scrim or presses back. Set visible=false here. */
  onClose: () => void;
  /** Optional Fraunces title at the top of the sheet. */
  title?: string;
  /** Heights the sheet rests at. Omit to size to content. Android supports 'half' and 'full'. */
  snapPoints?: SnapPoint[];
  children?: ReactNode;
  testID?: string;
};

/**
 * Native bottom sheet (@expo/ui BottomSheet, Jetpack Compose on Android) themed with the
 * surface colour and scrim token. Children are ordinary React Native views. Use for Sell,
 * pickers and reason lists; not for whole screens (use a formSheet route).
 */
export function AppSheet({ visible, onClose, title, snapPoints, children, testID }: AppSheetProps) {
  const { colors, space } = useTheme();
  return (
    <Host>
      <BottomSheet
        testID={testID}
        isPresented={visible}
        onDismiss={onClose}
        snapPoints={snapPoints}
        containerColor={colors.surface}
        scrimColor={colors.scrim}
        contentPadding={{ left: space.lg, right: space.lg, bottom: space.xl }}>
        <View style={[styles.body, { gap: space.md }]}>
          {title ? (
            <AppText variant="heading" accessibilityRole="header">
              {title}
            </AppText>
          ) : null}
          {children}
        </View>
      </BottomSheet>
    </Host>
  );
}

const styles = StyleSheet.create({
  body: { alignSelf: 'stretch' },
});
