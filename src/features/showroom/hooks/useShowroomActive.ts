/** Live "a Showroom is open" flag (also true on screens pushed on top of it, e.g. the card send). */
import { useSyncExternalStore } from 'react';

import { isShowroomActive, subscribeShowroom } from '../logic/session';

export function useShowroomActive(): boolean {
  return useSyncExternalStore(subscribeShowroom, isShowroomActive, isShowroomActive);
}
