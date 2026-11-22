import { Canvas, Picture } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme';
import { weaveLayers } from './geometry';
import { patternInks } from './inks';
import { recordLayers, type InkLayer } from './picture';
import { useLayoutSize } from './useLayoutSize';

export type KaniWeaveBackgroundProps = {
  /** Fixed size; omit to fill the parent (absolute fill, measured with onLayout). */
  width?: number;
  height?: number;
  /** Same seed, same weave (matches the Pattern Lab "kani-weave" sketch). */
  seed?: number;
  /** Size of one twill cell in dp (default 8). */
  cell?: number;
  /** 0..1 share of coloured threads (default 0.22). */
  accent?: number;
  /** Overall strength of the texture (default 0.12): keep it quiet behind text. */
  intensity?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Quiet 2/2 twill texture for cards and empty states. Static (no animation): recorded once
 * into an SkPicture per size/seed/theme. Without width/height it fills its parent
 * absolutely, so put it first inside a `position: relative` container.
 */
export function KaniWeaveBackground({
  width,
  height,
  seed = 3,
  cell = 8,
  accent = 0.22,
  intensity = 0.12,
  style,
}: KaniWeaveBackgroundProps) {
  const { colors } = useTheme();
  const size = useLayoutSize(width, height);
  const W = size.width;
  const H = size.height;

  const picture = useMemo(() => {
    if (W <= 0 || H <= 0) return null;
    const inks = [colors.textMuted, ...patternInks(colors).slice(0, 5)];
    const layers: InkLayer[] = weaveLayers(seed, W, H, cell, inks.length, accent).map((svg, i) => ({
      svg,
      color: inks[i],
      // Ground threads stay a whisper; coloured threads read a little stronger.
      alpha: i === 0 ? intensity * 0.6 : Math.min(1, intensity * 2.2),
    }));
    return recordLayers(W, H, layers);
  }, [W, H, seed, cell, accent, intensity, colors]);

  const fill = width === undefined || height === undefined;
  return (
    <View
      style={[fill ? StyleSheet.absoluteFill : { width, height }, style]}
      onLayout={size.onLayout}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {picture ? (
        <Canvas style={{ width: W, height: H }}>
          <Picture picture={picture} />
        </Canvas>
      ) : null}
    </View>
  );
}
