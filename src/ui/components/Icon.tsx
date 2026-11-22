import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ComponentProps } from 'react';
import type { StyleProp, TextStyle } from 'react-native';

import { useTheme } from '../theme';
import type { ColorTokens } from '../tokens';

export type IconName = ComponentProps<typeof MaterialIcons>['name'];

/**
 * Maps a stored icon name to a Material glyph, or undefined. Stored names (e.g. category icons in
 * the database) use Material's snake_case (`grid_on`); @expo/vector-icons uses hyphens (`grid-on`).
 */
export function toIconName(raw: string | null | undefined): IconName | undefined {
  if (!raw) return undefined;
  const name = raw.trim().replace(/_/g, '-');
  const glyphs = (MaterialIcons as { glyphMap?: Record<string, number> }).glyphMap;
  return glyphs && name in glyphs ? (name as IconName) : undefined;
}

export type IconProps = {
  name: IconName;
  size?: number;
  /** Theme colour token. Defaults to `text`. */
  tone?: keyof ColorTokens;
  /** Raw colour override, e.g. a computed readable colour. Prefer `tone`. */
  color?: string;
  style?: StyleProp<TextStyle>;
  /** Only for icons that carry meaning alone; decorative icons stay hidden from TalkBack. */
  accessibilityLabel?: string;
};

/** Material icon in a theme colour. Hidden from screen readers unless given a label. */
export function Icon({ name, size = 24, tone = 'text', color, style, accessibilityLabel }: IconProps) {
  const { colors } = useTheme();
  const labelled = !!accessibilityLabel;
  return (
    <MaterialIcons
      name={name}
      size={size}
      color={color ?? colors[tone]}
      style={style}
      accessible={labelled}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={labelled ? 'image' : undefined}
      importantForAccessibility={labelled ? 'yes' : 'no-hide-descendants'}
    />
  );
}
