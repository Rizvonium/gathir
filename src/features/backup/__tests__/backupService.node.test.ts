import { Directory, File } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';

import { exportAllTables } from '@/db/repo/backup';
import { getSettings, updateSettings } from '@/db/repo/settings';
import { insertSampleData } from '@/db/sampleData';
import { products } from '@/db/schema';
import { listFiles, resetFakeFs } from '@/lib/__tests__/fakeFileSystem';
import { photosDir } from '@/lib/files';
import { createTestDb } from '@/test/testDb';

import { createBackup, pickAndRestoreBackup, restoreBackupFromUri } from '../backupService';
import { recoverInterruptedRestore, stagePhotos, swapInStagedPhotos } from '../photoFolderSwap';

jest.mock('expo-file-system', () => require('@/lib/__tests__/fakeFileSystem'));
jest.mock('expo-application', () => ({ nativeApplicationVersion: '1.2.3' }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(async () => true), shareAsync: jest.fn(async () => {}) }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));

const T0 = new Date(2026, 10, 22, 10, 0).getTime();
const getDocumentAsync = DocumentPicker.getDocumentAsync as jest.Mock;

async function putPhoto(name: string, bytes: number[]): Promise<void> {
  await new File(photosDir(), name).write(new Uint8Array(bytes));
}

async function bytesOf(uri: string): Promise<number[]> {
  return [...(await new File(uri).bytes())];
}

beforeEach(() => {
  resetFakeFs();
  getDocumentAsync.mockReset();
});

describe('createBackup + restore', () => {
  it('backs up and restores data and photos, replacing what is there', async () => {
    const source = createTestDb();
    insertSampleData(source, T0);
    await putPhoto('p1.jpg', [1, 1]);
    await putPhoto('p1.thumb.jpg', [2]);

    const backup = await createBackup(source, T0);
    expect(backup.uri).toMatch(/^file:\/\/\/cache\/exports\/Gathir-backup-.*-2026-11-22\.zip$/);
    expect(backup.sizeBytes).toBeGreaterThan(0);
    expect(backup.counts.photoFiles).toBe(2);
    expect(getSettings(source).lastBackupAt).toBe(T0);

    // A "new phone" with different photos and an empty database.
    new Directory('file:///doc/photos').delete();
    await putPhoto('other.jpg', [9]);
    const target = createTestDb();

    const result = await restoreBackupFromUri(target, backup.uri);
    expect(result).toEqual({ ok: true, counts: backup.counts });
    expect(listFiles('file:///doc/')).toEqual(['file:///doc/photos/p1.jpg', 'file:///doc/photos/p1.thumb.jpg']);
    expect(await bytesOf('file:///doc/photos/p1.jpg')).toEqual([1, 1]);
    const { shop_settings: restoredSettings, ...restored } = exportAllTables(target, 0).tables;
    const { shop_settings: sourceSettings, ...original } = exportAllTables(source, 0).tables;
    expect(restored).toEqual(original);
    // The settings row carries the time of the backup it came from.
    expect(restoredSettings?.[0]?.lastBackupAt).toBe(T0);
    expect(sourceSettings?.[0]?.lastBackupAt).toBe(T0);
  });

  it("keeps this phone's PIN flag, since the PIN itself lives in secure storage", async () => {
    const source = createTestDb();
    updateSettings(source, { pinHashSet: true }, T0);
    const backup = await createBackup(source, T0);

    const newPhone = createTestDb();
    expect(await restoreBackupFromUri(newPhone, backup.uri)).toMatchObject({ ok: true });
    expect(getSettings(newPhone).pinHashSet).toBe(false);

    const lockedPhone = createTestDb();
    updateSettings(lockedPhone, { pinHashSet: true }, T0);
    const plain = createTestDb();
    const plainBackup = await createBackup(plain, T0 + 1);
    expect(await restoreBackupFromUri(lockedPhone, plainBackup.uri)).toMatchObject({ ok: true });
    expect(getSettings(lockedPhone).pinHashSet).toBe(true);
  });

  it('rolls photos back when the database import fails', async () => {
    const source = createTestDb();
    await putPhoto('new.jpg', [1]);
    const backup = await createBackup(source, T0);

    new Directory('file:///doc/photos').delete();
    await putPhoto('keep.jpg', [7]);
    const target = createTestDb();
    const before = target.select().from(products).all();
    const failing = {
      ...target,
      transaction: () => {
        throw new Error('disk full');
      },
    } as unknown as typeof target;
    // importAllTables uses db.transaction, so a throwing transaction simulates a failed import.
    const result = await restoreBackupFromUri(failing, backup.uri);
    expect(result).toMatchObject({ ok: false, reason: 'failed', message: 'disk full' });
    expect(listFiles('file:///doc/')).toEqual(['file:///doc/photos/keep.jpg']);
    expect(target.select().from(products).all()).toEqual(before);
  });

  it('reports a non-backup file as invalid without touching photos', async () => {
    await putPhoto('keep.jpg', [7]);
    const junk = new File('file:///cache/junk.zip');
    await junk.write(new Uint8Array([1, 2, 3]));
    const result = await restoreBackupFromUri(createTestDb(), junk.uri);
    expect(result).toMatchObject({ ok: false, reason: 'invalid' });
    expect(listFiles('file:///doc/')).toEqual(['file:///doc/photos/keep.jpg']);
  });
});

describe('pickAndRestoreBackup', () => {
  it('returns cancelled when the picker is closed', async () => {
    getDocumentAsync.mockResolvedValue({ canceled: true, assets: null });
    expect(await pickAndRestoreBackup(createTestDb())).toMatchObject({ ok: false, reason: 'cancelled' });
  });

  it('restores the picked file and deletes the picker copy', async () => {
    const backup = await createBackup(createTestDb(), T0);
    const copy = new File('file:///cache/picked.zip');
    await copy.write(await backup.file.bytes());
    getDocumentAsync.mockResolvedValue({ canceled: false, assets: [{ uri: copy.uri, name: 'b.zip', lastModified: 0 }] });
    expect(await pickAndRestoreBackup(createTestDb())).toMatchObject({ ok: true });
    expect(new File(copy.uri).exists).toBe(false);
  });
});

describe('recoverInterruptedRestore', () => {
  it('puts the old folder back when killed mid-swap', async () => {
    await putPhoto('old.jpg', [1]);
    await stagePhotos(new Map([['new.jpg', new Uint8Array([2])]]));
    new Directory('file:///doc/photos').rename('photos_old'); // killed after first rename
    recoverInterruptedRestore();
    expect(listFiles('file:///doc/')).toEqual(['file:///doc/photos/old.jpg']);
  });

  it('keeps both sets of files when killed after the swap', async () => {
    await putPhoto('old.jpg', [1]);
    await putPhoto('same.jpg', [1]);
    await stagePhotos(new Map([['new.jpg', new Uint8Array([2])], ['same.jpg', new Uint8Array([2])]]));
    swapInStagedPhotos();
    recoverInterruptedRestore();
    expect(listFiles('file:///doc/')).toEqual([
      'file:///doc/photos/new.jpg',
      'file:///doc/photos/old.jpg',
      'file:///doc/photos/same.jpg',
    ]);
    expect(await bytesOf('file:///doc/photos/same.jpg')).toEqual([2]);
  });

  it('removes an abandoned staging folder', async () => {
    await putPhoto('a.jpg', [1]);
    await stagePhotos(new Map([['b.jpg', new Uint8Array([2])]]));
    recoverInterruptedRestore();
    expect(listFiles('file:///doc/')).toEqual(['file:///doc/photos/a.jpg']);
  });
});
