/**
 * Every static `t('key')` in the app resolves to a string in src/i18n/en/*.json.
 *
 * How a key's namespace is found, per file:
 * - an explicit prefix wins: t('common:actions.undo');
 * - `const { t } = useTranslation('ns')` / `const { t: tc } = useTranslation('ns')` bind a
 *   translator name to a namespace (no argument means the default `common`);
 * - `const t = pdfT('ns')` / `shareT('ns')` (src/pdf/strings.ts) bind to `ns` with the key
 *   prefix `pdf.` / `share.`, as does the inline form `pdfT('ns')('key')`;
 * - `.ts` logic files that receive `t` from a component have no binding; there the key must
 *   exist in at least one namespace (still catches typos and missing keys).
 * Plural keys count when any `_one`/`_other`/… form exists. Template-literal keys are skipped.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const EN = join(ROOT, 'i18n', 'en');
const DEFAULT_NS = 'common';
const PLURAL_SUFFIXES = ['zero', 'one', 'two', 'few', 'many', 'other'];

type Json = { [k: string]: unknown };

const namespaces: Record<string, Json> = Object.fromEntries(
  readdirSync(EN)
    .filter((f) => f.endsWith('.json'))
    .map((f) => [f.replace(/\.json$/, ''), JSON.parse(readFileSync(join(EN, f), 'utf8')) as Json]),
);

function lookup(ns: string, key: string): unknown {
  let node: unknown = namespaces[ns];
  for (const part of key.split('.')) {
    if (!node || typeof node !== 'object') return undefined;
    node = (node as Json)[part];
  }
  return node;
}

function keyExists(ns: string, key: string): boolean {
  if (!namespaces[ns]) return false;
  if (typeof lookup(ns, key) === 'string') return true;
  return PLURAL_SUFFIXES.some((s) => typeof lookup(ns, `${key}_${s}`) === 'string');
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === '__tests__' || name === 'node_modules' ? [] : sourceFiles(p);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) && !name.endsWith('.d.ts') ? [p] : [];
  });
}

const BINDING = /const\s*\{\s*t(?:\s*:\s*(\w+))?\s*(?:,[^}]*)?\}\s*=\s*useTranslation\(\s*(?:'([\w-]+)'|"([\w-]+)")?\s*\)/g;

const FIXED = /const\s+(\w+)\s*=\s*(pdfT|shareT)\(\s*'([\w-]+)'\s*\)/g;
const FIXED_INLINE = /\b(pdfT|shareT)\(\s*'([\w-]+)'\s*\)\(\s*'([^'\\]+)'/g;
const FIXED_PREFIX: Record<string, string> = { pdfT: 'pdf', shareT: 'share' };

type Scope = { ns: string; prefix: string };

type Missing = { file: string; call: string; looked: string };

function scan(): { missing: Missing[]; checked: number; badNamespaces: string[] } {
  const missing: Missing[] = [];
  const badNamespaces: string[] = [];
  let checked = 0;
  for (const file of sourceFiles(ROOT)) {
    const src = readFileSync(file, 'utf8');
    const rel = relative(ROOT, file);
    const bindings = new Map<string, Scope[]>();
    const bind = (name: string, scope: Scope) => {
      if (!bindings.has(name)) bindings.set(name, []);
      bindings.get(name)!.push(scope);
    };
    for (const m of src.matchAll(BINDING)) {
      const ns = m[2] ?? m[3] ?? DEFAULT_NS;
      if (!namespaces[ns]) badNamespaces.push(`${rel}: useTranslation('${ns}')`);
      bind(m[1] ?? 't', { ns, prefix: '' });
    }
    for (const m of src.matchAll(FIXED)) {
      if (!namespaces[m[3]]) badNamespaces.push(`${rel}: ${m[2]}('${m[3]}')`);
      bind(m[1], { ns: m[3], prefix: `${FIXED_PREFIX[m[2]]}.` });
    }
    for (const m of src.matchAll(FIXED_INLINE)) {
      checked += 1;
      if (!keyExists(m[2], `${FIXED_PREFIX[m[1]]}.${m[3]}`)) missing.push({ file: rel, call: `${m[1]}('${m[2]}')('${m[3]}')`, looked: m[2] });
    }
    const names = new Set(['t', ...bindings.keys()]);
    for (const name of names) {
      const call = new RegExp(`(?<![\\w.$])${name}\\(\\s*(?:'([^'\\\\]+)'|"([^"\\\\]+)")`, 'g');
      for (const m of src.matchAll(call)) {
        const raw = m[1] ?? m[2];
        if (!raw || /\s/.test(raw)) continue; // not a key (e.g. a sentence passed to another t-like fn)
        checked += 1;
        const colon = raw.indexOf(':');
        if (colon > 0 && namespaces[raw.slice(0, colon)]) {
          const ns = raw.slice(0, colon);
          const key = raw.slice(colon + 1);
          if (!keyExists(ns, key)) missing.push({ file: rel, call: raw, looked: ns });
          continue;
        }
        const bound = bindings.get(name);
        const scopes = bound ?? Object.keys(namespaces).map((ns) => ({ ns, prefix: '' }));
        if (!scopes.some((sc) => keyExists(sc.ns, sc.prefix + raw))) {
          const looked = bound ? scopes.map((sc) => sc.ns + (sc.prefix ? `:${sc.prefix}*` : '')).join('|') : 'any namespace';
          missing.push({ file: rel, call: `${name}('${raw}')`, looked });
        }
      }
    }
  }
  return { missing, checked, badNamespaces };
}

describe('i18n keys', () => {
  const result = scan();

  it('scans a meaningful number of t() calls', () => {
    expect(result.checked).toBeGreaterThan(200);
  });

  it('every useTranslation namespace has a JSON file', () => {
    expect(result.badNamespaces).toEqual([]);
  });

  it('every static t() key exists in src/i18n/en', () => {
    expect(result.missing.map((m) => `${m.file}: ${m.call}  (looked in ${m.looked})`)).toEqual([]);
  });
});
