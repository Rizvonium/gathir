import { strToU8, unzipSync, zipSync } from 'fflate';

import { exportAllTables, importAllTables } from '@/db/repo/backup';
import { insertSampleData } from '@/db/sampleData';
import { createTestDb } from '@/test/testDb';

import {
  assembleBackupZip,
  backupFileName,
  buildManifest,
  isoDate,
  isSafeBackupFileName,
  parseBackupZip,
  slugify,
  stampLastBackupAt,
  validateManifest,
  type BackupManifest,
} from '../backupFormat';
import { CURRENT_SCHEMA_VERSION } from '../schemaVersion';

const T0 = new Date(2026, 10, 22, 15, 30).getTime();

function sampleManifest(overrides: Partial<BackupManifest> = {}): BackupManifest {
  return {
    app: 'gathir',
    appVersion: '1.0.0',
    schemaVersion: 1,
    createdAt: T0,
    counts: { tables: { products: 2 }, photoFiles: 0 },
    ...overrides,
  };
}

describe('file naming', () => {
  it('slugifies shop names to safe ASCII', () => {
    expect(slugify("Mir's Shawl House")).toBe('mirs-shawl-house');
    expect(slugify('  Café — Pashmina  ')).toBe('cafe-pashmina');
    expect(slugify('کشمیر')).toBe('shop');
    expect(slugify('')).toBe('shop');
    expect(slugify('a'.repeat(50)).length).toBe(32);
  });
  it('builds the dated backup file name', () => {
    expect(isoDate(new Date(2026, 0, 5, 23, 59).getTime())).toBe('2026-01-05');
    const name = backupFileName('Mir Shawls', T0);
    expect(name).toBe('Gathir-backup-mir-shawls-2026-11-22.zip');
    expect(isSafeBackupFileName(name)).toBe(true);
  });
});

describe('validateManifest', () => {
  it('accepts a current or older manifest', () => {
    expect(validateManifest(sampleManifest(), 1)).toEqual({ ok: true, manifest: sampleManifest() });
    expect(validateManifest(sampleManifest({ schemaVersion: 1 }), 3).ok).toBe(true);
  });
  it('rejects other apps and damaged manifests', () => {
    expect(validateManifest(null, 1)).toMatchObject({ ok: false, reason: 'invalid' });
    expect(validateManifest({ ...sampleManifest(), app: 'other' }, 1)).toMatchObject({ reason: 'invalid' });
    expect(validateManifest({ ...sampleManifest(), schemaVersion: '1' }, 1)).toMatchObject({ reason: 'invalid' });
    expect(validateManifest({ ...sampleManifest(), schemaVersion: 0 }, 1)).toMatchObject({ reason: 'invalid' });
    expect(validateManifest({ ...sampleManifest(), counts: { tables: { a: -1 }, photoFiles: 0 } }, 1)).toMatchObject({
      reason: 'invalid',
    });
  });
  it('flags backups from a newer schema', () => {
    expect(validateManifest(sampleManifest({ schemaVersion: 2 }), 1)).toMatchObject({ ok: false, reason: 'newer_version' });
  });
});

describe('zip round trip', () => {
  it('restores every table and photo into a fresh database', () => {
    const db = createTestDb();
    insertSampleData(db, T0);
    const data = exportAllTables(db, T0);
    const photos = new Map([
      ['a.jpg', new Uint8Array([0xff, 0xd8, 1, 2, 3])],
      ['a.thumb.jpg', new Uint8Array([0xff, 0xd8, 9])],
    ]);
    const manifest = buildManifest({
      appVersion: '1.0.0',
      schemaVersion: CURRENT_SCHEMA_VERSION,
      createdAt: T0,
      data,
      photoFiles: photos.size,
    });
    expect(manifest.counts.photoFiles).toBe(2);
    expect(manifest.counts.tables.products).toBe(data.tables.products?.length);

    const zip = assembleBackupZip({ manifest, data, photos });
    expect(Object.keys(unzipSync(zip)).sort()).toEqual(['data.json', 'manifest.json', 'photos/a.jpg', 'photos/a.thumb.jpg']);

    const parsed = parseBackupZip(zip, CURRENT_SCHEMA_VERSION);
    if (!parsed.ok) throw new Error(parsed.message);
    expect(parsed.manifest).toEqual(manifest);
    expect([...parsed.photos.entries()]).toEqual([...photos.entries()]);

    const fresh = createTestDb({ seed: false });
    importAllTables(fresh, parsed.data);
    expect(exportAllTables(fresh, T0)).toEqual(data);
  });

  it('works with no photos', () => {
    const data = exportAllTables(createTestDb(), T0);
    const manifest = buildManifest({ appVersion: '1', schemaVersion: 1, createdAt: T0, data, photoFiles: 0 });
    const parsed = parseBackupZip(assembleBackupZip({ manifest, data, photos: new Map() }), 1);
    expect(parsed.ok && parsed.photos.size).toBe(0);
  });

  it('skips unsafe photo names when writing', () => {
    const data = exportAllTables(createTestDb(), T0);
    const manifest = buildManifest({ appVersion: '1', schemaVersion: 1, createdAt: T0, data, photoFiles: 1 });
    const zip = assembleBackupZip({ manifest, data, photos: new Map([['../evil', new Uint8Array([1])]]) });
    expect(Object.keys(unzipSync(zip)).some((k) => k.includes('evil'))).toBe(false);
  });
});

describe('stampLastBackupAt', () => {
  it('sets lastBackupAt on the settings row without mutating the input', () => {
    const data = exportAllTables(createTestDb(), T0);
    const stamped = stampLastBackupAt(data, T0);
    expect(stamped.tables.shop_settings?.[0]?.lastBackupAt).toBe(T0);
    expect(data.tables.shop_settings?.[0]?.lastBackupAt).toBeNull();
    expect(stamped.tables.products).toBe(data.tables.products);
  });
});

describe('parseBackupZip failures', () => {
  const manifestBytes = (m: unknown) => strToU8(JSON.stringify(m));

  it('rejects non-zip bytes', () => {
    expect(parseBackupZip(strToU8('hello'), 1)).toMatchObject({ ok: false, reason: 'invalid' });
  });
  it('rejects a zip without a manifest', () => {
    expect(parseBackupZip(zipSync({ 'data.json': strToU8('{}') }), 1)).toMatchObject({ reason: 'invalid' });
  });
  it('rejects a newer schema before reading data', () => {
    const zip = zipSync({ 'manifest.json': manifestBytes(sampleManifest({ schemaVersion: 9 })) });
    expect(parseBackupZip(zip, 1)).toMatchObject({ ok: false, reason: 'newer_version' });
  });
  it('rejects missing or broken data.json', () => {
    const m = manifestBytes(sampleManifest());
    expect(parseBackupZip(zipSync({ 'manifest.json': m }), 1)).toMatchObject({ reason: 'invalid' });
    expect(parseBackupZip(zipSync({ 'manifest.json': m, 'data.json': strToU8('{oops') }), 1)).toMatchObject({
      reason: 'invalid',
    });
  });
  it('rejects path traversal in photo entries', () => {
    const zip = zipSync({
      'manifest.json': manifestBytes(sampleManifest()),
      'data.json': strToU8('{}'),
      'photos/../../db.sqlite': new Uint8Array([1]),
    });
    expect(parseBackupZip(zip, 1)).toMatchObject({ ok: false, reason: 'invalid' });
  });
});
