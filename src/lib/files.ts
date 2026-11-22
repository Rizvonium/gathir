/**
 * App file locations (expo-file-system class API).
 *
 * - Product photos live in `<document>/photos` (private, survives app updates, included in backups).
 * - Generated PDFs and backup zips live in `<cache>/exports` and are cleaned up after a day.
 */
import { Directory, File, Paths } from 'expo-file-system';

export const PHOTOS_DIR_NAME = 'photos';
export const EXPORTS_DIR_NAME = 'exports';
/** Generated exports older than this are deleted by `cleanupOldExports`. */
export const EXPORT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Creates `dir` (and parents) if it does not exist yet. Returns the same directory. */
export function ensureDir(dir: Directory): Directory {
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

/** `<document>/<name>` without creating it. Used by restore to stage/swap photo folders. */
export function documentSubdir(name: string): Directory {
  return new Directory(Paths.document, name);
}

/** The photos folder, created on first use. */
export function photosDir(): Directory {
  return ensureDir(documentSubdir(PHOTOS_DIR_NAME));
}

/**
 * True when `name` is a plain file name we generated (no path separators, no `..`).
 * Guards every place where a name from the database or a backup zip becomes a path.
 */
export function isSafeFileName(name: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(name) && !name.includes('..');
}

function assertSafeName(name: string): void {
  if (!isSafeFileName(name)) throw new Error(`Unsafe file name: ${name}`);
}

/** A full-size photo file in the photos folder (may not exist). */
export function photoFile(name: string): File {
  assertSafeName(name);
  return new File(photosDir(), name);
}

/** A thumbnail file in the photos folder (thumbnails sit next to the full photos). */
export function thumbFile(name: string): File {
  return photoFile(name);
}

/** The cache folder for generated PDFs, images and backup zips, created on first use. */
export function exportsDir(): Directory {
  return ensureDir(new Directory(Paths.cache, EXPORTS_DIR_NAME));
}

/** A file in the exports folder; an existing file with that name is deleted first. */
export function freshExportFile(name: string): File {
  assertSafeName(name);
  const file = new File(exportsDir(), name);
  if (file.exists) file.delete();
  return file;
}

/** True when an export last modified at `modifiedAt` is older than `maxAgeMs` at `now`. */
export function isExpired(modifiedAt: number | null | undefined, now: number, maxAgeMs: number = EXPORT_MAX_AGE_MS): boolean {
  if (modifiedAt == null) return true;
  return now - modifiedAt > maxAgeMs;
}

/**
 * Deletes exports older than `maxAgeMs` (default 24 h). Never throws: a file that is still
 * being shared just stays until the next cleanup. Returns how many entries were deleted.
 */
export function cleanupOldExports(now: number = Date.now(), maxAgeMs: number = EXPORT_MAX_AGE_MS): number {
  let deleted = 0;
  try {
    for (const entry of exportsDir().list()) {
      const modified = entry instanceof File ? entry.lastModified : entry.info().modificationTime;
      if (!isExpired(modified, now, maxAgeMs)) continue;
      try {
        entry.delete();
        deleted += 1;
      } catch {
        // In use or already gone: try again next time.
      }
    }
  } catch {
    // Listing failed (e.g. folder removed by the system): nothing to clean.
  }
  return deleted;
}

/** Sum of file sizes in `dir` (non-recursive) and the number of files that pass `filter`. */
export function dirUsage(dir: Directory, filter: (name: string) => boolean = () => true): { bytes: number; files: number } {
  let bytes = 0;
  let files = 0;
  if (!dir.exists) return { bytes, files };
  for (const entry of dir.list()) {
    if (!(entry instanceof File)) continue;
    bytes += entry.size;
    if (filter(entry.name)) files += 1;
  }
  return { bytes, files };
}
