import type { ViewStyle } from 'react-native';

import type { Theme } from '../theme';

/**
 * Soft warm elevation (PLAN §9: shadow + 1px border reads better in sunlight).
 * Walnut-tinted in light mode; near-black in dark mode where the border does the work.
 */
export function warmShadow(scheme: Theme['scheme'], level: 'card' | 'overlay' = 'card'): ViewStyle {
  if (scheme === 'dark') {
    return { boxShadow: level === 'card' ? '0 1px 2px rgba(0,0,0,0.35)' : '0 8px 24px rgba(0,0,0,0.5)' };
  }
  return {
    boxShadow:
      level === 'card'
        ? '0 1px 2px rgba(43,26,18,0.06), 0 4px 12px rgba(43,26,18,0.06)'
        : '0 8px 24px rgba(43,26,18,0.18)',
  };
}
