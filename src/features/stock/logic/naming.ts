/**
 * Product name suggestions from the chips the seller already tapped (craft, material,
 * category, size), so a name never has to be typed: "Sozni Pashmina Stole".
 * Names are product data (stay in the seller's words), not UI copy.
 */

/** Chip values that carry no meaning in a name. */
const SKIP = new Set(['other', 'free size']);

/** "Stoles" → "Stole", "Pherans" → "Pheran"; leaves "Kani", "Pashmina", "Glass" alone. */
export function singular(word: string): string {
  const w = word.trim();
  if (w.length > 3 && /[^s]s$/i.test(w)) return w.slice(0, -1);
  return w;
}

/** "Stole (70×200)" → "Stole"; "Muffler" → "Muffler". */
export function sizeNoun(size: string): string {
  return size.replace(/\s*\(.*\)\s*$/, '').trim();
}

function clean(part: string | null | undefined): string {
  const p = (part ?? '').trim();
  return p && !SKIP.has(p.toLowerCase()) ? p : '';
}

/** Joins parts, dropping empties and repeated words ("Kani Kani" → "Kani"). */
export function joinWords(parts: string[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    for (const word of part.split(/\s+/).filter(Boolean)) {
      const key = word.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(word);
    }
  }
  return out.join(' ');
}

export type NameParts = {
  craft?: string | null;
  material?: string | null;
  categoryName?: string | null;
  size?: string | null;
};

/**
 * Up to three distinct name suggestions, best first. The first one is the default name used
 * when the seller leaves the name empty. Empty array when nothing is chosen yet.
 */
export function suggestNames({ craft, material, categoryName, size }: NameParts): string[] {
  const c = clean(craft);
  const m = clean(material);
  const noun = singular(clean(categoryName)) || sizeNoun(clean(size));
  const candidates = [joinWords([c, m, noun]), joinWords([c, noun]), joinWords([m, noun]), joinWords([c, m])];
  const unique: string[] = [];
  for (const name of candidates) {
    if (name && !unique.some((u) => u.toLowerCase() === name.toLowerCase())) unique.push(name);
  }
  return unique.slice(0, 3);
}
