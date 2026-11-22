/** Small, dependency-free helpers for building HTML strings safely. */

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '`': '&#96;',
};

/**
 * Escapes text for HTML element content AND quoted attribute values.
 * Every piece of user-entered text must pass through this before it reaches a template.
 */
export function escapeHtml(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"'`]/g, (ch) => HTML_ESCAPES[ch] ?? ch);
}

/** Escapes and turns line breaks into <br>, for multi-line notes and addresses. */
export function escapeMultiline(value: string | null | undefined): string {
  return escapeHtml(value?.trim() ?? '').replace(/\r?\n/g, '<br>');
}

/** Only a `data:image/…;base64,` URI (or nothing) may become an <img src>; anything else is dropped. */
export function safeImageSrc(dataUri: string | null | undefined): string | null {
  if (!dataUri) return null;
  return /^data:image\/(jpeg|jpg|png|webp|svg\+xml);base64,[A-Za-z0-9+/=\s]+$/.test(dataUri) ? dataUri : null;
}

/** Only #rgb / #rrggbb colours reach CSS; anything else → null. */
export function safeHex(hex: string): string | null {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex) ? hex : null;
}

/** "Sozni Stole" → "SS"; "pashmina" → "PA". Up to two letters, upper case. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  const firstLetter = (w: string) => Array.from(w)[0] ?? '';
  if (words.length === 1) return Array.from(words[0]).slice(0, 2).join('').toUpperCase();
  return (firstLetter(words[0]) + firstLetter(words[words.length - 1])).toUpperCase();
}

/** Joins the non-empty parts with a separator ("Sozni · Pashmina · 100×200 cm"). */
export function joinParts(parts: (string | null | undefined)[], separator = ' · '): string {
  return parts
    .map((p) => p?.trim() ?? '')
    .filter((p) => p !== '')
    .join(separator);
}

/** Splits a list into consecutive chunks of `size` (last chunk may be shorter). */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (size < 1) throw new Error('chunk size must be ≥ 1');
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
