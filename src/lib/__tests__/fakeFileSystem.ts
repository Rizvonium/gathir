/**
 * Minimal in-memory stand-in for the expo-file-system class API (File, Directory, Paths),
 * covering only what src/lib/files.ts and src/features/backup use. Node tests only:
 *   jest.mock('expo-file-system', () => require('@/lib/__tests__/fakeFileSystem'));
 */
type Entry = { kind: 'file'; bytes: Uint8Array; mtime: number } | { kind: 'dir'; mtime: number };

const store = new Map<string, Entry>();
let clock = 1_000;

function join(parts: (string | { uri: string })[]): string {
  return parts
    .map((p) => (typeof p === 'string' ? p : p.uri))
    .join('/')
    .replace(/([^:/])\/+/g, '$1/')
    .replace(/\/$/, '');
}

function parentOf(uri: string): string {
  return uri.slice(0, uri.lastIndexOf('/'));
}

function baseName(uri: string): string {
  return uri.slice(uri.lastIndexOf('/') + 1);
}

function childrenOf(uri: string): string[] {
  return [...store.keys()].filter((k) => parentOf(k) === uri);
}

function moveTree(from: string, to: string): void {
  for (const key of [...store.keys()]) {
    if (key === from || key.startsWith(`${from}/`)) {
      const entry = store.get(key) as Entry;
      store.delete(key);
      store.set(to + key.slice(from.length), entry);
    }
  }
}

/** Clears everything and recreates the document and cache roots. */
export function resetFakeFs(): void {
  store.clear();
  clock = 1_000;
  store.set('file:///doc', { kind: 'dir', mtime: 0 });
  store.set('file:///cache', { kind: 'dir', mtime: 0 });
}

/** Sets the modification time of an existing entry (for age-based cleanup tests). */
export function setMtime(uri: string, mtime: number): void {
  const e = store.get(uri);
  if (e) e.mtime = mtime;
}

/** All file URIs under `prefix`, sorted. */
export function listFiles(prefix: string): string[] {
  return [...store.entries()]
    .filter(([k, e]) => e.kind === 'file' && k.startsWith(prefix))
    .map(([k]) => k)
    .sort();
}

export class File {
  uri: string;
  constructor(...parts: (string | File | Directory)[]) {
    this.uri = join(parts);
  }
  get name(): string {
    return baseName(this.uri);
  }
  get exists(): boolean {
    return store.get(this.uri)?.kind === 'file';
  }
  get size(): number {
    const e = store.get(this.uri);
    return e?.kind === 'file' ? e.bytes.byteLength : 0;
  }
  get lastModified(): number | null {
    return store.get(this.uri)?.mtime ?? null;
  }
  create(): void {
    if (store.has(this.uri)) throw new Error(`exists: ${this.uri}`);
    if (store.get(parentOf(this.uri))?.kind !== 'dir') throw new Error(`no parent: ${this.uri}`);
    store.set(this.uri, { kind: 'file', bytes: new Uint8Array(), mtime: clock++ });
  }
  async write(content: Uint8Array | string): Promise<void> {
    if (store.get(parentOf(this.uri))?.kind !== 'dir') throw new Error(`no parent: ${this.uri}`);
    const bytes = typeof content === 'string' ? new TextEncoder().encode(content) : new Uint8Array(content);
    store.set(this.uri, { kind: 'file', bytes, mtime: clock++ });
  }
  async bytes(): Promise<Uint8Array> {
    const e = store.get(this.uri);
    if (e?.kind !== 'file') throw new Error(`missing: ${this.uri}`);
    return e.bytes;
  }
  delete(): void {
    if (!this.exists) throw new Error(`missing: ${this.uri}`);
    store.delete(this.uri);
  }
  moveSync(dest: File): void {
    const e = store.get(this.uri);
    if (e?.kind !== 'file') throw new Error(`missing: ${this.uri}`);
    store.delete(this.uri);
    store.set(dest.uri, e);
    this.uri = dest.uri;
  }
}

export class Directory {
  uri: string;
  constructor(...parts: (string | File | Directory)[]) {
    this.uri = join(parts);
  }
  get name(): string {
    return baseName(this.uri);
  }
  get exists(): boolean {
    return store.get(this.uri)?.kind === 'dir';
  }
  create(opts: { intermediates?: boolean; idempotent?: boolean } = {}): void {
    if (this.exists) {
      if (opts.idempotent) return;
      throw new Error(`exists: ${this.uri}`);
    }
    if (!opts.intermediates && store.get(parentOf(this.uri))?.kind !== 'dir') throw new Error(`no parent: ${this.uri}`);
    store.set(this.uri, { kind: 'dir', mtime: clock++ });
  }
  delete(): void {
    if (!this.exists) throw new Error(`missing: ${this.uri}`);
    for (const key of [...store.keys()]) if (key === this.uri || key.startsWith(`${this.uri}/`)) store.delete(key);
  }
  rename(newName: string): void {
    const to = `${parentOf(this.uri)}/${newName}`;
    if (store.has(to)) throw new Error(`exists: ${to}`);
    moveTree(this.uri, to);
    this.uri = to;
  }
  list(): (File | Directory)[] {
    if (!this.exists) throw new Error(`missing: ${this.uri}`);
    return childrenOf(this.uri).map((k) => (store.get(k)?.kind === 'dir' ? new Directory(k) : new File(k)));
  }
  info(): { exists: boolean; modificationTime?: number } {
    const e = store.get(this.uri);
    return e ? { exists: true, modificationTime: e.mtime } : { exists: false };
  }
}

export const Paths = {
  get document(): Directory {
    return new Directory('file:///doc');
  },
  get cache(): Directory {
    return new Directory('file:///cache');
  },
};

resetFakeFs();
