/**
 * Machine-readable notes on 'deleted' stock moves, so a restore can put back
 * exactly the pieces a delete removed.
 */
export type DeleteScope = 'product' | 'colour';
type DeleteNote = { scope: DeleteScope; deletedPieces: number };

/** Note text for a 'deleted' move. */
export function deleteNote(scope: DeleteScope, deletedPieces: number): string {
  return JSON.stringify({ scope, deletedPieces } satisfies DeleteNote);
}

/** Parses a note written by `deleteNote`; returns null for ordinary notes. */
export function parseDeleteNote(note: string): DeleteNote | null {
  if (!note.startsWith('{')) return null;
  try {
    const v: unknown = JSON.parse(note);
    if (
      typeof v === 'object' &&
      v !== null &&
      'scope' in v &&
      'deletedPieces' in v &&
      (v.scope === 'product' || v.scope === 'colour') &&
      typeof v.deletedPieces === 'number'
    ) {
      return { scope: v.scope, deletedPieces: v.deletedPieces };
    }
  } catch {
    // not JSON: a human note
  }
  return null;
}

/** Note text safe to show people: machine notes become ''. */
export function displayNote(note: string): string {
  return parseDeleteNote(note) ? '' : note;
}
