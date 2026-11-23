/**
 * Backup & restore (PLAN §3 Safety, §8 Backups).
 *
 * createBackup → one zip (manifest + data.json + photos) in the exports cache, then shareBackup.
 * pickAndRestoreBackup → document picker → validate → swap photos safely → import all tables.
 *
 * Both directions stream (backupStream.ts): one photo is in memory at a time, written to the zip
 * file (or the staging folder) before the next is read, with an await per photo so the JS thread
 * keeps running. Photos run to hundreds of MB on a 3–4 GB phone (PLAN §8, §12).
 */
import * as Application from 'expo-application';
import * as DocumentPicker from 'expo-document-picker';
import { File, FileMode } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { exportAllTables, importAllTables } from '@/db/repo/backup';
import { getSettings, updateSettings } from '@/db/repo/settings';
import type { DbOrTx } from '@/db/types';
import { cleanupOldExports, freshExportFile, isSafeFileName, photosDir } from '@/lib/files';

import { BACKUP_MIME, backupFileName, buildManifest, stampLastBackupAt, type BackupCounts } from './backupFormat';
import { readBackupZip, writeBackupZip, type ByteSource } from './backupStream';
import { beginStaging, commitPhotoSwap, rollbackPhotoSwap, stagePhoto, swapInStagedPhotos } from './photoFolderSwap';
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
/** This phone's PIN flag and owner number, read before a restore replaces the settings row. */
function readDeviceGuarded(db: DbOrTx): { pinHashSet: boolean; ownerWhatsapp: string } | null {
  try {
    const s = getSettings(db);
    return { pinHashSet: s.pinHashSet, ownerWhatsapp: s.ownerWhatsapp };
  } catch {
    return null;
  }
}

/**
 * Settings a restore must not take from the zip (pure):
 * - `pinHashSet`: the PIN hash lives in this phone's secure store, not in the backup, so the flag
 *   stays THIS phone's (else the lock could claim a PIN that does not exist here, or drop one);
 * - `ownerWhatsapp` while this phone has a PIN: the owner number changes only with the PIN
 *   (PLAN §3), and a backup zip is plain JSON anyone holding the phone could pick or edit.
 */
export function guardedSettingsPatch(
  device: { pinHashSet: boolean; ownerWhatsapp: string } | null,
  restored: { pinHashSet: boolean; ownerWhatsapp: string },
): { pinHashSet?: boolean; ownerWhatsapp?: string } {
  if (!device) return {};
  const patch: { pinHashSet?: boolean; ownerWhatsapp?: string } = {};
  if (restored.pinHashSet !== device.pinHashSet) patch.pinHashSet = device.pinHashSet;
  if (device.pinHashSet && restored.ownerWhatsapp !== device.ownerWhatsapp) patch.ownerWhatsapp = device.ownerWhatsapp;
  return patch;
}

/** Names of the files in the photos folder (read one at a time while the zip is written). */
function listPhotoNames(): string[] {
  const dir = photosDir();
  if (!dir.exists) return [];
  return dir
    .list()
    .filter((entry): entry is File => entry instanceof File && isSafeFileName(entry.name))
    .map((entry) => entry.name);
}

/**
 * Builds `Gathir-backup-<shop>-<yyyy-mm-dd>.zip` in the exports folder and records
 * `settings.lastBackupAt`. Throws on file-system errors (show `backup:errors.createFailed`).
 */
export async function createBackup(db: DbOrTx, now: number = Date.now()): Promise<CreatedBackup> {
  cleanupOldExports(now);
  const data = stampLastBackupAt(exportAllTables(db, now), now);
  const photoNames = listPhotoNames();
  const manifest = buildManifest({
    appVersion: Application.nativeApplicationVersion ?? '0.0.0',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    createdAt: now,
    data,
    photoFiles: photoNames.length,
  });

  const file = freshExportFile(backupFileName(getSettings(db, now).shopName, now));
  file.create();
  const handle = file.open(FileMode.WriteOnly);
  let sizeBytes: number;
  try {
    sizeBytes = await writeBackupZip(
      { write: (chunk) => handle.writeBytes(chunk) },
      { manifest, data, photoNames, readPhoto: (name) => new File(photosDir(), name).bytes() },
    );
  } catch (e) {
    handle.close();
    if (file.exists) file.delete();
    throw e;
  }
  handle.close();
  updateSettings(db, { lastBackupAt: now }, now);
  return { file, uri: file.uri, sizeBytes, counts: manifest.counts };
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
  let handle: ReturnType<File['open']>;
  let size: number;
  try {
    handle = new File(uri).open(FileMode.ReadOnly);
    size = handle.size ?? 0;
  } catch (e) {
    return { ok: false, reason: 'invalid', message: `Could not read file: ${errorMessage(e)}` };
  }
  const source: ByteSource = {
    size,
    read: (offset, length) => {
      handle.offset = offset;
      return handle.readBytes(length);
    },
  };

  // Photos go straight from the zip into the staging folder, one at a time (nothing live is
  // touched until the swap below).
  let writeError: unknown = null;
  let parsed: Awaited<ReturnType<typeof readBackupZip>>;
  try {
    try {
      beginStaging();
    } catch (e) {
      writeError = e;
      throw e;
    }
    parsed = await readBackupZip(source, CURRENT_SCHEMA_VERSION, async (name, bytes) => {
      try {
        await stagePhoto(name, bytes);
      } catch (e) {
        writeError = e;
        throw e;
      }
    });
  } catch (e) {
    rollbackPhotoSwap();
    if (writeError) return { ok: false, reason: 'failed', message: `Could not write photos: ${errorMessage(writeError)}` };
    return { ok: false, reason: 'invalid', message: `Could not read file: ${errorMessage(e)}` };
  } finally {
    handle.close();
  }
  if (!parsed.ok) {
    rollbackPhotoSwap();
    return parsed;
  }

  // Keep THIS phone's PIN flag, and its owner number while a PIN guards it (guardedSettingsPatch).
  const device = readDeviceGuarded(db);
  try {
    swapInStagedPhotos();
    importAllTables(db, parsed.data);
    const patch = guardedSettingsPatch(device, getSettings(db));
    if (Object.keys(patch).length > 0) updateSettings(db, patch);
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
