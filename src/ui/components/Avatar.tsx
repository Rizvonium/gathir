import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from './AppText';
import { readableTextOn } from './colorContrast';

export type AvatarProps = {
  /** Person's name; initials are derived from it. */
  name: string;
  /** Background colour as #RRGGBB (e.g. a per-customer tint). Text colour is picked for contrast. */
  color: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

/** "Rafiq Ahmad Dar" → "RA"; "" → "?". */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const chars = parts.slice(0, 2).map((p) => Array.from(p)[0] ?? '');
  return chars.join('').toLocaleUpperCase();
}

/** Round initials badge on a tinted background. Decorative: the row next to it names the person. */
export function Avatar({ name, color, size = 40, style }: AvatarProps) {
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      style={[styles.base, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style]}>
      <AppText
        variant={size >= 56 ? 'title' : 'small'}
        weight="bold"
        color={readableTextOn(color)}
        maxFontSizeMultiplier={1.4}>
        {initialsOf(name)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
