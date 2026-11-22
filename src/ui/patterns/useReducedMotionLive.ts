import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

/**
 * "Remove animations" system setting, live. Starts from Reanimated's synchronous startup
 * value (so the first frame is already right) and follows changes while the app runs.
 */
export function useReducedMotionLive(): boolean {
  const initial = useReducedMotion();
  const [reduced, setReduced] = useState(initial);
  useEffect(() => {
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => sub.remove();
  }, []);
  return reduced;
}
