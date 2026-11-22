/**
 * Backup & restore (PLAN §3 Safety, §8 Backups).
 *
 * createBackup → one zip (manifest + data.json + photos) in the exports cache, then shareBackup.
 * pickAndRestoreBackup → document picker → validate → swap photos safely → import all tables.
 *
 * v1 note: fflate's zipSync/unzipSync work on whole buffers, so the zip and all photos are in
 * memory together (≈ photos size × 2). Fine for a few hundred MB on 3 GB phones; streaming zip
 * is a later improvement.
 */
import * as Application from 'expo-application';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { exportAllTables, importAllTables } from '@/db/repo/backup';
import { getSettings, updateSettings } from '@/db/repo/settings';
import type { DbOrTx } from '@/db/types';
import { cleanupOldExports, freshExportFile, isSafeFileName, photosDir } from '@/lib/files';

import {
  assembleBackupZip,
  BACKUP_MIME,
  backupFileName,
  buildManifest,
  parseBackupZip,
  stampLastBackupAt,
  type BackupCounts,
} from './backupFormat';
import { commitPhotoSwap, rollbackPhotoSwap, stagePhotos, swapInStagedPhotos } from './photoFolderSwap';
import { CURRENT_SCHEMA_VERSION } from './schemaVersion';

export type CreatedBackup = {
  file: File;
  /** `file://` URI, ready for shareBackup. */
  uri: string;
  sizeBytes: number;
  counts: BackupCounts;
};

export type RestoreFailureReason = 'cancelled' | 'invalid' | 'newer_version' | 'failed';

/**
 * `message` is for logs only. Screens show `t(\`backup:errors.${reason}\`)`.
 */
export type RestoreResult =
  | { ok: true; counts: BackupCounts }
  | { ok: false; reason: RestoreFailureReason; message: string };

/**
 * Picker filter. Android file managers label zips from WhatsApp/Drive in many ways (or not at
 * all), so accept any file: parseBackupZip validates the contents before anything changes.
 */
const ZIP_TYPES = ['*/*'];

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** This phone's "PIN is set" flag, or null if settings cannot be read (restore goes on). */
function readDevicePinFlag(db: DbOrTx): boolean | null {
  try {
    return getSettings(db).pinHashSet;
  } catch {
    return null;
  }
}

/** Reads every file of the photos folder as bytes (sequentially, to limit peak work). */
async function readAllPhotos(): Promise<Map<string, Uint8Array>> {
  const photos = new Map<string, Uint8Array>();
  for (const entry of photosDir().list()) {
    if (entry instanceof File && isSafeFileName(entry.name)) {
      photos.set(entry.name, await entry.bytes());
    }
  }
  return photos;
}

/**
 * Builds `Gathir-backup-<shop>-<yyyy-mm-dd>.zip` in the exports folder and records
 * `settings.lastBackupAt`. Throws on file-system errors (show `backup:errors.createFailed`).
 */
export async function createBackup(db: DbOrTx, now: number = Date.now()): Promise<CreatedBackup> {
  cleanupOldExports(now);
  const data = stampLastBackupAt(exportAllTables(db, now), now);
  const photos = await readAllPhotos();
  const manifest = buildManifest({
    appVersion: Application.nativeApplicationVersion ?? '0.0.0',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    createdAt: now,
    data,
    photoFiles: photos.size,
  });
  const zip = assembleBackupZip({ manifest, data, photos });
  photos.clear();

  const file = freshExportFile(backupFileName(getSettings(db, now).shopName, now));
  file.create();
  await file.write(zip);
  updateSettings(db, { lastBackupAt: now }, now);
  return { file, uri: file.uri, sizeBytes: zip.byteLength, counts: manifest.counts };
}

/**
 * Opens the Android share sheet for a backup zip (Drive, WhatsApp, USB…).
 * Returns false when sharing is not available on this device.
 */
export async function shareBackup(file: File | string, dialogTitle?: string): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) return false;
  const uri = typeof file === 'string' ? file : file.uri;
  await Sharing.shareAsync(uri, { mimeType: BACKUP_MIME, dialogTitle });
  return true;
}

/**
 * Restores from a zip already on the phone (e.g. opened from another app).
 * Replaces ALL data and photos. Photos are swapped back if the import fails.
 */
export async function restoreBackupFromUri(db: DbOrTx, uri: string): Promise<RestoreResult> {
  let bytes: Uint8Array;
  try {
    bytes = await new File(uri).bytes();
  } catch (e) {
    return { ok: false, reason: 'invalid', message: `Could not read file: ${errorMessage(e)}` };
  }

  const parsed = parseBackupZip(bytes, CURRENT_SCHEMA_VERSION);
  if (!parsed.ok) return parsed;

  try {
    await stagePhotos(parsed.photos);
  } catch (e) {
    rollbackPhotoSwap();
    return { ok: false, reason: 'failed', message: `Could not write photos: ${errorMessage(e)}` };
  }
  parsed.photos.clear();

  // The PIN hash lives in this phone's secure store, not in the backup, so the restored
  // settings must keep THIS phone's "PIN is set" flag (else the lock could claim a PIN that
  // does not exist here, or silently drop one that does).
  const devicePinSet = readDevicePinFlag(db);
  try {
    swapInStagedPhotos();
    importAllTables(db, parsed.data);
    if (devicePinSet !== null && getSettings(db).pinHashSet !== devicePinSet) {
      updateSettings(db, { pinHashSet: devicePinSet });
    }
  } catch (e) {
    rollbackPhotoSwap();
    const invalid = e instanceof Error && 'code' in e && e.code === 'invalid';
    return { ok: false, reason: invalid ? 'invalid' : 'failed', message: errorMessage(e) };
  }
  commitPhotoSwap();
  return { ok: true, counts: parsed.manifest.counts };
}

/** Lets the user pick a backup zip and restores it. Never throws. */
export async function pickAndRestoreBackup(db: DbOrTx): Promise<RestoreResult> {
  let picked: DocumentPicker.DocumentPickerResult;
  try {
    picked = await DocumentPicker.getDocumentAsync({ type: ZIP_TYPES, copyToCacheDirectory: true, multiple: false });
  } catch (e) {
    return { ok: false, reason: 'failed', message: errorMessage(e) };
  }
  const asset = picked.canceled ? undefined : picked.assets[0];
  if (!asset) return { ok: false, reason: 'cancelled', message: 'No file picked' };

  try {
    return await restoreBackupFromUri(db, asset.uri);
  } catch (e) {
    return { ok: false, reason: 'failed', message: errorMessage(e) };
  } finally {
    try {
      const copy = new File(asset.uri);
      if (copy.exists) copy.delete();
    } catch {
      // The picker's cache copy is cleaned by the OS eventually.
    }
  }
}
