/**
 * Safe replacement of the photos folder during restore.
 *
 *   stage:    write backup photos into photos_new          (nothing live touched)
 *   swap:     photos → photos_old, photos_new → photos
 *   commit:   delete photos_old                             (after the DB import succeeded)
 *   rollback: delete photos, photos_old → photos           (DB import failed)
 *
 * If the app is killed half-way, `recoverInterruptedRestore()` on next start puts things back
 * without losing any photo file.
 */
import { Directory, File } from 'expo-file-system';

import { documentSubdir, PHOTOS_DIR_NAME } from '@/lib/files';

export const STAGING_DIR_NAME = 'photos_new';
export const OLD_DIR_NAME = 'photos_old';

function removeDir(name: string): void {
  const dir = documentSubdir(name);
  if (dir.exists) dir.delete();
}

/** Starts a fresh, empty staging folder (stagePhoto then adds files to it one by one). */
export function beginStaging(): void {
  removeDir(STAGING_DIR_NAME);
  documentSubdir(STAGING_DIR_NAME).create({ intermediates: true });
}

/** Writes one photo into the staging folder (call beginStaging first). */
export async function stagePhoto(name: string, bytes: Uint8Array): Promise<void> {
  const file = new File(documentSubdir(STAGING_DIR_NAME), name);
  file.create();
  await file.write(bytes);
}

/** Writes all photos into a fresh staging folder, one file at a time. */
export async function stagePhotos(photos: ReadonlyMap<string, Uint8Array>): Promise<void> {
  beginStaging();
  for (const [name, bytes] of photos) await stagePhoto(name, bytes);
}

/** Makes the staged folder live and keeps the previous one as photos_old. */
export function swapInStagedPhotos(): void {
  removeDir(OLD_DIR_NAME);
  const live = documentSubdir(PHOTOS_DIR_NAME);
  if (live.exists) live.rename(OLD_DIR_NAME);
  documentSubdir(STAGING_DIR_NAME).rename(PHOTOS_DIR_NAME);
}

/** Deletes the previous photos after a successful import. */
export function commitPhotoSwap(): void {
  removeDir(OLD_DIR_NAME);
}

/** Restores the previous photos folder after a failed import. Never throws. */
export function rollbackPhotoSwap(): void {
  try {
    removeDir(STAGING_DIR_NAME);
    const old = documentSubdir(OLD_DIR_NAME);
    if (!old.exists) return; // swap never happened, live folder untouched
    removeDir(PHOTOS_DIR_NAME);
    old.rename(PHOTOS_DIR_NAME);
  } catch {
    recoverInterruptedRestore();
  }
}

/** Moves files from `from` into `to` unless a file with the same name is already there. */
function mergeMissingFiles(from: Directory, to: Directory): void {
  for (const entry of from.list()) {
    if (!(entry instanceof File)) continue;
    const target = new File(to, entry.name);
    if (!target.exists) entry.moveSync(target);
  }
}

/**
 * Call once at app start (before screens read photos). Cleans up after a restore that was
 * interrupted by a crash or kill. Lossless: when unsure, it keeps both sets of files.
 */
export function recoverInterruptedRestore(): void {
  try {
    const old = documentSubdir(OLD_DIR_NAME);
    if (old.exists) {
      const live = documentSubdir(PHOTOS_DIR_NAME);
      if (!live.exists) {
        old.rename(PHOTOS_DIR_NAME);
      } else {
        mergeMissingFiles(old, live);
        old.delete();
      }
    }
    removeDir(STAGING_DIR_NAME);
  } catch {
    // Leave folders as they are; the next start tries again.
  }
}
