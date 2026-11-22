/**
 * Start of the current local day (epoch ms). Re-checks when the app comes back to the
 * foreground and at the next midnight, so "today" figures roll over without a DB write.
 */
import { AppState } from 'react-native';
import { useSyncExternalStore } from 'react';

import { addDays, startOfDay } from '@/lib/dates';

const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;
let appStateSub: { remove: () => void } | null = null;

function notify() {
  listeners.forEach((l) => l());
}

function scheduleMidnight() {
  if (timer) clearTimeout(timer);
  const now = Date.now();
  const next = addDays(startOfDay(now), 1);
  timer = setTimeout(() => {
    notify();
    scheduleMidnight();
  }, Math.max(1000, next - now + 500));
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  if (listeners.size === 1) {
    appStateSub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        notify();
        scheduleMidnight();
      }
    });
    scheduleMidnight();
  }
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0) {
      appStateSub?.remove();
      appStateSub = null;
      if (timer) clearTimeout(timer);
      timer = null;
    }
  };
}

const getToday = () => startOfDay(Date.now());

/** `startOfDay(Date.now())`, kept fresh across midnight and app resume. */
export function useToday(): number {
  return useSyncExternalStore(subscribe, getToday, getToday);
}
