import { BottomSheet, Host, type SnapPoint } from '@expo/ui';
import { useEffect, useId, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { AppText } from './AppText';
import { useOverlayStore } from './overlayStore';
import { ToastOutlet } from './Toast';

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
 *
 * The sheet is its own window above the app, so it follows the overlay rules (overlayStore):
 * it is taken down while the app lock is up (and comes back once unlocked), and toasts shown
 * while it is the top sheet appear inside it instead of under its scrim.
 */
export function AppSheet({ visible, onClose, title, snapPoints, children, testID }: AppSheetProps) {
  const { colors, space } = useTheme();
  const id = useId();
  const locked = useOverlayStore((s) => s.locked);
  const presented = visible && !locked;
  const onTop = useOverlayStore((s) => s.sheets[s.sheets.length - 1] === id);

  useEffect(() => {
    if (!presented) return;
    const { sheetOpened, sheetClosed } = useOverlayStore.getState();
    sheetOpened(id);
    return () => sheetClosed(id);
  }, [presented, id]);

  // Locked: unmounted, not just hidden, so the dialog window goes at once (no closing animation
  // above the PIN pad).
  if (locked) return null;
  return (
    <Host>
      <BottomSheet
        testID={testID}
        isPresented={presented}
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
          {onTop ? <ToastOutlet /> : null}
        </View>
      </BottomSheet>
    </Host>
  );
}

const styles = StyleSheet.create({
  body: { alignSelf: 'stretch' },
});
