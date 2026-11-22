import { useEffect, useRef, useState } from 'react';

/**
 * True after `ms` without a `poke()`. Any poke ends idle and restarts the clock.
 * Paused (never idle) while `enabled` is false.
 */
export function useIdle(ms: number, enabled = true): { idle: boolean; poke: () => void } {
  const [idle, setIdle] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const arm = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = enabled ? setTimeout(() => setIdle(true), ms) : null;
  };

  useEffect(() => {
    arm();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms, enabled]);

  return {
    idle: enabled && idle,
    poke: () => {
      if (idle) setIdle(false);
      arm();
    },
  };
}
