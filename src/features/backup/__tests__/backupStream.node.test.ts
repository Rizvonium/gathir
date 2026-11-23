import { strToU8, unzipSync, zipSync } from 'fflate';

import { exportAllTables } from '@/db/repo/backup';
import { insertSampleData } from '@/db/sampleData';
import { createTestDb } from '@/test/testDb';

import { assembleBackupZip, buildManifest, type BackupManifest } from '../backupFormat';
import { readBackupZip, writeBackupZip, type ByteSource } from '../backupStream';

const T0 = new Date(2026, 10, 22, 15, 30).getTime();

/** A zip in memory as a random-access source that records every read. */
function sourceOf(bytes: Uint8Array) {
  const reads: number[] = [];
  const src: ByteSource = {
    size: bytes.byteLength,
    read: async (offset, length) => {
      reads.push(Math.min(length, bytes.byteLength - offset));
      return bytes.slice(offset, offset + length);
    },
  };
  return { src, reads };
}

function photo(seed: number, size: number): Uint8Array {
  const b = new Uint8Array(size);
  for (let i = 0; i < size; i++) b[i] = (seed * 31 + i) & 0xff;
  return b;
}

function fixture() {
  const db = createTestDb();
  insertSampleData(db, T0);
  const data = exportAllTables(db, T0);
  const photos = new Map([
    ['a.jpg', photo(1, 40_000)],
    ['a.thumb.jpg', photo(2, 4_000)],
    ['b.jpg', photo(3, 50_000)],
  ]);
  const manifest = buildManifest({ appVersion: '1.0.0', schemaVersion: 1, createdAt: T0, data, photoFiles: photos.size });
  return { data, photos, manifest };
}

async function writeToMemory(input: { manifest: BackupManifest; data: ReturnType<typeof exportAllTables>; photos: Map<string, Uint8Array> }) {
  const chunks: Uint8Array[] = [];
  const readOrder: string[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const size = await writeBackupZip(
    { write: async (c) => void chunks.push(c) },
    {
      manifest: input.manifest,
      data: input.data,
      photoNames: [...input.photos.keys(), '../evil.jpg'],
      readPhoto: async (name) => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        readOrder.push(name);
        const bytes = input.photos.get(name) as Uint8Array;
        // Released again once the next one is asked for: the writer awaits each photo in turn.
        queueMicrotask(() => inFlight--);
        return bytes;
      },
    },
  );
  const zip = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    zip.set(c, at);
    at += c.byteLength;
  }
  return { zip, chunks, readOrder, maxInFlight };
}

describe('writeBackupZip', () => {
  it('streams a standard zip, one photo at a time, in many small chunks', async () => {
    const f = fixture();
    const { zip, chunks, readOrder, maxInFlight } = await writeToMemory(f);
    expect(readOrder).toEqual(['a.jpg', 'a.thumb.jpg', 'b.jpg']);
    expect(maxInFlight).toBe(1);
    // No chunk is the whole archive: each photo is handed on as it is added.
    expect(chunks.length).toBeGreaterThan(5);
    expect(Math.max(...chunks.map((c) => c.byteLength))).toBeLessThan(zip.byteLength / 2);

    // Any zip reader can open it (fflate's whole-buffer reader here).
    const files = unzipSync(zip);
    expect(Object.keys(files).sort()).toEqual(['data.json', 'manifest.json', 'photos/a.jpg', 'photos/a.thumb.jpg', 'photos/b.jpg']);
    expect(files['photos/b.jpg']).toEqual(f.photos.get('b.jpg'));
    expect(JSON.parse(new TextDecoder().decode(files['manifest.json']))).toEqual(f.manifest);
  });
});

describe('readBackupZip', () => {
  it('round-trips a streamed backup, handing photos over one at a time', async () => {
    const f = fixture();
    const { zip } = await writeToMemory(f);
    const { src, reads } = sourceOf(zip);
    const got = new Map<string, Uint8Array>();
    const result = await readBackupZip(src, 1, async (name, bytes) => void got.set(name, bytes));
    expect(result).toMatchObject({ ok: true, manifest: f.manifest, photoFiles: 3 });
    expect(result.ok && result.data).toEqual(JSON.parse(JSON.stringify(f.data)));
    expect(got).toEqual(f.photos);
    // Never the whole file in one read.
    expect(Math.max(...reads)).toBeLessThan(zip.byteLength / 2);
  });

  it('reads backups made by the older whole-buffer writer', async () => {
    const f = fixture();
    const zip = assembleBackupZip({ manifest: f.manifest, data: f.data, photos: f.photos });
    const got = new Map<string, Uint8Array>();
    const result = await readBackupZip(sourceOf(zip).src, 1, async (name, bytes) => void got.set(name, bytes));
    expect(result.ok).toBe(true);
    expect(got).toEqual(f.photos);
  });

  it('rejects a wrong file, a newer schema or an unsafe photo name before handing over any photo', async () => {
    const onPhoto = jest.fn(async () => undefined);
    expect(await readBackupZip(sourceOf(new Uint8Array([1, 2, 3])).src, 1, onPhoto)).toMatchObject({ ok: false, reason: 'invalid' });

    const f = fixture();
    const noManifest = zipSync({ 'photos/a.jpg': photo(1, 10), 'data.json': strToU8('{}') });
    expect(await readBackupZip(sourceOf(noManifest).src, 1, onPhoto)).toMatchObject({ ok: false, reason: 'invalid' });

    const { zip } = await writeToMemory({ ...f, manifest: { ...f.manifest, schemaVersion: 9 } });
    expect(await readBackupZip(sourceOf(zip).src, 1, onPhoto)).toMatchObject({ ok: false, reason: 'newer_version' });

    const evil = zipSync({
      'manifest.json': strToU8(JSON.stringify(f.manifest)),
      'data.json': strToU8('{}'),
      'photos/a.jpg': photo(1, 10),
      'photos/../x.jpg': photo(2, 10),
    });
    expect(await readBackupZip(sourceOf(evil).src, 1, onPhoto)).toMatchObject({ ok: false, reason: 'invalid' });

    const noData = zipSync({ 'manifest.json': strToU8(JSON.stringify(f.manifest)), 'photos/a.jpg': photo(1, 10) });
    expect(await readBackupZip(sourceOf(noData).src, 1, onPhoto)).toMatchObject({ ok: false, reason: 'invalid' });
    expect(onPhoto).not.toHaveBeenCalled();
  });

  it('reports a truncated zip as invalid', async () => {
    const f = fixture();
    const { zip } = await writeToMemory(f);
    const result = await readBackupZip(sourceOf(zip.slice(0, zip.byteLength - 30)).src, 1, async () => undefined);
    expect(result).toMatchObject({ ok: false, reason: 'invalid' });
  });
});
