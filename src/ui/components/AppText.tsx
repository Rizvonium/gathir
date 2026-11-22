import type { ComponentRef, Ref } from 'react';
import { Text, type StyleProp, type TextProps, type TextStyle } from 'react-native';

import { useTheme } from '../theme';
import type { ColorTokens } from '../tokens';

export type TextVariant = 'display' | 'heading' | 'title' | 'body' | 'small' | 'caption' | 'count';
export type TextWeight = 'regular' | 'medium' | 'semibold' | 'bold';
export type TextAlign = 'start' | 'center' | 'end';

export type AppTextProps = Omit<TextProps, 'style'> & {
  variant?: TextVariant;
  /** Manrope weight. Fraunces variants (display, heading) only use semibold/bold. */
  weight?: TextWeight;
  /** Shortcut for tone="textMuted". */
  muted?: boolean;
  /** Theme colour token for the text. Defaults to `text`. */
  tone?: keyof ColorTokens;
  /** Raw colour override (e.g. text on a custom swatch). Prefer `tone`. */
  color?: string;
  /** Tabular digits so counts and money do not jitter. Always on for `count`. Numeric text is always Manrope. */
  numeric?: boolean;
  align?: TextAlign;
  style?: StyleProp<TextStyle>;
  ref?: Ref<ComponentRef<typeof Text>>;
};

const defaultWeight: Record<TextVariant, TextWeight> = {
  display: 'bold',
  heading: 'semibold',
  title: 'bold',
  body: 'regular',
  small: 'regular',
  caption: 'medium',
  count: 'bold',
};

/**
 * The only text component screens should use. Applies the type scale, Manrope/Fraunces
 * families, theme colour and tabular numbers. Font scaling stays on.
 */
export function AppText({
  variant = 'body',
  weight,
  muted = false,
  tone,
  color,
  numeric = false,
  align,
  style,
  ref,
  ...rest
}: AppTextProps) {
  const { colors, fonts, type } = useTheme();
  const w = weight ?? defaultWeight[variant];
  const serif = (variant === 'display' || variant === 'heading') && !numeric;
  const fontFamily = serif
    ? w === 'bold'
      ? fonts.display
      : fonts.displaySemi
    : { regular: fonts.body, medium: fonts.bodyMedium, semibold: fonts.bodySemi, bold: fonts.bodyBold }[w];
  const textColor = color ?? colors[tone ?? (muted ? 'textMuted' : 'text')];

  return (
    <Text
      ref={ref}
      style={[
        type[variant],
        { fontFamily, color: textColor },
        (numeric || variant === 'count') && tabular,
        align && { textAlign: alignMap[align] },
        style,
      ]}
      {...rest}
    />
  );
}

const tabular: TextStyle = { fontVariant: ['tabular-nums'] };

/** RN swaps left/right text alignment in RTL (doLeftAndRightSwapInRTL), so left = start. */
const alignMap: Record<TextAlign, TextStyle['textAlign']> = { start: 'left', center: 'center', end: 'right' };
