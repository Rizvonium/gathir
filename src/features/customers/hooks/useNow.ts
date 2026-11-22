/** "Now" for labels like "3 days ago": refreshed after every DB write, at midnight and on resume. */
import { useDbQuery, useToday } from '@/db/hooks';

export function useNow(): number {
  const today = useToday();
  return useDbQuery(() => Date.now(), [today]);
}
