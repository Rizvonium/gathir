/**
 * A setting that is on or off: label (+ helper) and a native @expo/ui Switch (Compose on
 * Android). The whole row is the target (≥ 56 dp) and is announced as one switch.
 */
import { Host, Switch } from '@expo/ui';
import { StyleSheet, View } from 'react-native';

import { AppText, PressableScale } from '@/ui/components';
import { useTheme } from '@/ui/theme';

export type ToggleRowProps = {
  label: string;
  helper?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  testID?: string;
};

export function ToggleRow({ label, helper, value, onChange, disabled, testID }: ToggleRowProps) {
  const { space } = useTheme();
  return (
    <PressableScale
      testID={testID}
      scaleTo={1}
      disabled={disabled}
      onPress={() => onChange(!value)}
      haptic="selection"
      accessibilityRole="switch"
      accessibilityLabel={helper ? `${label}. ${helper}` : label}
      accessibilityState={{ checked: value }}
      style={[styles.row, { gap: space.md, paddingVertical: space.sm }]}>
      <View style={styles.text}>
        <AppText weight="semibold">{label}</AppText>
        {helper ? (
          <AppText variant="small" muted>
            {helper}
          </AppText>
        ) : null}
      </View>
      <View importantForAccessibility="no-hide-descendants" pointerEvents="none">
        <Host matchContents>
          <Switch value={value} onValueChange={onChange} />
        </Host>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 56 },
  text: { flex: 1, minWidth: 0 },
});
