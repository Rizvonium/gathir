import { useEffect, useRef, useState } from 'react';
import { cancelAnimation, Easing, ReduceMotion, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

/**
 * Drives a one-shot celebration: a 0→1 progress shared value on the UI thread over
 * `durationMs`, then `onDone` (once) and `finished = true` so the caller renders nothing.
 * Linear on purpose: the particle maths in geometry.ts shapes its own curves.
 * Celebrations pass ReduceMotion.Never because their reduced variant is opacity-only.
 */
export function useOneShot(durationMs: number, onDone?: () => void): { progress: SharedValue<number>; finished: boolean } {
  const progress = useSharedValue(0);
  const [finished, setFinished] = useState(false);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const complete = () => {
      setFinished(true);
      onDoneRef.current?.();
    };
    progress.set(
      withTiming(1, { duration: durationMs, easing: Easing.linear, reduceMotion: ReduceMotion.Never }, (done) => {
        'worklet';
        if (done) scheduleOnRN(complete);
      }),
    );
    return () => cancelAnimation(progress);
  }, [durationMs, progress]);

  return { progress, finished };
}
