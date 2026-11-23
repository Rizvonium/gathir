import { Directory, File } from 'expo-file-system';

import {
  cleanupOldExports,
  dirUsage,
  EXPORT_MAX_AGE_MS,
  exportsDir,
  freshExportFile,
  isExpired,
  isSafeFileName,
  isShareableUri,
  photoFile,
  photosDir,
} from '@/lib/files';

import { listFiles, resetFakeFs, setMtime } from './fakeFileSystem';

jest.mock('expo-file-system', () => require('@/lib/__tests__/fakeFileSystem'));

beforeEach(() => resetFakeFs());

describe('isSafeFileName', () => {
  it('accepts generated names', () => {
    expect(isSafeFileName('3f2a-11.jpg')).toBe(true);
    expect(isSafeFileName('3f2a-11.thumb.jpg')).toBe(true);
    expect(isSafeFileName('Gathir-backup-shop-2026-11-22.zip')).toBe(true);
  });
  it('rejects paths and tricks', () => {
    for (const bad of ['', '../x.jpg', 'a/b.jpg', 'a\\b.jpg', '.hidden', 'a..jpg', 'x'.repeat(200), 'ü.jpg']) {
      expect(isSafeFileName(bad)).toBe(false);
    }
  });
});

describe('isExpired', () => {
  it('compares age with the limit', () => {
    expect(isExpired(0, EXPORT_MAX_AGE_MS)).toBe(false);
    expect(isExpired(0, EXPORT_MAX_AGE_MS + 1)).toBe(true);
    expect(isExpired(null, 0)).toBe(true);
    expect(isExpired(100, 150, 10)).toBe(true);
  });
});

describe('folders', () => {
  it('creates the photos folder on first use and builds file paths in it', () => {
    expect(new Directory('file:///doc/photos').exists).toBe(false);
    expect(photosDir().uri).toBe('file:///doc/photos');
    expect(new Directory('file:///doc/photos').exists).toBe(true);
    expect(photoFile('a.jpg').uri).toBe('file:///doc/photos/a.jpg');
    expect(() => photoFile('../db')).toThrow('Unsafe');
  });

  it('freshExportFile replaces an existing file', async () => {
    const f = freshExportFile('x.zip');
    f.create();
    await f.write(new Uint8Array([1, 2]));
    const again = freshExportFile('x.zip');
    expect(again.exists).toBe(false);
    expect(again.uri).toBe('file:///cache/exports/x.zip');
  });

  it('cleanupOldExports deletes only old entries', async () => {
    const now = 10 * EXPORT_MAX_AGE_MS;
    const oldFile = new File(exportsDir(), 'old.pdf');
    await oldFile.write(new Uint8Array([1]));
    setMtime(oldFile.uri, now - EXPORT_MAX_AGE_MS - 1);
    const newFile = new File(exportsDir(), 'new.pdf');
    await newFile.write(new Uint8Array([1]));
    setMtime(newFile.uri, now - 1000);
    expect(cleanupOldExports(now)).toBe(1);
    expect(listFiles('file:///cache/exports')).toEqual(['file:///cache/exports/new.pdf']);
  });

  it('dirUsage sums bytes and counts filtered files', async () => {
    await new File(photosDir(), 'a.jpg').write(new Uint8Array(10));
    await new File(photosDir(), 'a.thumb.jpg').write(new Uint8Array(3));
    expect(dirUsage(photosDir(), (n) => !n.includes('.thumb.'))).toEqual({ bytes: 13, files: 1 });
    expect(dirUsage(new Directory('file:///doc/none'))).toEqual({ bytes: 0, files: 0 });
  });
});

describe('isShareableUri', () => {
  it('accepts only what the react-native-share FileProvider can serve', () => {
    expect(isShareableUri('file:///cache/exports/a.pdf')).toBe(true);
    expect(isShareableUri('content://media/external/images/1')).toBe(true);
    // App photos (documents folder) would become a null attachment.
    expect(isShareableUri('file:///doc/photos/a.jpg')).toBe(false);
    expect(isShareableUri('file:///cache/../doc/photos/a.jpg')).toBe(false);
    expect(isShareableUri('')).toBe(false);
    expect(isShareableUri(null)).toBe(false);
    expect(isShareableUri('https://example.com/a.jpg')).toBe(false);
  });
});
