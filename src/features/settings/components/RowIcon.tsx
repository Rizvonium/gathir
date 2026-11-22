/** The coloured icon tile at the start of a settings row (icon + colour, never colour alone). */
import { StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/ui/components';
import type { ColorTokens } from '@/ui/tokens';
import { useTheme } from '@/ui/theme';

export function RowIcon({ name, tone = 'primary' }: { name: IconName; tone?: keyof ColorTokens }) {
  const { colors, radius } = useTheme();
  return (
    <View style={[styles.tile, { backgroundColor: colors.surfaceSunken, borderRadius: radius.md }]}>
      <Icon name={name} size={22} tone={tone} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});
