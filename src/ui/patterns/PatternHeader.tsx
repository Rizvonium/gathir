import { Canvas, Group, Picture } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useDerivedValue } from 'react-native-reanimated';

import { useTheme } from '../theme';
import { botehField, botehMotif, circlePath, sozniVines } from './geometry';
import { inkAt, patternInks } from './inks';
import { recordLayers, type InkLayer } from './picture';
import { useLayoutSize } from './useLayoutSize';
import { useLoopClock } from './useLoopClock';
import { usePatternLoop } from './usePatternLoop';

/** Drift speed of the band (PLAN §10): one full tile every 50 s. */
const CYCLES_PER_SECOND = 0.02;

export type PatternHeaderProps = {
  /** Fixed width; omit to fill the parent (measured with onLayout). */
  width?: number;
  /** Band height in dp (default 140). */
  height?: number;
  /** Same seed, same art (matches the Pattern Lab "boteh-field" sketch). */
  seed?: number;
  /** 0..1, how many boteh fill the band (default 0.45). */
  density?: number;
  /** Band background; defaults to theme surfaceSunken. */
  background?: string;
  /** Force the still frame (e.g. while a sheet covers the header). */
  paused?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Build the seamless tile: every boteh near an edge is also drawn wrapped to the other side. */
function buildTileLayers(seed: number, W: number, H: number, density: number, inks: string[]): InkLayer[] {
  const field = botehField(seed, W, H, density, inks.length);
  const outline = inks.map(() => '');
  const inner = inks.map(() => '');
  const dots = inks.map(() => '');
  let stroke = 1.5;
  for (const b of field) {
    const reach = b.size * 2.6;
    const shifts = [0];
    if (b.x < reach) shifts.push(W);
    if (b.x > W - reach) shifts.push(-W);
    for (const shift of shifts) {
      const m = botehMotif(b.x + shift, b.y, b.size, b.angle, b.curl);
      outline[b.ink] += m.outline;
      inner[(b.ink + 1) % inks.length] += m.inner;
      for (const d of m.dots) dots[(b.ink + 2) % inks.length] += circlePath(d.x, d.y, d.r);
    }
    stroke = Math.max(1.25, b.size * 0.12);
  }
  const layers: InkLayer[] = [];
  inks.forEach((color, i) => {
    layers.push({ svg: outline[i], color, stroke });
    layers.push({ svg: inner[i], color });
    layers.push({ svg: dots[i], color });
  });
  return layers;
}

/** Faint sozni vines behind the drifting boteh. Not seamless, so they stay still. */
function buildVineLayers(seed: number, W: number, H: number, inks: string[]): InkLayer[] {
  return sozniVines(seed + 17, W, H, 2, 0.5, inks.length).flatMap((v): InkLayer[] => [
    { svg: v.stem, color: inkAt(inks, v.ink), stroke: 1, alpha: 0.3 },
    { svg: v.leaves, color: inkAt(inks, v.ink), alpha: 0.3 },
  ]);
}

/**
 * Animated boteh + sozni band for Home and Showroom. The tile is recorded once as an
 * SkPicture; only a translateX shared value changes per frame (0.02 cycles/s, UI thread).
 * Stops when the screen is unfocused, the app is backgrounded, `paused` is set, or reduced
 * motion is on (then it is a still band). Decorative: hidden from screen readers.
 * Must be rendered inside an Expo Router screen.
 */
export function PatternHeader({
  width,
  height = 140,
  seed = 1,
  density = 0.45,
  background,
  paused = false,
  style,
}: PatternHeaderProps) {
  const { colors } = useTheme();
  const size = useLayoutSize(width, height);
  const W = size.width;
  const H = size.height;
  const { running } = usePatternLoop(paused);
  const clock = useLoopClock(running && W > 0);
  const bg = background ?? colors.surfaceSunken;

  const pictures = useMemo(() => {
    if (W <= 0 || H <= 0) return null;
    const inks = patternInks(colors);
    return {
      ground: recordLayers(W, H, buildVineLayers(seed, W, H, inks), bg),
      tile: recordLayers(W, H, buildTileLayers(seed, W, H, density, inks)),
    };
  }, [W, H, seed, density, colors, bg]);

  const drift = useDerivedValue(() => {
    const phase = (clock.get() * CYCLES_PER_SECOND) % 1;
    return [{ translateX: -phase * W }];
  });

  return (
    <View
      style={[{ width: width ?? '100%', height }, style]}
      onLayout={size.onLayout}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {pictures ? (
        <Canvas style={{ width: W, height: H }}>
          <Picture picture={pictures.ground} />
          <Group transform={drift}>
            <Picture picture={pictures.tile} />
            <Group transform={[{ translateX: W }]}>
              <Picture picture={pictures.tile} />
            </Group>
          </Group>
        </Canvas>
      ) : null}
    </View>
  );
}
