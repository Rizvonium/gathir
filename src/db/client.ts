import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

import * as schema from './schema';

export type { DbOrTx } from './types';

export const DB_NAME = 'gathir.db';

/** One shared connection. `enableChangeListener` powers drizzle's useLiveQuery. */
export const expoDb = openDatabaseSync(DB_NAME, { enableChangeListener: true });
expoDb.execSync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

export const db = drizzle(expoDb, { schema });
export type AppDb = typeof db;
