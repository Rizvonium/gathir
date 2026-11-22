/** "Storage used" numbers (PLAN §8, §15): photos, database and generated exports. */
import { Directory, File, Paths } from 'expo-file-system';

import { DB_NAME } from '@/db/client';

import { dirUsage, documentSubdir, EXPORTS_DIR_NAME, PHOTOS_DIR_NAME } from './files';
import { isThumbName } from './photos';

export type StorageUsage = {
  /** Full photos + thumbnails, in bytes. */
  photosBytes: number;
  /** Number of full-size photos (thumbnails not counted). */
  photoCount: number;
  /** SQLite database including its WAL/SHM side files. */
  dbBytes: number;
  /** PDFs, images and backup zips waiting in the exports cache. */
  exportsBytes: number;
};

/** expo-sqlite keeps databases in `<document>/SQLite` on Android. */
function dbFiles(): File[] {
  const dir = new Directory(Paths.document, 'SQLite');
  return ['', '-wal', '-shm'].map((suffix) => new File(dir, `${DB_NAME}${suffix}`));
}

/** Measures what the app stores on the phone. Synchronous file-system reads; call from an effect. */
export function storageUsage(): StorageUsage {
  const photos = dirUsage(documentSubdir(PHOTOS_DIR_NAME), (name) => !isThumbName(name));
  const exportsUsage = dirUsage(new Directory(Paths.cache, EXPORTS_DIR_NAME));
  const dbBytes = dbFiles().reduce((sum, f) => sum + (f.exists ? f.size : 0), 0);
  return { photosBytes: photos.bytes, photoCount: photos.files, dbBytes, exportsBytes: exportsUsage.bytes };
}

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

/**
 * Human-readable size with 1024 steps: 0 → "0 B", 1536 → "1.5 KB", 412_000_000 → "393 MB".
 * One decimal below 10 units, whole numbers above.
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  if (unit === 0) return `${Math.round(value)} B`;
  const rounded = value < 10 ? Math.round(value * 10) / 10 : Math.round(value);
  return `${rounded} ${UNITS[unit]}`;
}
