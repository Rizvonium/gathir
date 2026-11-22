import { Canvas, Picture } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme';
import { patternInks } from './inks';
import { productInitials } from './placeholderArt';
import { placeholderPicture } from './placeholderCache';
import { useLayoutSize } from './useLayoutSize';

export type PatternPlaceholderProps = {
  /** Product id: the art is derived from it, so a product always looks the same. */
  productId: string;
  /** Product name; its first two initials are shown in the centre. */
  name: string;
  /** Fixed size; omit to fill the parent (measured with onLayout). */
  width?: number;
  height?: number;
  /** Corner radius (default theme card radius). */
  radius?: number;
  /** Translated label for screen readers, e.g. t('stock:noPhoto', { name }). Omit to hide. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Static generative art for products without photos: a boteh in an ink chosen from the
 * product id, on a faint twill, with the product initials. No animation; the picture is
 * cached (LRU) so grids scroll without re-drawing geometry.
 */
export function PatternPlaceholder({
  productId,
  name,
  width,
  height,
  radius,
  accessibilityLabel,
  style,
}: PatternPlaceholderProps) {
  const theme = useTheme();
  const { colors, fonts, type } = theme;
  const size = useLayoutSize(width, height);
  const W = size.width;
  const H = size.height;

  const picture = useMemo(() => {
    if (W <= 0 || H <= 0) return null;
    return placeholderPicture(productId, W, H, {
      ground: colors.surfaceSunken,
      thread: colors.textMuted,
      inks: patternInks(colors),
    });
  }, [productId, W, H, colors]);

  const initials = productInitials(name);
  const small = Math.min(W, H) < 96;
  const badge = Math.max(32, Math.round(Math.min(W, H) * 0.36));

  return (
    <View
      style={[
        { width: width ?? '100%', height: height ?? '100%', borderRadius: radius ?? theme.radius.card, overflow: 'hidden' },
        style,
      ]}
      onLayout={size.onLayout}
      accessible={accessibilityLabel !== undefined}
      accessibilityRole={accessibilityLabel !== undefined ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
      importantForAccessibility={accessibilityLabel !== undefined ? 'yes' : 'no-hide-descendants'}
    >
      {picture ? (
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
          <Picture picture={picture} />
        </Canvas>
      ) : null}
      {initials ? (
        <View style={styles.centre} pointerEvents="none">
          <View
            style={{
              width: badge,
              height: badge,
              borderRadius: badge / 2,
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: StyleSheet.hairlineWidth,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={{
                fontFamily: fonts.display,
                fontSize: small ? type.small.fontSize : Math.round(badge * 0.42),
                color: colors.text,
              }}
            >
              {initials}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  centre: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
});
