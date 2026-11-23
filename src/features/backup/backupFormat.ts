/**
 * Pure backup zip format (no expo imports, runs in Node tests).
 *
 * Layout of `Gathir-backup-<shop>-<yyyy-mm-dd>.zip`:
 *   manifest.json   BackupManifest (app id, versions, counts)
 *   data.json       BackupData from exportAllTables (src/db/repo/backup.ts)
 *   photos/<name>   every file of the app's photos folder (JPEG, stored uncompressed)
 */
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';

import type { BackupData } from '@/db/repo/backup';

export const BACKUP_APP_ID = 'gathir';
export const MANIFEST_PATH = 'manifest.json';
export const DATA_PATH = 'data.json';
export const PHOTOS_PREFIX = 'photos/';
export const BACKUP_MIME = 'application/zip';

export type BackupCounts = {
  /** Row count per table name. */
  tables: Record<string, number>;
  /** Number of files in photos/ (full photos + thumbnails). */
  photoFiles: number;
};

export type BackupManifest = {
  app: typeof BACKUP_APP_ID;
  appVersion: string;
  /** Number of drizzle migrations applied when the backup was made. */
  schemaVersion: number;
  createdAt: number;
  counts: BackupCounts;
};

export type BackupFailureReason = 'invalid' | 'newer_version';

export type ParsedBackup = {
  manifest: BackupManifest;
  /** Parsed data.json; importAllTables validates its shape. */
  data: unknown;
  /** Photo file name (without the photos/ prefix) → bytes. */
  photos: Map<string, Uint8Array>;
};

export type ParseResult =
  | ({ ok: true } & ParsedBackup)
  | { ok: false; reason: BackupFailureReason; message: string };

/** Same rule as `isSafeFileName` in src/lib/files.ts: a bare file name, no paths. */
export function isSafeBackupFileName(name: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(name) && !name.includes('..');
}

/**
 * Returns `data` with `lastBackupAt = createdAt` on the settings row, so a restored phone
 * shows when this backup was made (the live row is updated separately after the zip is written).
 */
export function stampLastBackupAt(data: BackupData, createdAt: number): BackupData {
  const settings = data.tables.shop_settings;
  if (!settings) return data;
  return {
    ...data,
    tables: { ...data.tables, shop_settings: settings.map((row) => ({ ...row, lastBackupAt: createdAt })) },
  };
}

/** Builds the manifest for an export. */
export function buildManifest(input: {
  appVersion: string;
  schemaVersion: number;
  createdAt: number;
  data: BackupData;
  photoFiles: number;
}): BackupManifest {
  const tables: Record<string, number> = {};
  for (const [name, rows] of Object.entries(input.data.tables)) tables[name] = rows.length;
  return {
    app: BACKUP_APP_ID,
    appVersion: input.appVersion,
    schemaVersion: input.schemaVersion,
    createdAt: input.createdAt,
    counts: { tables, photoFiles: input.photoFiles },
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isCountMap(v: unknown): v is Record<string, number> {
  return isRecord(v) && Object.values(v).every((n) => Number.isInteger(n) && (n as number) >= 0);
}

/**
 * Checks a parsed manifest.json. `newer_version` when the backup was made by an app with more
 * migrations than this one (the user must update the app first).
 */
export function validateManifest(
  raw: unknown,
  currentSchemaVersion: number,
): { ok: true; manifest: BackupManifest } | { ok: false; reason: BackupFailureReason; message: string } {
  if (!isRecord(raw) || raw.app !== BACKUP_APP_ID) {
    return { ok: false, reason: 'invalid', message: 'Not a Gathir backup' };
  }
  const { appVersion, schemaVersion, createdAt, counts } = raw;
  if (
    typeof appVersion !== 'string' ||
    !Number.isInteger(schemaVersion) ||
    (schemaVersion as number) < 1 ||
    typeof createdAt !== 'number' ||
    !isRecord(counts) ||
    !isCountMap(counts.tables) ||
    !Number.isInteger(counts.photoFiles)
  ) {
    return { ok: false, reason: 'invalid', message: 'Backup manifest is damaged' };
  }
  if ((schemaVersion as number) > currentSchemaVersion) {
    return {
      ok: false,
      reason: 'newer_version',
      message: `Backup schema ${String(schemaVersion)} is newer than this app (${currentSchemaVersion})`,
    };
  }
  return { ok: true, manifest: raw as BackupManifest };
}

/** Lowercase ASCII slug for file names: "Mir's Shawl House" → "mirs-shawl-house"; empty → "shop". */
export function slugify(text: string, maxLength = 32): string {
  const slug = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
  return slug || 'shop';
}

/** Local calendar date as yyyy-mm-dd. */
export function isoDate(ms: number): string {
  const d = new Date(ms);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** "Gathir-backup-<shop>-<yyyy-mm-dd>.zip" */
export function backupFileName(shopName: string, now: number): string {
  return `Gathir-backup-${slugify(shopName)}-${isoDate(now)}.zip`;
}

/**
 * Assembles the zip in memory (whole buffers: tests and small zips only; the app writes and
 * reads backups with the streaming backupStream.ts, which produces the same layout). Photos are stored without compression (JPEG does not shrink),
 * JSON is deflated. Unsafe photo names are skipped.
 */
export function assembleBackupZip(input: {
  manifest: BackupManifest;
  data: BackupData;
  photos: ReadonlyMap<string, Uint8Array>;
}): Uint8Array {
  // Flat keys ("photos/a.jpg") so no empty directory entry is written.
  const entries: Zippable = {
    [MANIFEST_PATH]: strToU8(JSON.stringify(input.manifest, null, 2)),
    [DATA_PATH]: strToU8(JSON.stringify(input.data)),
  };
  for (const [name, bytes] of input.photos) {
    if (isSafeBackupFileName(name)) entries[`${PHOTOS_PREFIX}${name}`] = [bytes, { level: 0 }];
  }
  return zipSync(entries, { level: 6, mtime: new Date(input.manifest.createdAt) });
}

function parseJson(bytes: Uint8Array | undefined): unknown {
  if (!bytes) return undefined;
  try {
    return JSON.parse(strFromU8(bytes));
  } catch {
    return undefined;
  }
}

function unzipOrNull(bytes: Uint8Array, only?: (name: string) => boolean): ReturnType<typeof unzipSync> | null {
  try {
    return unzipSync(bytes, only ? { filter: (f) => only(f.name) } : undefined);
  } catch {
    return null;
  }
}

/**
 * Reads and validates a backup zip held in memory (the app uses backupStream.readBackupZip). The manifest is checked before the photos are inflated,
 * so a wrong file fails fast. Photo entries with unsafe names (path traversal) are rejected.
 */
export function parseBackupZip(bytes: Uint8Array, currentSchemaVersion: number): ParseResult {
  const head = unzipOrNull(bytes, (name) => name === MANIFEST_PATH);
  if (!head) return { ok: false, reason: 'invalid', message: 'File is not a zip' };
  const checked = validateManifest(parseJson(head[MANIFEST_PATH]), currentSchemaVersion);
  if (!checked.ok) return checked;

  const all = unzipOrNull(bytes);
  if (!all) return { ok: false, reason: 'invalid', message: 'Zip is damaged' };
  const data = parseJson(all[DATA_PATH]);
  if (!isRecord(data)) return { ok: false, reason: 'invalid', message: 'data.json missing or damaged' };

  const photos = new Map<string, Uint8Array>();
  for (const [path, content] of Object.entries(all)) {
    if (!path.startsWith(PHOTOS_PREFIX) || path === PHOTOS_PREFIX) continue;
    const name = path.slice(PHOTOS_PREFIX.length);
    if (!isSafeBackupFileName(name)) {
      return { ok: false, reason: 'invalid', message: `Unsafe photo path in backup: ${path}` };
    }
    photos.set(name, content);
  }
  return { ok: true, manifest: checked.manifest, data, photos };
}
