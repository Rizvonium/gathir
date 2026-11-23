import { Image, type ImageProps } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme';
import { Icon } from './Icon';
import { useReduceMotionEnabled } from './useReduceMotionEnabled';

export type ThumbnailProps = {
  /** File URI of the (thumbnail-sized) photo; null shows the placeholder. */
  uri: string | null | undefined;
  /** Square size in dp. Ignored when style sets width/height. */
  size?: number;
  /** Corner radius token. Default `md` (12). */
  rounded?: 'sm' | 'md' | 'card';
  /**
   * Stable id (e.g. photo id) so FlashList recycling never flashes the previous image. Marks a
   * recycled list cell: those images appear without the fade-in, so scrolling never animates.
   */
  recyclingKey?: string;
  /** Describe the photo; omit for decorative thumbs inside a labelled row. */
  accessibilityLabel?: string;
  contentFit?: ImageProps['contentFit'];
  style?: StyleProp<ViewStyle>;
};

/** Loading fade for single images; none in recycled list cells (no animation on scroll). */
export function thumbnailTransition(reduced: boolean, recyclingKey: string | undefined): number {
  return reduced || recyclingKey !== undefined ? 0 : 120;
}

/** Rounded expo-image with a sunken placeholder colour and cover fit. */
export function Thumbnail({ uri, size = 56, rounded = 'md', recyclingKey, accessibilityLabel, contentFit = 'cover', style }: ThumbnailProps) {
  const { colors, radius } = useTheme();
  const reduced = useReduceMotionEnabled();
  const frame: StyleProp<ViewStyle> = [
    styles.frame,
    { width: size, height: size, borderRadius: radius[rounded], backgroundColor: colors.surfaceSunken },
    style,
  ];
  if (!uri) {
    return (
      <View style={frame} accessibilityLabel={accessibilityLabel} accessible={!!accessibilityLabel}>
        <Icon name="image" tone="textMuted" size={Math.max(16, Math.round(size * 0.35))} />
      </View>
    );
  }
  return (
    <View style={frame}>
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        contentFit={contentFit}
        recyclingKey={recyclingKey}
        transition={thumbnailTransition(reduced, recyclingKey)}
        accessible={!!accessibilityLabel}
        accessibilityLabel={accessibilityLabel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
});
