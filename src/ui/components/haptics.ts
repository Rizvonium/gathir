import * as Haptics from 'expo-haptics';

export type HapticKind = 'selection' | 'light' | 'medium' | 'success' | 'error';

/** Fire one haptic (PLAN §10 mapping). Never the only feedback; errors are swallowed. */
export function playHaptic(kind: HapticKind): void {
  const run = (): Promise<void> => {
    switch (kind) {
      case 'selection':
        return Haptics.selectionAsync();
      case 'light':
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      case 'medium':
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      case 'success':
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      case 'error':
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };
  run().catch(() => undefined);
}
