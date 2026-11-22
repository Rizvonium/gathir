/** Short, stable checksum of report data (printed in PDF footers to spot edited copies). Pure TS. */

/** JSON with object keys sorted at every level, so equal data always gives equal text. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined && typeof v !== 'function')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}

const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const MASK_64 = 0xffffffffffffffffn;

/** 10-character base-36 FNV-1a (64-bit) hash of the canonical JSON of `data`. */
export function computeFingerprint(data: unknown): string {
  const text = canonicalJson(data);
  let hash = FNV_OFFSET;
  for (let i = 0; i < text.length; i++) {
    hash ^= BigInt(text.charCodeAt(i));
    hash = (hash * FNV_PRIME) & MASK_64;
  }
  return hash.toString(36).padStart(13, '0').slice(-10);
}
