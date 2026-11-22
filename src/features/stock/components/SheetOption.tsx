import { StyleSheet, View } from 'react-native';

import { AppText, Icon, PressableScale, type IconName } from '@/ui/components';
import { useTheme } from '@/ui/theme';

export type SheetOptionProps = {
  label: string;
  icon?: IconName;
  selected?: boolean;
  /** Radio rows (sort) report checked state; action rows are plain buttons. */
  role?: 'button' | 'radio';
  tone?: 'default' | 'danger';
  disabled?: boolean;
  onPress: () => void;
  testID?: string;
};

/** One full-width choice inside a bottom sheet (56 dp, icon + label, check when selected). */
export function SheetOption({ label, icon, selected = false, role = 'button', tone = 'default', disabled, onPress, testID }: SheetOptionProps) {
  const { colors, space, radius } = useTheme();
  const fg = tone === 'danger' ? colors.danger : colors.text;
  return (
    <PressableScale
      testID={testID}
      scaleTo={0.99}
      haptic="selection"
      disabled={disabled}
      onPress={onPress}
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={role === 'radio' ? { checked: selected } : undefined}
      style={[
        styles.row,
        { gap: space.md, paddingHorizontal: space.md, borderRadius: radius.md, backgroundColor: selected ? colors.surfaceSunken : 'transparent' },
      ]}>
      {icon ? <Icon name={icon} color={fg} /> : null}
      <AppText weight={selected ? 'bold' : 'medium'} color={fg} style={styles.label}>
        {label}
      </AppText>
      {selected ? <Icon name="check" tone="primary" /> : <View style={styles.spacer} />}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 56 },
  label: { flex: 1 },
  spacer: { width: 24 },
});
