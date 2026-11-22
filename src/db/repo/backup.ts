/** Whole-database export/import for backup & restore (the media layer zips this with photos). */
import { asc, getTableName } from 'drizzle-orm';

import {
  categories,
  colours,
  customerEvents,
  customers,
  photos,
  products,
  reports,
  saleItems,
  sales,
  shopSettings,
  stockMoves,
} from '../schema';
import type { DbOrTx } from '../types';
import { chunk } from './constants';
import { RepoError } from './errors';

export const BACKUP_FORMAT = 'gathir-backup';
export const BACKUP_VERSION = 1;

/** Tables in foreign-key-safe insert order (delete in reverse). */
const TABLES = [shopSettings, categories, products, colours, photos, stockMoves, customers, customerEvents, sales, saleItems, reports] as const;

type Row = Record<string, unknown>;
export type BackupData = {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: number;
  tables: Record<string, Row[]>;
};

/** Every row of every table as plain JSON-serialisable objects. */
export function exportAllTables(db: DbOrTx, now: number = Date.now()): BackupData {
  const tables: Record<string, Row[]> = {};
  for (const t of TABLES) {
    tables[getTableName(t)] = db.select().from(t).orderBy(asc(t.id)).all() as Row[];
  }
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: now, tables };
}

/** Throws RepoError('invalid') unless `data` looks like a backup this app version can read. */
export function validateBackup(data: unknown): asserts data is BackupData {
  const d = data as Partial<BackupData> | null;
  if (!d || d.format !== BACKUP_FORMAT || typeof d.version !== 'number' || !d.tables) {
    throw new RepoError('Not a Gathir backup', 'invalid');
  }
  if (d.version > BACKUP_VERSION) throw new RepoError('Backup is from a newer app version', 'invalid');
  for (const t of TABLES) {
    const rows = d.tables[getTableName(t)];
    if (rows !== undefined && !Array.isArray(rows)) throw new RepoError(`Bad table ${getTableName(t)}`, 'invalid');
  }
}

/** Replaces ALL data with the backup's rows in one transaction (all-or-nothing). */
export function importAllTables(db: DbOrTx, data: unknown): void {
  validateBackup(data);
  db.transaction((tx) => {
    for (const t of [...TABLES].reverse()) tx.delete(t).run();
    for (const t of TABLES) {
      const rows = data.tables[getTableName(t)] ?? [];
      for (const part of chunk(rows, 50)) {
        // Rows come from exportAllTables of the same schema version; drizzle maps them by column key.
        tx.insert(t)
          .values(part as (typeof t.$inferInsert)[])
          .run();
      }
    }
  });
}
