/**
 * Re-runs a synchronous repository function when the database changes.
 *
 * - Changes are coalesced to one re-run per animation frame, so a transaction that writes many
 *   rows causes a single re-render.
 * - A query can name the tables it reads (`tables`): it then re-runs only when one of them
 *   changed (the change event carries the table name). Without it, any write re-runs it.
 * - Queries on a screen that is not focused (a tab under a pushed screen, the screen under a
 *   sheet route) do not re-run; they catch up once, when the screen is focused again. The same
 *   for `enabled: false` (e.g. a closed sheet that stays mounted).
 */
import { addDatabaseChangeListener } from 'expo-sqlite';
// Expo Router's focus context (what useIsFocused reads). Read directly so a hook rendered outside
// a route (the root layout, the lock gate) counts as focused instead of throwing.
import { IsFocusedContext } from 'expo-router/build/react-navigation/core/useIsFocused';
import { use, useCallback, useState, useSyncExternalStore, type DependencyList } from 'react';

import { db } from '../client';
import type { DbOrTx } from '../types';

/** SQLite table names (src/db/schema.ts). */
export type DbTable =
  | 'shop_settings'
  | 'categories'
  | 'products'
  | 'colours'
  | 'photos'
  | 'stock_moves'
  | 'customers'
  | 'customer_events'
  | 'sales'
  | 'sale_items'
  | 'customer_catalogue_items'
  | 'reports';

let version = 0;
const tableVersions = new Map<string, number>();
const pendingTables = new Set<string>();
const subscribers = new Set<() => void>();
let frame: number | null = null;
let subscription: { remove: () => void } | null = null;

/** Records a change to `tableName`; subscribers hear about it on the next frame. Exported for tests. */
export function noteDatabaseChange(tableName: string): void {
  pendingTables.add(tableName);
  if (frame !== null) return;
  frame = requestAnimationFrame(() => {
    frame = null;
    version += 1;
    pendingTables.forEach((t) => tableVersions.set(t, (tableVersions.get(t) ?? 0) + 1));
    pendingTables.clear();
    subscribers.forEach((notify) => notify());
  });
}

function ensureSubscribed(): void {
  if (subscription) return;
  subscription = addDatabaseChangeListener((event) => noteDatabaseChange(event.tableName));
}

function subscribe(onChange: () => void): () => void {
  ensureSubscribed();
  subscribers.add(onChange);
  return () => {
    subscribers.delete(onChange);
  };
}

const noSubscribe = () => () => undefined;
const getVersion = () => version;

/** Change count over `tables` (the sum of their versions), or of the whole database. */
function versionOf(tableKey: string): number {
  if (!tableKey) return version;
  let sum = 0;
  for (const t of tableKey.split(',')) sum += tableVersions.get(t) ?? 0;
  return sum;
}

/** Current database version; bumps (at most once per frame) after any write. */
export function useDbVersion(): number {
  return useSyncExternalStore(subscribe, getVersion, getVersion);
}

/** True unless rendered inside a route that is not focused. */
function useScreenFocused(): boolean {
  return use(IsFocusedContext) ?? true;
}

function sameDeps(a: DependencyList, b: DependencyList): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false;
  return true;
}

type Cached<T> = { v: number; deps: DependencyList; value: T };

export type DbQueryOptions = {
  /** Tables the query reads. Omit when unsure: it then re-runs after any write. */
  tables?: readonly DbTable[];
  /** false: keep the last result and don't re-run (it runs once on mount). Default true. */
  enabled?: boolean;
};

/**
 * `useDbQuery((d) => salesSummary(d, range), [range.from, range.to])` → the result,
 * recomputed when `deps` change or the database changes (see the file comment for when not).
 * `query` itself is not compared: pass every input it reads as `deps`.
 */
export function useDbQuery<T>(query: (database: DbOrTx) => T, deps: DependencyList, options: DbQueryOptions = {}): T {
  const focused = useScreenFocused();
  const active = focused && options.enabled !== false;
  const tableKey = options.tables ? [...options.tables].sort().join(',') : '';
  const getSnapshot = useCallback(() => versionOf(tableKey), [tableKey]);
  // Inactive: no subscription, so database changes don't even re-render the component.
  const v = useSyncExternalStore(active ? subscribe : noSubscribe, getSnapshot, getSnapshot);
  const [cached, setCached] = useState<Cached<T>>(() => ({ v, deps, value: query(db) }));
  if (active && (cached.v !== v || !sameDeps(cached.deps, deps))) {
    // Derived-state update during render (React re-renders immediately, before committing).
    const next: Cached<T> = { v, deps, value: query(db) };
    setCached(next);
    return next.value;
  }
  return cached.value;
}
