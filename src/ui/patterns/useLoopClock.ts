import { useEffect } from 'react';
import { useFrameCallback, useSharedValue, type SharedValue } from 'react-native-reanimated';

/**
 * Seconds of "running" time on the UI thread. The frame callback is only active while
 * `running` is true, so a paused loop costs nothing per frame and resumes where it stopped
 * (no jump). Never triggers a React render.
 */
export function useLoopClock(running: boolean): SharedValue<number> {
  const seconds = useSharedValue(0);
  const frame = useFrameCallback((info) => {
    const dt = info.timeSincePreviousFrame ?? 0;
    // Clamp long gaps (e.g. after a hitch) so the art never leaps forward.
    seconds.set(seconds.get() + Math.min(dt, 64) / 1000);
  }, false);
  useEffect(() => {
    frame.setActive(running);
  }, [frame, running]);
  return seconds;
}
