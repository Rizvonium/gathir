import { Canvas, Path } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useDerivedValue } from 'react-native-reanimated';

import { useTheme } from '../theme';
import { loomGeometry } from './geometry';
import { toSkPath } from './skPath';
import { useLayoutSize } from './useLayoutSize';
import { useLoopClock } from './useLoopClock';
import { usePatternLoop } from './usePatternLoop';

/** Reduced motion / paused-before-start: show the cloth this far woven. */
const STILL_PROGRESS = 0.6;
/** Share of each cycle spent fading the finished cloth before it restarts. */
const FADE_SHARE = 0.1;

export type LoomEmptyStateProps = {
  /** Fixed width; omit to fill the parent (measured with onLayout). */
  width?: number;
  /** Height in dp (default 160). */
  height?: number;
  /** Seconds to weave the whole cloth once (default 7). */
  period?: number;
  /** Vertical warp threads (default 13) and woven rows (default 9). */
  warpCount?: number;
  rows?: number;
  /** Stop the loop (e.g. when the list is no longer empty but still mounted). */
  paused?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Empty-stock illustration: a loom whose weft thread weaves row by row in a slow loop,
 * explaining "your stock will appear here". Path trim driven on the UI thread; stops when
 * the screen is unfocused, the app is backgrounded or `paused`; still frame under reduced
 * motion. Decorative: pair it with the empty-state text. Must render inside a route.
 */
export function LoomEmptyState({
  width,
  height = 160,
  period = 7,
  warpCount = 13,
  rows = 9,
  paused = false,
  style,
}: LoomEmptyStateProps) {
  const { colors } = useTheme();
  const size = useLayoutSize(width, height);
  const W = size.width;
  const H = size.height;
  const { running, reduced } = usePatternLoop(paused);
  const clock = useLoopClock(running && W > 0);

  const loom = useMemo(() => {
    if (W <= 0 || H <= 0) return null;
    const g = loomGeometry(W, H, warpCount, rows);
    return { warp: toSkPath(g.warp), weft: toSkPath(g.weft), beams: toSkPath(g.beams) };
  }, [W, H, warpCount, rows]);

  const cycle = useDerivedValue(() => {
    if (reduced) return STILL_PROGRESS;
    const t = clock.get();
    // Before the first frame runs (or while paused at 0) show a partly woven cloth.
    return t === 0 ? STILL_PROGRESS : (t / period) % 1;
  });
  const weftEnd = useDerivedValue(() => Math.min(1, cycle.get() / (1 - FADE_SHARE)));
  const weftOpacity = useDerivedValue(() => {
    const c = cycle.get();
    return c < 1 - FADE_SHARE ? 1 : 1 - (c - (1 - FADE_SHARE)) / FADE_SHARE;
  });

  const thread = Math.max(1.5, H / 70);
  return (
    <View
      style={[{ width: width ?? '100%', height }, style]}
      onLayout={size.onLayout}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {loom ? (
        <Canvas style={{ width: W, height: H }}>
          <Path path={loom.warp} style="stroke" strokeWidth={thread * 0.6} color={colors.textMuted} opacity={0.55} />
          <Path
            path={loom.weft}
            start={0}
            end={weftEnd}
            opacity={weftOpacity}
            style="stroke"
            strokeWidth={thread}
            strokeJoin="round"
            strokeCap="round"
            color={colors.primary}
          />
          <Path path={loom.beams} style="stroke" strokeWidth={thread * 2.4} strokeCap="round" color={colors.text} />
        </Canvas>
      ) : null}
    </View>
  );
}
