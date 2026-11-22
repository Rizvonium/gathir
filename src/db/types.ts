import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import type * as schema from './schema';

/**
 * Any synchronous drizzle SQLite database or transaction using our schema.
 * The app passes the expo-sqlite `db`; unit tests pass a better-sqlite3 db.
 * Repository functions take this as their first argument so they are testable in Node.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DbOrTx = BaseSQLiteDatabase<'sync', any, typeof schema>;
