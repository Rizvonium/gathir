import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Live "Remove animations" system setting. Reanimated's useReducedMotion() only reads the
 * startup value; this subscribes so loops and CSS transitions react while the app runs.
 */
export function useReduceMotionEnabled(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) setReduced(v);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  return reduced;
}
