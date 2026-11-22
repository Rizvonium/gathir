import { Text, View } from 'react-native';

import { useTheme } from '@/ui/theme';

/** Placeholder — replaced by the more feature. */
export default function Screen() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
      <Text style={{ color: colors.text }}>more</Text>
    </View>
  );
}
