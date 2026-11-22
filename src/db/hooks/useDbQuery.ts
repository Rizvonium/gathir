/**
 * Re-runs a synchronous repository function whenever the database changes.
 * Changes are coalesced to one re-run per animation frame, so a transaction that
 * writes many rows causes a single re-render.
 */
import { addDatabaseChangeListener } from 'expo-sqlite';
import { useState, useSyncExternalStore, type DependencyList } from 'react';

import { db } from '../client';
import type { DbOrTx } from '../types';

let version = 0;
const subscribers = new Set<() => void>();
let frame: number | null = null;
let subscription: { remove: () => void } | null = null;

function ensureSubscribed(): void {
  if (subscription) return;
  subscription = addDatabaseChangeListener(() => {
    if (frame !== null) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      version += 1;
      subscribers.forEach((notify) => notify());
    });
  });
}

function subscribe(onChange: () => void): () => void {
  ensureSubscribed();
  subscribers.add(onChange);
  return () => {
    subscribers.delete(onChange);
  };
}

const getVersion = () => version;

/** Current database version; bumps (at most once per frame) after any write. */
export function useDbVersion(): number {
  return useSyncExternalStore(subscribe, getVersion, getVersion);
}

function sameDeps(a: DependencyList, b: DependencyList): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false;
  return true;
}

type Cached<T> = { v: number; deps: DependencyList; value: T };

/**
 * `useDbQuery((d) => salesSummary(d, range), [range.from, range.to])` → the result,
 * recomputed when `deps` change or the database changes.
 * `query` itself is not compared: pass every input it reads as `deps`.
 */
export function useDbQuery<T>(query: (database: DbOrTx) => T, deps: DependencyList): T {
  const v = useDbVersion();
  const [cached, setCached] = useState<Cached<T>>(() => ({ v, deps, value: query(db) }));
  if (cached.v !== v || !sameDeps(cached.deps, deps)) {
    // Derived-state update during render (React re-renders immediately, before committing).
    const next: Cached<T> = { v, deps, value: query(db) };
    setCached(next);
    return next.value;
  }
  return cached.value;
}
