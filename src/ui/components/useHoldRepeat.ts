import { useEffect, useRef } from 'react';

/** First repeat delay after the long-press fires, then each tick shrinks to MIN_INTERVAL. */
const START_INTERVAL = 220;
const MIN_INTERVAL = 50;
const ACCELERATION = 0.82;

/**
 * Hold-to-repeat with acceleration. `start()` calls `tick` repeatedly with shrinking gaps
 * until `stop()` is called or `tick` returns false (e.g. a bound was reached).
 */
export function useHoldRepeat(tick: () => boolean): { start: () => void; stop: () => void } {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef(tick);
  useEffect(() => {
    tickRef.current = tick;
  });

  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const start = () => {
    stop();
    let interval = START_INTERVAL;
    const run = () => {
      if (!tickRef.current()) {
        timer.current = null;
        return;
      }
      interval = Math.max(MIN_INTERVAL, interval * ACCELERATION);
      timer.current = setTimeout(run, interval);
    };
    run();
  };

  useEffect(() => stop, []);
  return { start, stop };
}
