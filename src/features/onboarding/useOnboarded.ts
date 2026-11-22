import { useDbQuery } from '@/db/hooks';

import { readOnboarded } from './onboardingData';

/** Live "has first launch finished?" flag (false before the settings row exists). */
export function useOnboarded(): boolean {
  return useDbQuery(readOnboarded, []);
}
