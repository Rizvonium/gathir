import { Canvas, Circle, Group, Path, type SkPath } from '@shopify/react-native-skia';
import { useEffect, useMemo, useRef } from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useDerivedValue,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { durations } from '../motion';
import { useTheme } from '../theme';
import { gathirMark } from './geometry';
import { patternInks } from './inks';
import { toSkPath } from './skPath';
import { useReducedMotionLive } from './useReducedMotionLive';

/** Total weave duration (PLAN §10 first launch). */
const WEAVE_MS = durations.celebrate;
/** Reduced-motion replacement: the finished mark fades in. */
const FADE_MS = 300;
/** Share of the timeline each thread uses; threads start `delay` apart. */
const THREAD_SPAN = 0.76;

export type ThreadWeaveLogoProps = {
  /** Side of the square mark in dp (default 160). */
  size?: number;
  /** Called once when the weave finishes or is skipped. */
  onDone?: () => void;
  /** Translated label for the tap-to-skip action, e.g. t('onboarding:skipIntro'). */
  skipLabel: string;
  /** Set false to show the finished mark with no animation (e.g. on a later screen). */
  animate?: boolean;
  style?: StyleProp<ViewStyle>;
};

type StrandProps = {
  progress: SharedValue<number>;
  delay: number;
  path: SkPath;
  lead: SkPath;
  color: string;
  strokeWidth: number;
};

/** One thread: its lead line draws in then retracts while the boteh outline draws on. */
function Strand({ progress, delay, path, lead, color, strokeWidth }: StrandProps) {
  const local = useDerivedValue(() => Math.min(1, Math.max(0, (progress.get() - delay) / THREAD_SPAN)));
  const leadEnd = useDerivedValue(() => Math.min(1, local.get() / 0.4));
  const leadStart = useDerivedValue(() => Math.min(1, Math.max(0, (local.get() - 0.4) / 0.5)));
  const outlineEnd = useDerivedValue(() => Math.min(1, Math.max(0, (local.get() - 0.3) / 0.7)));
  return (
    <>
      <Path path={lead} start={leadStart} end={leadEnd} style="stroke" strokeWidth={strokeWidth * 0.55} strokeCap="round" color={color} />
      <Path path={path} start={0} end={outlineEnd} style="stroke" strokeWidth={strokeWidth} strokeCap="round" strokeJoin="round" color={color} />
    </>
  );
}

/**
 * First-launch brand moment: three coloured threads run in and weave into the Gathir
 * paisley mark (Skia path trim with stagger, 1.2 s, UI thread). Tap anywhere to skip.
 * Reduced motion: the finished mark fades in (opacity only). `onDone` fires exactly once.
 */
export function ThreadWeaveLogo({ size = 160, onDone, skipLabel, animate = true, style }: ThreadWeaveLogoProps) {
  const { colors } = useTheme();
  const reduced = useReducedMotionLive();
  const inks = patternInks(colors);
  const mark = useMemo(() => {
    const m = gathirMark(size, 0.86);
    return {
      strokeWidth: m.strokeWidth,
      dot: m.dot,
      threads: m.threads.map((t) => ({ path: toSkPath(t.path), lead: toSkPath(t.lead), ink: t.ink, delay: t.delay })),
    };
  }, [size]);

  const progress = useSharedValue(animate && !reduced ? 0 : 1);
  const opacity = useSharedValue(animate && reduced ? 0 : 1);
  const dotOpacity = useDerivedValue(() => Math.min(1, Math.max(0, (progress.get() - 0.8) / 0.2)));

  const done = useRef(false);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);
  const finish = () => {
    if (done.current) return;
    done.current = true;
    onDoneRef.current?.();
  };

  useEffect(() => {
    if (!animate) {
      finish();
      return;
    }
    const end = (finished?: boolean) => {
      'worklet';
      if (finished) scheduleOnRN(finish);
    };
    if (reduced) {
      // Opacity-only replacement, so it deliberately ignores the reduce-motion flag.
      opacity.set(withTiming(1, { duration: FADE_MS, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never }, end));
    } else {
      progress.set(withTiming(1, { duration: WEAVE_MS, easing: Easing.bezier(0.33, 0, 0.2, 1), reduceMotion: ReduceMotion.System }, end));
    }
    return () => {
      cancelAnimation(progress);
      cancelAnimation(opacity);
    };
    // Runs once on mount: the weave is a one-shot moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const skip = () => {
    cancelAnimation(progress);
    cancelAnimation(opacity);
    progress.set(1);
    opacity.set(1);
    finish();
  };

  return (
    <Pressable
      onPress={skip}
      accessibilityRole="button"
      accessibilityLabel={skipLabel}
      style={[{ width: size, height: size }, style]}
    >
      <Canvas style={{ width: size, height: size }} pointerEvents="none">
        <Group opacity={opacity}>
          {mark.threads.map((t) => (
            <Strand
              key={t.ink}
              progress={progress}
              delay={t.delay}
              path={t.path}
              lead={t.lead}
              color={inks[t.ink]}
              strokeWidth={mark.strokeWidth}
            />
          ))}
          <Circle cx={mark.dot.x} cy={mark.dot.y} r={mark.dot.r} color={inks[3]} opacity={dotOpacity} />
        </Group>
      </Canvas>
    </Pressable>
  );
}
