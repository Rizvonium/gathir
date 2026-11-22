/**
 * In-memory test database (Node only). Runs the real drizzle migrations against
 * better-sqlite3, which exposes the same synchronous drizzle API as expo-sqlite.
 */
import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import * as schema from '@/db/schema';
import { ensureSeedData } from '@/db/seed';
import type { DbOrTx } from '@/db/types';

export function createTestDb(opts: { seed?: boolean } = {}): DbOrTx {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const dir = path.join(__dirname, '../../drizzle');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    const sqlText = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const stmt of sqlText.split('--> statement-breakpoint')) {
      if (stmt.trim()) sqlite.exec(stmt);
    }
  }
  const db = drizzle(sqlite, { schema });
  if (opts.seed !== false) ensureSeedData(db, '+919000000000', 1_700_000_000_000);
  return db;
}
