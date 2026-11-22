import {
  Atlas,
  Canvas,
  Skia,
  useColorBuffer,
  usePictureAsTexture,
  useRSXformBuffer,
  type SkPicture,
  type SkRect,
} from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { durations } from '../motion';
import { useTheme } from '../theme';
import { botehPath, circlePath, confettiParticles, confettiPose } from './geometry';
import { patternInks } from './inks';
import { recordLayers } from './picture';
import { useLayoutSize } from './useLayoutSize';
import { useOneShot } from './useOneShot';
import { useReducedMotionLive } from './useReducedMotionLive';

/** Sprite cell in texture pixels: [boteh | sequin]. */
const CELL = 48;
/** On-screen size of a scale-1 particle in dp. */
const PARTICLE_DP = 18;
/** Reduced motion: particles hold this pose and only fade. */
const STILL_T = 0.3;
const MAX_PARTICLES = 40;

let sprites: { picture: SkPicture; rects: SkRect[] } | null = null;

/** White sprites, tinted per particle by the Atlas colours. Built lazily, once per app run. */
function getSprites() {
  if (!sprites) {
    sprites = {
      picture: recordLayers(CELL * 2, CELL, [
        { svg: botehPath(CELL / 2, CELL * 0.62, CELL * 0.27, 0, 0.5), color: '#FFFFFF' },
        { svg: circlePath(CELL * 1.5, CELL / 2, CELL * 0.3), color: '#FFFFFF' },
      ]),
      rects: [Skia.XYWHRect(0, 0, CELL, CELL), Skia.XYWHRect(CELL, 0, CELL, CELL)],
    };
  }
  return sprites;
}

/** Parse '#RRGGBB' into 0..1 channels (theme inks are plain hex). */
function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export type PaisleyConfettiProps = {
  /** Fixed size; omit to fill the parent absolutely (overlay). */
  width?: number;
  height?: number;
  seed?: number;
  /** Number of particles, capped at 40 (default 32). */
  count?: number;
  /** Burst origin as 0..1 of width/height (default 0.5, 0.6). */
  originX?: number;
  originY?: number;
  /** Called once after 1.2 s; unmount the component then. */
  onDone?: () => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * Report-sent delight: a burst of tiny boteh and sequins (≤ 40) in the theme inks over
 * 1.2 s. One Skia Atlas draw call; transforms and fades are written into buffers on the UI
 * thread from precomputed particles (no per-frame JS or allocations).
 * Reduced motion: particles appear mid-burst and fade, no movement. Touches pass through.
 */
export function PaisleyConfetti({
  width,
  height,
  seed = 11,
  count = 32,
  originX = 0.5,
  originY = 0.6,
  onDone,
  style,
}: PaisleyConfettiProps) {
  const { colors } = useTheme();
  const reduced = useReducedMotionLive();
  const size = useLayoutSize(width, height);
  const { progress, finished } = useOneShot(durations.celebrate, onDone);
  const sheet = getSprites();
  const texture = usePictureAsTexture(sheet.picture, { width: CELL * 2, height: CELL });

  const n = Math.min(MAX_PARTICLES, Math.max(0, Math.round(count)));
  const particles = useMemo(() => confettiParticles(seed, n), [seed, n]);
  const spriteRects = useMemo(() => particles.map((p) => sheet.rects[p.kind]), [particles, sheet]);
  const rgb = useMemo(() => {
    const inks = patternInks(colors).map(hexToRgb);
    return particles.map((p) => inks[p.ink % inks.length]);
  }, [particles, colors]);

  const W = size.width;
  const H = size.height;
  const ox = W * originX;
  const oy = H * originY;
  const reach = Math.min(W, H) * 0.45;

  const transforms = useRSXformBuffer(n, (xf, i) => {
    'worklet';
    const p = particles[i];
    const pose = confettiPose(p, reduced ? STILL_T : progress.get(), ox, oy, reach);
    const s = (PARTICLE_DP * p.scale) / CELL;
    const c = Math.cos(pose.rot) * s;
    const si = Math.sin(pose.rot) * s;
    const half = CELL / 2;
    // Rotate and scale about the sprite centre.
    xf.set(c, si, pose.x - (c * half - si * half), pose.y - (si * half + c * half));
  });
  const tints = useColorBuffer(n, (color, i) => {
    'worklet';
    const alpha = confettiPose(particles[i], progress.get(), ox, oy, reach).alpha;
    color[0] = rgb[i][0];
    color[1] = rgb[i][1];
    color[2] = rgb[i][2];
    color[3] = alpha;
  });

  if (finished) return null;
  const fill = width === undefined || height === undefined;
  return (
    <View
      style={[fill ? StyleSheet.absoluteFill : { width, height }, style]}
      onLayout={size.onLayout}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {W > 0 && n > 0 ? (
        <Canvas style={{ width: W, height: H }}>
          <Atlas image={texture} sprites={spriteRects} transforms={transforms} colors={tints} colorBlendMode="modulate" />
        </Canvas>
      ) : null}
    </View>
  );
}
