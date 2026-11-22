/** What happens after the share sheet / WhatsApp returns (PLAN §7, §4 state coverage). Pure. */
import type { ShareStatus } from '@/share/whatsapp';

export type SendOutcome =
  /** WhatsApp opened in the owner's chat with the PDF: mark as sent (Undo offered). */
  | { kind: 'sent'; markSent: true }
  /** WhatsApp missing or failed: the Android share sheet was used. Mark as sent (Undo offered). */
  | { kind: 'shared'; markSent: true }
  /** The seller backed out: nothing is marked. */
  | { kind: 'not_sent'; markSent: false }
  /** Nothing could share the file. */
  | { kind: 'failed'; markSent: false };

export function outcomeOf(status: ShareStatus): SendOutcome {
  switch (status) {
    case 'sent':
      return { kind: 'sent', markSent: true };
    case 'fallback_shared':
      return { kind: 'shared', markSent: true };
    case 'dismissed':
      return { kind: 'not_sent', markSent: false };
    case 'unavailable':
    case 'error':
      return { kind: 'failed', markSent: false };
  }
}

/** Full-size photo file names of the sold items (sale rows keep the thumbnail name). */
export function fullPhotoNames(thumbNames: readonly (string | null)[], thumbSuffix: string): string[] {
  const out = new Set<string>();
  for (const n of thumbNames) {
    if (!n) continue;
    out.add(n.endsWith(thumbSuffix) ? `${n.slice(0, -thumbSuffix.length)}.jpg` : n);
  }
  return [...out];
}
