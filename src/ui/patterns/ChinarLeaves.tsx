import { Canvas, Group, Path, type SkPath } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import { useTheme } from '../theme';
import { chinarLeafPath, chinarVeinPath, leafDrift, leafPose, type LeafParticle } from './geometry';
import { useLayoutSize } from './useLayoutSize';
import { useOneShot } from './useOneShot';
import { toSkPath } from './skPath';
import { useReducedMotionLive } from './useReducedMotionLive';

/** Sale celebration length (PLAN §10). */
const LEAF_MS = 900;
/** Leaves are built at this size once and scaled per particle. */
const BASE = 100;
/** Reduced motion: leaves hold this pose and only fade. */
const STILL_T = 0.4;

export type ChinarLeavesProps = {
  /** Fixed size; omit to fill the parent absolutely (overlay). */
  width?: number;
  height?: number;
  seed?: number;
  /** 1..3 leaves (default 2). */
  count?: number;
  /** Called once after 900 ms; unmount the component then. */
  onDone?: () => void;
  style?: StyleProp<ViewStyle>;
};

type LeafProps = {
  particle: LeafParticle;
  progress: SharedValue<number>;
  reduced: boolean;
  leaf: SkPath;
  veins: SkPath;
  color: string;
  veinColor: string;
};

function Leaf({ particle, progress, reduced, leaf, veins, color, veinColor }: LeafProps) {
  const transform = useDerivedValue(() => {
    const pose = leafPose(particle, reduced ? STILL_T : progress.get());
    const s = particle.size / BASE;
    return [{ translateX: pose.x }, { translateY: pose.y }, { rotate: pose.rot }, { scale: s }];
  });
  const opacity = useDerivedValue(() => leafPose(particle, progress.get()).alpha);
  return (
    <Group transform={transform} opacity={opacity}>
      <Path path={leaf} color={color} />
      <Path path={veins} style="stroke" strokeWidth={4} strokeCap="round" color={veinColor} opacity={0.7} />
    </Group>
  );
}

/**
 * Sale-completed delight: up to 3 chinar leaves drift and fade over 900 ms (UI thread,
 * precomputed particles), then `onDone` fires and the component renders nothing.
 * Reduced motion: leaves appear in place and fade, no movement. Touches pass through.
 */
export function ChinarLeaves({ width, height, seed = 7, count = 2, onDone, style }: ChinarLeavesProps) {
  const { colors } = useTheme();
  const reduced = useReducedMotionLive();
  const size = useLayoutSize(width, height);
  const { progress, finished } = useOneShot(LEAF_MS, onDone);
  const shapes = useMemo(() => ({ leaf: toSkPath(chinarLeafPath(BASE)), veins: toSkPath(chinarVeinPath(BASE)) }), []);
  const particles = useMemo(
    () => (size.width > 0 ? leafDrift(seed, count, size.width, size.height) : []),
    [seed, count, size.width, size.height],
  );
  if (finished) return null;
  const leafInks = [colors.primary, colors.saffron];
  const fill = width === undefined || height === undefined;
  return (
    <View
      style={[fill ? StyleSheet.absoluteFill : { width, height }, style]}
      onLayout={size.onLayout}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {particles.length > 0 ? (
        <Canvas style={{ width: size.width, height: size.height }}>
          {particles.map((p, i) => (
            <Leaf
              key={i}
              particle={p}
              progress={progress}
              reduced={reduced}
              leaf={shapes.leaf}
              veins={shapes.veins}
              color={leafInks[p.ink % leafInks.length]}
              veinColor={colors.bg}
            />
          ))}
        </Canvas>
      ) : null}
    </View>
  );
}
