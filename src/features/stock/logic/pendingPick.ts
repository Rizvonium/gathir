/**
 * The camera or gallery is about to open from a product wizard: remember which draft asked, and
 * the draft itself (PLAN §8 "photo taken just before Android closed the app").
 *
 * On low-memory phones Android often kills Gathir while the camera is open. The picker keeps the
 * photo (ImagePicker.getPendingResultAsync) but the in-memory draft and the open route are gone.
 * This marker, written to app storage before the picker opens, lets the next launch reopen the
 * same wizard with the same draft, and stops the photo from landing in any other wizard.
 */
import { File, Paths } from 'expo-file-system';

import type { ProductDraft } from './draft';

export const PENDING_PICK_FILE = 'pending-photo-pick.json';
/** A marker older than this is dropped: the picker result is too old to trust. */
export const PENDING_PICK_MAX_AGE_MS = 6 * 60 * 60 * 1000;

export type PendingPick = {
  /** Draft store key: 'new' or the edited product's id. */
  key: string;
  /** The edited product (null for a new one). */
  productId: string | null;
  /** When the picker was opened. */
  at: number;
  /** The draft as it was when the picker opened. */
  draft: ProductDraft;
};

function markerFile(): File {
  return new File(Paths.document, PENDING_PICK_FILE);
}

/** Writes the marker just before the picker opens. Never throws (the pick still works without it). */
export function rememberPick(pick: PendingPick): void {
  try {
    markerFile().writeSync(JSON.stringify(pick));
  } catch {
    // Without the marker a lost photo is simply not recovered.
  }
}

/** Removes the marker (the picker came back normally, or its result was used). Never throws. */
export function forgetPick(): void {
  try {
    const file = markerFile();
    if (file.exists) file.delete();
  } catch {
    // Already gone.
  }
}

function isPendingPick(v: unknown): v is PendingPick {
  if (!v || typeof v !== 'object') return false;
  const p = v as Partial<PendingPick>;
  return typeof p.key === 'string' && typeof p.at === 'number' && (p.productId === null || typeof p.productId === 'string') && !!p.draft && typeof p.draft === 'object';
}

/**
 * The marker left by a picker that never came back, or null. A stale or unreadable marker is
 * removed and reads as null.
 */
export function readPendingPick(now: number = Date.now()): PendingPick | null {
  try {
    const file = markerFile();
    if (!file.exists) return null;
    const parsed: unknown = JSON.parse(file.textSync());
    if (isPendingPick(parsed) && now - parsed.at >= 0 && now - parsed.at <= PENDING_PICK_MAX_AGE_MS) return parsed;
  } catch {
    // Unreadable: treat as none.
  }
  forgetPick();
  return null;
}
