import { Directory, File } from 'expo-file-system';

import { photosDir } from '@/lib/files';
import { formatBytes, storageUsage } from '@/lib/storage';

import { resetFakeFs } from './fakeFileSystem';

jest.mock('expo-file-system', () => require('@/lib/__tests__/fakeFileSystem'));
jest.mock('@/db/client', () => ({ DB_NAME: 'gathir.db' }));
jest.mock('expo-image-manipulator', () => ({ ImageManipulator: {}, SaveFormat: {} }));
jest.mock('expo-image-picker', () => ({}));
jest.mock('@shopify/react-native-skia', () => ({ Skia: {}, ColorType: {}, AlphaType: {} }));

describe('formatBytes', () => {
  it('formats with 1024 steps', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(-5)).toBe('0 B');
    expect(formatBytes(Number.NaN)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(250 * 1024)).toBe('250 KB');
    expect(formatBytes(412_000_000)).toBe('393 MB');
    expect(formatBytes(3 * 1024 ** 3)).toBe('3 GB');
  });
});

describe('storageUsage', () => {
  beforeEach(() => resetFakeFs());
  it('adds photos, database and exports', async () => {
    await new File(photosDir(), 'a.jpg').write(new Uint8Array(100));
    await new File(photosDir(), 'a.thumb.jpg').write(new Uint8Array(10));
    await new File(photosDir(), 'b.jpg').write(new Uint8Array(50));
    const sqlite = new Directory('file:///doc/SQLite');
    sqlite.create();
    await new File(sqlite, 'gathir.db').write(new Uint8Array(40));
    await new File(sqlite, 'gathir.db-wal').write(new Uint8Array(2));
    expect(storageUsage()).toEqual({ photosBytes: 160, photoCount: 2, dbBytes: 42, exportsBytes: 0 });
  });
});
