/**
 * Streaming backup zip I/O (pure: no expo imports, runs in Node tests).
 *
 * A shop's photos run to hundreds of MB (PLAN §8), so neither side holds the whole zip, or all
 * photos, in memory:
 * - writeBackupZip feeds fflate's streaming `Zip` one photo at a time (stored, level 0) and hands
 *   each output chunk to a sink (a file handle) before reading the next photo;
 * - readBackupZip reads the zip's central directory through random access, checks the manifest
 *   and every photo name first, then reads photos one at a time and hands each to a callback
 *   (written straight to the staging folder).
 * Every photo is its own await, so the JS thread is never blocked for the whole backup.
 *
 * The zip format is the one in backupFormat.ts (manifest.json, data.json, photos/<name>); zips
 * written by the older whole-buffer assembleBackupZip read back the same way.
 */
import { inflateSync, strFromU8, strToU8, Zip, ZipDeflate, ZipPassThrough } from 'fflate';

import type { BackupData } from '@/db/repo/backup';

import {
  DATA_PATH,
  isSafeBackupFileName,
  MANIFEST_PATH,
  PHOTOS_PREFIX,
  validateManifest,
  type BackupFailureReason,
  type BackupManifest,
} from './backupFormat';

/** Where zip output goes, in order. */
export type ByteSink = { write: (chunk: Uint8Array) => Promise<void> };

/** Random-access reads from a zip on disk. */
export type ByteSource = { size: number; read: (offset: number, length: number) => Promise<Uint8Array> };

/**
 * Writes manifest.json, data.json (deflated) and photos/<name> (stored) to `sink`, reading one
 * photo at a time. Unsafe photo names are skipped. Returns the zip size in bytes.
 */
export async function writeBackupZip(
  sink: ByteSink,
  input: {
    manifest: BackupManifest;
    data: BackupData;
    photoNames: readonly string[];
    readPhoto: (name: string) => Promise<Uint8Array>;
  },
): Promise<number> {
  const pending: Uint8Array[] = [];
  let failure: Error | null = null;
  let total = 0;
  const zip = new Zip((err, chunk) => {
    if (err) failure = err;
    else pending.push(chunk);
  });
  const flush = async () => {
    if (failure) throw failure;
    while (pending.length > 0) {
      const chunk = pending.shift() as Uint8Array;
      total += chunk.byteLength;
      await sink.write(chunk);
    }
  };
  const mtime = new Date(input.manifest.createdAt);

  const addJson = async (path: string, value: unknown, pretty: boolean) => {
    const entry = new ZipDeflate(path, { level: 6 });
    entry.mtime = mtime;
    zip.add(entry);
    entry.push(strToU8(pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value)), true);
    await flush();
  };
  await addJson(MANIFEST_PATH, input.manifest, true);
  await addJson(DATA_PATH, input.data, false);

  for (const name of input.photoNames) {
    if (!isSafeBackupFileName(name)) continue;
    const bytes = await input.readPhoto(name);
    const entry = new ZipPassThrough(`${PHOTOS_PREFIX}${name}`);
    entry.mtime = mtime;
    zip.add(entry);
    entry.push(bytes, true);
    await flush();
  }
  zip.end();
  await flush();
  return total;
}

type ZipEntry = { name: string; method: number; compressedSize: number; localHeaderOffset: number };

const EOCD_SIG = 0x06054b50;
const CEN_SIG = 0x02014b50;
const LOC_SIG = 0x04034b50;
const EOCD_MIN = 22;

const u16 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
const u32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

/** Reads the central directory, or null when this is not a (supported) zip. */
async function listEntries(src: ByteSource): Promise<ZipEntry[] | null> {
  if (src.size < EOCD_MIN) return null;
  // The end record sits in the last 22 bytes, plus a comment of up to 64 KB (Gathir writes
  // none): look in a small tail first, then the largest possible one.
  const findEnd = async (window: number) => {
    const tailLength = Math.min(src.size, window);
    const tail = await src.read(src.size - tailLength, tailLength);
    for (let i = tail.length - EOCD_MIN; i >= 0; i--) if (u32(tail, i) === EOCD_SIG) return { tail, at: i };
    return null;
  };
  const found = (await findEnd(EOCD_MIN + 1024)) ?? (src.size > EOCD_MIN + 1024 ? await findEnd(EOCD_MIN + 0xffff) : null);
  if (!found) return null;
  const { tail, at: eocd } = found;
  const count = u16(tail, eocd + 10);
  const cdSize = u32(tail, eocd + 12);
  const cdOffset = u32(tail, eocd + 16);
  // Zip64 (over 4 GB or 65,535 entries) is never written by Gathir.
  if (count === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) return null;
  if (cdOffset + cdSize > src.size) return null;

  const cd = await src.read(cdOffset, cdSize);
  const entries: ZipEntry[] = [];
  let p = 0;
  for (let i = 0; i < count; i++) {
    if (p + 46 > cd.length || u32(cd, p) !== CEN_SIG) return null;
    const nameLength = u16(cd, p + 28);
    const extraLength = u16(cd, p + 30);
    const commentLength = u16(cd, p + 32);
    entries.push({
      method: u16(cd, p + 10),
      compressedSize: u32(cd, p + 20),
      localHeaderOffset: u32(cd, p + 42),
      name: strFromU8(cd.subarray(p + 46, p + 46 + nameLength)),
    });
    p += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

/** One entry's content (stored or deflated). Throws on a damaged entry. */
async function readEntry(src: ByteSource, entry: ZipEntry): Promise<Uint8Array> {
  const header = await src.read(entry.localHeaderOffset, 30);
  if (header.length < 30 || u32(header, 0) !== LOC_SIG) throw new Error(`Damaged zip entry: ${entry.name}`);
  const start = entry.localHeaderOffset + 30 + u16(header, 26) + u16(header, 28);
  const raw = await src.read(start, entry.compressedSize);
  if (raw.length !== entry.compressedSize) throw new Error(`Truncated zip entry: ${entry.name}`);
  if (entry.method === 0) return raw;
  if (entry.method === 8) return inflateSync(raw);
  throw new Error(`Unsupported compression in ${entry.name}`);
}

function parseJson(bytes: Uint8Array): unknown {
  try {
    return JSON.parse(strFromU8(bytes));
  } catch {
    return undefined;
  }
}

export type StreamedBackup =
  | { ok: true; manifest: BackupManifest; data: Record<string, unknown>; photoFiles: number }
  | { ok: false; reason: BackupFailureReason; message: string };

/**
 * Reads and validates a backup zip. The manifest, data.json and every photo name are checked
 * before any photo is read, so a wrong or unsafe file fails before anything is written. Then
 * each photo is read and passed to `onPhoto` (awaited) one at a time.
 * Errors thrown by `onPhoto` propagate; damaged photo entries return `invalid`.
 */
export async function readBackupZip(
  src: ByteSource,
  currentSchemaVersion: number,
  onPhoto: (name: string, bytes: Uint8Array) => Promise<void>,
): Promise<StreamedBackup> {
  const entries = await listEntries(src);
  if (!entries) return { ok: false, reason: 'invalid', message: 'File is not a zip' };
  const byName = new Map(entries.map((e) => [e.name, e]));

  const read = async (entry: ZipEntry | undefined): Promise<Uint8Array | null> => {
    if (!entry) return null;
    try {
      return await readEntry(src, entry);
    } catch {
      return null;
    }
  };

  const manifestBytes = await read(byName.get(MANIFEST_PATH));
  const checked = validateManifest(manifestBytes ? parseJson(manifestBytes) : undefined, currentSchemaVersion);
  if (!checked.ok) return checked;

  const dataBytes = await read(byName.get(DATA_PATH));
  const data = dataBytes ? parseJson(dataBytes) : undefined;
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return { ok: false, reason: 'invalid', message: 'data.json missing or damaged' };
  }

  const photos: { name: string; entry: ZipEntry }[] = [];
  for (const entry of entries) {
    if (!entry.name.startsWith(PHOTOS_PREFIX) || entry.name === PHOTOS_PREFIX) continue;
    const name = entry.name.slice(PHOTOS_PREFIX.length);
    if (!isSafeBackupFileName(name)) {
      return { ok: false, reason: 'invalid', message: `Unsafe photo path in backup: ${entry.name}` };
    }
    photos.push({ name, entry });
  }

  for (const { name, entry } of photos) {
    const bytes = await read(entry);
    if (!bytes) return { ok: false, reason: 'invalid', message: `Zip is damaged: ${entry.name}` };
    await onPhoto(name, bytes);
  }
  return { ok: true, manifest: checked.manifest, data: data as Record<string, unknown>, photoFiles: photos.length };
}
